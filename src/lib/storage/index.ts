import 'server-only';
import { extname } from 'node:path';
import { env } from '../env';
import { prisma } from '../db';
import { randomToken, sha256Hex } from '../crypto';
import { AppError } from '../errors';
import {
  DOCX_MIME,
  THUMBNAIL_SPEC,
  UPLOAD_SPECS,
  type MaterialType,
} from '../constants';
import { sanitiseFilename } from '../sanitize';
import { LocalStorageDriver } from './local';
import { S3StorageDriver } from './s3';
import type { StorageDriver } from './types';

export type { ByteRange, ObjectMetadata, StorageDriver } from './types';
export { StorageError } from './types';

const globalForStorage = globalThis as unknown as {
  __fodanStorage?: StorageDriver;
};

function buildDriver(): StorageDriver {
  if (env.storage.driver === 's3') {
    return new S3StorageDriver({
      bucket: env.storage.s3.bucket,
      region: env.storage.s3.region,
      endpoint: env.storage.s3.endpoint || undefined,
      accessKeyId: env.storage.s3.accessKeyId,
      secretAccessKey: env.storage.s3.secretAccessKey,
      forcePathStyle: env.storage.s3.forcePathStyle,
    });
  }
  return new LocalStorageDriver(env.storage.localDir);
}

export const storage: StorageDriver =
  globalForStorage.__fodanStorage ?? buildDriver();

if (!env.isProduction) {
  globalForStorage.__fodanStorage = storage;
}

// -----------------------------------------------------------------------------
// Upload validation
// -----------------------------------------------------------------------------

/**
 * Magic-number prefixes.
 *
 * The browser-supplied MIME type and the filename extension are both attacker
 * controlled, so neither is trusted on its own. The first bytes of the file
 * must also agree — this is what stops a renamed .exe or a PHP shell from being
 * accepted as an "MP4".
 */
const MAGIC_SIGNATURES: { mime: string; prefixes: number[][]; offset?: number }[] = [
  { mime: 'application/pdf', prefixes: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
  // All OOXML formats (docx/pptx) are ZIP containers.
  {
    mime: 'application/zip',
    prefixes: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
      [0x50, 0x4b, 0x07, 0x08],
    ],
  },
  { mime: 'video/mp4', prefixes: [[0x66, 0x74, 0x79, 0x70]], offset: 4 }, // 'ftyp'
  {
    mime: 'audio/mpeg',
    prefixes: [
      [0x49, 0x44, 0x33], // ID3 tag
      [0xff, 0xfb],
      [0xff, 0xf3],
      [0xff, 0xf2],
    ],
  },
  { mime: 'image/png', prefixes: [[0x89, 0x50, 0x4e, 0x47]] },
  { mime: 'image/jpeg', prefixes: [[0xff, 0xd8, 0xff]] },
  { mime: 'image/webp', prefixes: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF....WEBP
];

/** Extensions that must never be accepted, whatever else the file claims. */
const FORBIDDEN_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bat', '.cmd', '.com', '.msi', '.scr',
  '.js', '.mjs', '.cjs', '.jsp', '.asp', '.aspx', '.php', '.phtml', '.py',
  '.rb', '.pl', '.sh', '.bash', '.ps1', '.psm1', '.vbs', '.jar', '.war',
  '.htaccess', '.svg', '.html', '.htm', '.xhtml',
]);

export interface ValidatedUpload {
  buffer: Buffer;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  materialType: MaterialType | null;
}

export interface UploadValidationOptions {
  /** Restrict to a single material type; omit to accept any supported type. */
  expect?: MaterialType;
  kind?: 'material' | 'thumbnail' | 'exam-docx';
}

export async function validateUpload(
  file: File,
  options: UploadValidationOptions = {},
): Promise<ValidatedUpload> {
  const kind = options.kind ?? 'material';
  const originalName = sanitiseFilename(file.name || 'upload');
  const extension = extname(originalName).toLowerCase();

  if (!extension) {
    throw new AppError('UPLOAD_REJECTED', 'The file needs a file extension.');
  }
  if (FORBIDDEN_EXTENSIONS.has(extension)) {
    throw new AppError(
      'UPLOAD_REJECTED',
      'That kind of file cannot be uploaded to this platform.',
    );
  }

  const globalLimit = env.storage.maxUploadMb * 1024 * 1024;
  if (file.size <= 0) {
    throw new AppError('UPLOAD_REJECTED', 'The file appears to be empty.');
  }
  if (file.size > globalLimit) {
    throw new AppError(
      'UPLOAD_REJECTED',
      `Files must be smaller than ${env.storage.maxUploadMb} MB.`,
    );
  }

  const spec = resolveSpec(kind, extension, options.expect);
  if (spec.maxSizeMb * 1024 * 1024 < file.size) {
    throw new AppError(
      'UPLOAD_REJECTED',
      `${describeKind(kind, extension)} must be smaller than ${spec.maxSizeMb} MB.`,
    );
  }

  const declaredMime = (file.type || '').toLowerCase();
  if (declaredMime && !spec.mimeTypes.includes(declaredMime)) {
    throw new AppError(
      'UPLOAD_REJECTED',
      `The file does not look like a ${describeKind(kind, extension)}.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength !== file.size) {
    throw new AppError('UPLOAD_REJECTED', 'The upload did not complete. Try again.');
  }

  if (!matchesMagic(buffer, extension)) {
    throw new AppError(
      'UPLOAD_REJECTED',
      'The contents of that file do not match its type. Re-save it and try again.',
    );
  }

  return {
    buffer,
    originalName,
    extension,
    mimeType: spec.mimeTypes[0] as string,
    size: buffer.byteLength,
    materialType: spec.materialType,
  };
}

interface ResolvedSpec {
  mimeTypes: string[];
  maxSizeMb: number;
  materialType: MaterialType | null;
}

function resolveSpec(
  kind: 'material' | 'thumbnail' | 'exam-docx',
  extension: string,
  expect?: MaterialType,
): ResolvedSpec {
  if (kind === 'thumbnail') {
    if (!THUMBNAIL_SPEC.extensions.includes(extension)) {
      throw new AppError(
        'UPLOAD_REJECTED',
        'Thumbnails must be a PNG, JPG or WebP image.',
      );
    }
    return {
      mimeTypes: mimeTypesForImage(extension),
      maxSizeMb: THUMBNAIL_SPEC.maxSizeMb,
      materialType: null,
    };
  }

  if (kind === 'exam-docx') {
    if (extension !== '.docx') {
      throw new AppError(
        'UPLOAD_REJECTED',
        'Examination questions must be uploaded as a .docx Word document.',
      );
    }
    return { mimeTypes: [DOCX_MIME], maxSizeMb: 25, materialType: 'DOCX' };
  }

  const spec = UPLOAD_SPECS.find((candidate) =>
    candidate.extensions.includes(extension),
  );

  if (!spec) {
    throw new AppError(
      'UPLOAD_REJECTED',
      'Supported formats are PDF, PPTX, DOCX, MP4 and MP3.',
    );
  }

  if (expect && spec.materialType !== expect) {
    throw new AppError(
      'UPLOAD_REJECTED',
      `This slot expects a ${expect} file, but a ${spec.materialType} file was chosen.`,
    );
  }

  return {
    mimeTypes: spec.mimeTypes,
    maxSizeMb: spec.maxSizeMb,
    materialType: spec.materialType,
  };
}

function mimeTypesForImage(extension: string): string[] {
  switch (extension) {
    case '.png':
      return ['image/png'];
    case '.webp':
      return ['image/webp'];
    default:
      return ['image/jpeg'];
  }
}

function describeKind(kind: string, extension: string): string {
  if (kind === 'thumbnail') return 'image';
  if (kind === 'exam-docx') return 'Word document';
  return `${extension.replace('.', '').toUpperCase()} file`;
}

function matchesMagic(buffer: Buffer, extension: string): boolean {
  const expectedMime = magicGroupFor(extension);
  if (!expectedMime) return true;

  const signature = MAGIC_SIGNATURES.find((s) => s.mime === expectedMime);
  if (!signature) return true;

  const offset = signature.offset ?? 0;
  return signature.prefixes.some((prefix) =>
    prefix.every((byte, index) => buffer[offset + index] === byte),
  );
}

function magicGroupFor(extension: string): string | null {
  switch (extension) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
    case '.pptx':
      return 'application/zip';
    case '.mp4':
      return 'video/mp4';
    case '.mp3':
      return 'audio/mpeg';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Persisting a validated upload
// -----------------------------------------------------------------------------

/**
 * Generates a storage key that reveals nothing about the file: no original
 * name, no user id, no sequential counter. The date prefix exists only so that
 * an operator can prune or archive by period.
 */
export function buildStorageKey(prefix: string, extension: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${prefix}/${year}/${month}/${randomToken(18)}${extension}`;
}

export interface StoreFileOptions {
  prefix?: string;
  uploadedById: string | null;
}

export async function storeValidatedUpload(
  upload: ValidatedUpload,
  options: StoreFileOptions,
) {
  const key = buildStorageKey(options.prefix ?? 'uploads', upload.extension);

  await storage.put(key, upload.buffer, upload.mimeType);

  try {
    return await prisma.storedFile.create({
      data: {
        storageKey: key,
        provider: storage.name,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        sizeBytes: upload.size,
        checksum: sha256Hex(upload.buffer),
        uploadedById: options.uploadedById,
      },
    });
  } catch (error) {
    // Do not leave an orphaned object behind if the row could not be written.
    await storage.delete(key).catch(() => undefined);
    throw error;
  }
}

/** Removes both the database row and the underlying object. */
export async function deleteStoredFile(fileId: string): Promise<void> {
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return;

  await prisma.storedFile.delete({ where: { id: fileId } });
  await storage.delete(file.storageKey).catch((error) => {
    // The row is gone; a leftover object is a housekeeping problem, not a
    // correctness one, so log rather than fail the caller's action.
    console.error('[fodan][storage] orphaned object after delete', {
      key: file.storageKey,
      error,
    });
  });
}

// -----------------------------------------------------------------------------
// HTTP range parsing (video/audio seeking)
// -----------------------------------------------------------------------------

export function parseRangeHeader(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;

  let start: number;
  let end: number;

  if (rawStart === '') {
    // Suffix form: "bytes=-500" means the last 500 bytes.
    const suffixLength = Number.parseInt(rawEnd ?? '', 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number.parseInt(rawStart ?? '', 10);
    end = rawEnd === '' ? size - 1 : Number.parseInt(rawEnd ?? '', 10);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= size) return null;

  return { start, end: Math.min(end, size - 1) };
}
