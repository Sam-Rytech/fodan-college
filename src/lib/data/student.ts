import 'server-only';
import { prisma } from '../db';
import { notFound } from '../errors';
import { percentage } from '../utils';
import {
  ATTEMPT_STATUS,
  EXAM_STATUS,
  LESSON_PROGRESS_STATUS,
  PUBLISH_STATUS,
} from '../constants';
import type { AuthUser } from '../auth/types';

/**
 * Read models for the student experience.
 *
 * Every function here takes the *student's own* class from their profile rather
 * than from a parameter, so there is no query shape in which a student can ask
 * for another class's material. Published-only filters are applied at the
 * database level, never in the component.
 */

export interface SubjectProgress {
  id: string;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  colorKey: string;
  iconKey: string;
  topicCount: number;
  materialCount: number;
  completedCount: number;
  progressPercent: number;
  examCount: number;
}

export async function getStudentSubjects(user: AuthUser): Promise<SubjectProgress[]> {
  const classId = user.student?.classId;
  if (!classId) return [];

  const links = await prisma.classSubject.findMany({
    where: { classId, subject: { isActive: true } },
    include: { subject: true },
    orderBy: { subject: { orderIndex: 'asc' } },
  });

  if (links.length === 0) return [];

  const subjectIds = links.map((link) => link.subjectId);

  const [topicCounts, materials, completed, examCounts] = await Promise.all([
    prisma.topic.groupBy({
      by: ['subjectId'],
      where: { classId, subjectId: { in: subjectIds }, isPublished: true },
      _count: { _all: true },
    }),
    prisma.learningMaterial.groupBy({
      by: ['subjectId'],
      where: {
        classId,
        subjectId: { in: subjectIds },
        status: PUBLISH_STATUS.PUBLISHED,
      },
      _count: { _all: true },
    }),
    prisma.lessonProgress.findMany({
      where: {
        studentId: user.id,
        status: LESSON_PROGRESS_STATUS.COMPLETED,
        material: { classId, subjectId: { in: subjectIds } },
      },
      select: { material: { select: { subjectId: true } } },
    }),
    prisma.examination.groupBy({
      by: ['subjectId'],
      where: {
        classId,
        subjectId: { in: subjectIds },
        status: EXAM_STATUS.PUBLISHED,
      },
      _count: { _all: true },
    }),
  ]);

  const topicMap = new Map(topicCounts.map((row) => [row.subjectId, row._count._all]));
  const materialMap = new Map(materials.map((row) => [row.subjectId, row._count._all]));
  const examMap = new Map(examCounts.map((row) => [row.subjectId, row._count._all]));

  const completedMap = new Map<string, number>();
  for (const row of completed) {
    const key = row.material.subjectId;
    completedMap.set(key, (completedMap.get(key) ?? 0) + 1);
  }

  return links.map((link) => {
    const materialCount = materialMap.get(link.subjectId) ?? 0;
    const completedCount = completedMap.get(link.subjectId) ?? 0;

    return {
      id: link.subject.id,
      name: link.subject.name,
      slug: link.subject.slug,
      code: link.subject.code,
      description: link.subject.description,
      colorKey: link.subject.colorKey,
      iconKey: link.subject.iconKey,
      topicCount: topicMap.get(link.subjectId) ?? 0,
      materialCount,
      completedCount,
      progressPercent: percentage(completedCount, materialCount),
      examCount: examMap.get(link.subjectId) ?? 0,
    };
  });
}

export async function getSubjectDetail(user: AuthUser, subjectSlug: string) {
  const classId = user.student?.classId;
  if (!classId) throw notFound('Choose your class first.');

  const subject = await prisma.subject.findFirst({
    where: {
      slug: subjectSlug,
      isActive: true,
      classes: { some: { classId } },
    },
  });

  if (!subject) throw notFound('That subject is not available for your class.');

  const topics = await prisma.topic.findMany({
    where: { subjectId: subject.id, classId, isPublished: true },
    orderBy: { orderIndex: 'asc' },
    include: {
      materials: {
        where: { status: PUBLISH_STATUS.PUBLISHED },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          durationSeconds: true,
          downloadable: true,
          orderIndex: true,
        },
      },
    },
  });

  const materialIds = topics.flatMap((topic) =>
    topic.materials.map((material) => material.id),
  );

  const progress = await prisma.lessonProgress.findMany({
    where: { studentId: user.id, materialId: { in: materialIds } },
    select: {
      materialId: true,
      status: true,
      progressPercent: true,
      lastPositionSeconds: true,
    },
  });

  const progressMap = new Map(progress.map((row) => [row.materialId, row]));

  const topicsWithProgress = topics.map((topic) => {
    const materials = topic.materials.map((material) => ({
      ...material,
      progress: progressMap.get(material.id) ?? null,
    }));
    const completed = materials.filter(
      (material) => material.progress?.status === LESSON_PROGRESS_STATUS.COMPLETED,
    ).length;

    return {
      ...topic,
      materials,
      completedCount: completed,
      progressPercent: percentage(completed, materials.length),
    };
  });

  const totalMaterials = materialIds.length;
  const totalCompleted = topicsWithProgress.reduce(
    (sum, topic) => sum + topic.completedCount,
    0,
  );

  return {
    subject,
    topics: topicsWithProgress,
    totalMaterials,
    totalCompleted,
    progressPercent: percentage(totalCompleted, totalMaterials),
  };
}

/**
 * A single material, resolved with an access check baked into the query: the
 * material must be published AND belong to the student's own class.
 */
export async function getMaterialForStudent(user: AuthUser, materialId: string) {
  const classId = user.student?.classId;
  if (!classId) throw notFound('Choose your class first.');

  const material = await prisma.learningMaterial.findFirst({
    where: { id: materialId, classId, status: PUBLISH_STATUS.PUBLISHED },
    include: {
      topic: { select: { id: true, title: true, slug: true } },
      subject: { select: { id: true, name: true, slug: true } },
      file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
    },
  });

  if (!material) throw notFound('That lesson is not available.');

  const [progress, siblings] = await Promise.all([
    prisma.lessonProgress.findUnique({
      where: { studentId_materialId: { studentId: user.id, materialId } },
    }),
    prisma.learningMaterial.findMany({
      where: {
        topicId: material.topicId,
        status: PUBLISH_STATUS.PUBLISHED,
      },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, title: true, type: true, orderIndex: true },
    }),
  ]);

  const index = siblings.findIndex((item) => item.id === materialId);

  return {
    material,
    progress,
    siblings,
    previous: index > 0 ? siblings[index - 1] : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}

/** Recently opened lessons, for the "continue where you left off" panel. */
export async function getRecentLessons(user: AuthUser, take = 4) {
  return prisma.lessonProgress.findMany({
    where: { studentId: user.id },
    orderBy: { updatedAt: 'desc' },
    take,
    include: {
      material: {
        select: {
          id: true,
          title: true,
          type: true,
          durationSeconds: true,
          subject: { select: { name: true, slug: true, colorKey: true } },
          topic: { select: { title: true } },
        },
      },
    },
  });
}

// -----------------------------------------------------------------------------
// Examinations
// -----------------------------------------------------------------------------

export interface StudentExamRow {
  id: string;
  title: string;
  subjectName: string;
  durationMins: number;
  totalQuestions: number;
  totalMarks: number;
  passMark: number;
  attemptLimit: number;
  availableFrom: Date | null;
  availableTo: Date | null;
  attemptsUsed: number;
  openAttemptId: string | null;
  bestPercentage: number | null;
  lastAttemptId: string | null;
}

export async function getStudentExams(user: AuthUser): Promise<StudentExamRow[]> {
  const classId = user.student?.classId;
  if (!classId) return [];

  const exams = await prisma.examination.findMany({
    where: { classId, status: EXAM_STATUS.PUBLISHED },
    orderBy: [{ availableFrom: 'asc' }, { createdAt: 'desc' }],
    include: {
      subject: { select: { name: true } },
      attempts: {
        where: { studentId: user.id },
        orderBy: { attemptNumber: 'desc' },
        select: {
          id: true,
          status: true,
          percentage: true,
          attemptNumber: true,
        },
      },
    },
  });

  return exams.map((exam) => {
    const finished = exam.attempts.filter(
      (attempt) =>
        attempt.status === ATTEMPT_STATUS.SUBMITTED ||
        attempt.status === ATTEMPT_STATUS.AUTO_SUBMITTED,
    );
    const open = exam.attempts.find(
      (attempt) => attempt.status === ATTEMPT_STATUS.IN_PROGRESS,
    );

    return {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subject.name,
      durationMins: exam.durationMins,
      totalQuestions: exam.totalQuestions,
      totalMarks: exam.totalMarks,
      passMark: exam.passMark,
      attemptLimit: exam.attemptLimit,
      availableFrom: exam.availableFrom,
      availableTo: exam.availableTo,
      attemptsUsed: finished.length,
      openAttemptId: open?.id ?? null,
      bestPercentage:
        finished.length > 0
          ? Math.max(...finished.map((attempt) => attempt.percentage))
          : null,
      lastAttemptId: finished[0]?.id ?? null,
    };
  });
}

export async function getStudentResults(user: AuthUser) {
  return prisma.result.findMany({
    where: { studentId: user.id },
    orderBy: { submittedAt: 'desc' },
    include: {
      exam: { select: { id: true, title: true, showResultInstantly: true } },
      subject: { select: { name: true } },
    },
  });
}

/** Everything the student dashboard needs, in one round of parallel queries. */
export async function getStudentDashboard(user: AuthUser) {
  const classId = user.student?.classId;

  const [subjects, recentLessons, exams, results, forumCategory] = await Promise.all([
    getStudentSubjects(user),
    getRecentLessons(user, 3),
    getStudentExams(user),
    prisma.result.findMany({
      where: { studentId: user.id },
      orderBy: { submittedAt: 'desc' },
      take: 3,
      include: {
        exam: { select: { title: true, showResultInstantly: true } },
        subject: { select: { name: true } },
      },
    }),
    classId
      ? prisma.forumCategory.findFirst({
          where: { classId, isActive: true },
          select: { id: true, slug: true, name: true, _count: { select: { posts: true } } },
        })
      : null,
  ]);

  const totalMaterials = subjects.reduce((sum, s) => sum + s.materialCount, 0);
  const totalCompleted = subjects.reduce((sum, s) => sum + s.completedCount, 0);

  const now = Date.now();
  const availableExams = exams.filter(
    (exam) =>
      (!exam.availableFrom || exam.availableFrom.getTime() <= now) &&
      (!exam.availableTo || exam.availableTo.getTime() >= now) &&
      (exam.openAttemptId !== null || exam.attemptsUsed < exam.attemptLimit),
  );
  const upcomingExams = exams.filter(
    (exam) => exam.availableFrom && exam.availableFrom.getTime() > now,
  );

  const averageScore =
    results.length > 0
      ? Math.round(
          (results.reduce((sum, r) => sum + r.percentage, 0) / results.length) * 10,
        ) / 10
      : null;

  return {
    subjects,
    recentLessons,
    availableExams,
    upcomingExams,
    results,
    forumCategory,
    totalMaterials,
    totalCompleted,
    overallProgress: percentage(totalCompleted, totalMaterials),
    averageScore,
  };
}
