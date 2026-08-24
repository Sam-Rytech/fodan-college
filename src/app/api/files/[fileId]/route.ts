import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { storage, parseRangeHeader } from '@/lib/storage';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, isStaff } from '@/lib/auth/rbac';
import { recordAudit } from '@/lib/audit';
import { sanitiseFilename } from '@/lib/sanitize';
import {
  AUDIT_ACTIONS,
  PERMISSIONS,
  PUBLISH_STATUS,
  ROLES,
} from '@/lib/constants';

/**
 * Authenticated file delivery.
 *
 * This is the ONLY way an uploaded file leaves the platform. Nothing is written
 * into `public/`, and no pre-signed URL is ever handed out, so access is
 * re-evaluated on every single request rather than frozen at the moment a link
 * was created.
 *
 * Authorisation, in order:
 *   1. There must be a valid session.
 *   2. The file must be referenced by something the viewer may see.
 *   3. For a student, that means: a PUBLISHED material, in their OWN class,
 *      and their account must be activated.
 *   4. For a Mini Admin, the material must fall inside their class assignment.
 *
 * Range requests are honoured so lesson videos seek properly and a two-hour
 * recording does not have to be buffered whole before it plays.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to open this file.' }, { status: 401 });
  }

  const file = await prisma.storedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      storageKey: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
    },
  });

  if (!file) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }

  const decision = await authorise(fileId, user);
  if (!decision.allowed) {
    // 404 rather than 403: a student probing file ids should not be able to
    // learn which ones exist.
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }

  const disposition =
    request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline';

  if (disposition === 'attachment' && !decision.downloadable) {
    return NextResponse.json(
      { error: 'This material can be viewed but not downloaded.' },
      { status: 403 },
    );
  }

  const meta = await storage.head(file.storageKey);
  const size = meta?.size ?? file.sizeBytes;

  const headers = new Headers({
    'Content-Type': file.mimeType,
    'Content-Disposition': `${disposition}; filename="${sanitiseFilename(file.originalName)}"`,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    // Personal, permission-dependent content: never store it in a shared cache.
    'Cache-Control': 'private, max-age=0, must-revalidate',
  });

  const range = parseRangeHeader(request.headers.get('range'), size);

  try {
    if (range) {
      const stream = await storage.getStream(file.storageKey, range);
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      headers.set('Content-Length', String(range.end - range.start + 1));
      return new NextResponse(stream, { status: 206, headers });
    }

    const stream = await storage.getStream(file.storageKey);
    headers.set('Content-Length', String(size));

    // Only whole-file reads count as an access; range requests are the same
    // read continuing, and logging each one would drown the audit trail.
    if (decision.audit) {
      void recordAudit({
        action: AUDIT_ACTIONS.FILE_DOWNLOADED,
        actor: user,
        targetType: 'stored_file',
        targetId: fileId,
        description: `${user.fullName} opened "${file.originalName}".`,
        metadata: { disposition },
      });
    }

    return new NextResponse(stream, { status: 200, headers });
  } catch (error) {
    console.error('[fodan][files] failed to stream', { fileId, error });
    return NextResponse.json(
      { error: 'This file could not be opened. Please tell your teacher.' },
      { status: 500 },
    );
  }
}

interface Decision {
  allowed: boolean;
  downloadable: boolean;
  audit: boolean;
}

const DENY: Decision = { allowed: false, downloadable: false, audit: false };

async function authorise(
  fileId: string,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
): Promise<Decision> {
  // --- Learning material (or its thumbnail) --------------------------------
  const material = await prisma.learningMaterial.findFirst({
    where: { OR: [{ fileId }, { thumbnailId: fileId }] },
    select: {
      id: true,
      classId: true,
      subjectId: true,
      status: true,
      downloadable: true,
      thumbnailId: true,
    },
  });

  if (material) {
    const isThumbnail = material.thumbnailId === fileId;

    if (user.role === ROLES.STUDENT) {
      const ok =
        material.status === PUBLISH_STATUS.PUBLISHED &&
        material.classId === user.student?.classId &&
        Boolean(user.student?.isActivated);
      return ok
        ? { allowed: true, downloadable: material.downloadable, audit: !isThumbnail }
        : DENY;
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      return { allowed: true, downloadable: true, audit: !isThumbnail };
    }

    // Mini Admin: must hold upload_materials and be assigned to the class.
    const ok =
      hasPermission(user, PERMISSIONS.UPLOAD_MATERIALS) &&
      user.assignedClassIds.includes(material.classId);
    return ok ? { allowed: true, downloadable: true, audit: !isThumbnail } : DENY;
  }

  // --- Examination source document / import ------------------------------
  const examSource = await prisma.examination.findFirst({
    where: { sourceFileId: fileId },
    select: { id: true, classId: true },
  });
  const examImport = await prisma.examImport.findFirst({
    where: { fileId },
    select: { id: true, createdById: true },
  });

  if (examSource || examImport) {
    // Question papers contain the answer key. Students never reach them.
    if (!isStaff(user)) return DENY;
    if (!hasPermission(user, PERMISSIONS.MANAGE_EXAMS)) return DENY;

    if (user.role === ROLES.SUPER_ADMIN) {
      return { allowed: true, downloadable: true, audit: true };
    }
    if (examSource && !user.assignedClassIds.includes(examSource.classId)) {
      return DENY;
    }
    if (examImport && examImport.createdById !== user.id) {
      return DENY;
    }
    return { allowed: true, downloadable: true, audit: true };
  }

  // --- Orphaned file -------------------------------------------------------
  // Nothing references it. Only the Super Admin may retrieve such a file, so a
  // stale record cannot become an open door.
  return user.role === ROLES.SUPER_ADMIN
    ? { allowed: true, downloadable: true, audit: true }
    : DENY;
}
