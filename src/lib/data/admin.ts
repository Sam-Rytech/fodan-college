import 'server-only';
import { prisma } from '../db';
import { classScopeFilter } from '../auth/rbac';
import { addDays, percentage } from '../utils';
import {
  ACCESS_CODE_STATUS,
  ATTEMPT_STATUS,
  EXAM_STATUS,
  PUBLISH_STATUS,
  ROLES,
  TASK_STATUS,
  USER_STATUS,
} from '../constants';
import type { AuthUser } from '../auth/types';

/**
 * Read models for the administrator area.
 *
 * Every query that can be scoped IS scoped: a Mini Admin's dashboard counts
 * only the classes they were assigned, so the numbers they see match the work
 * they can actually do. The Super Admin sees the whole school.
 */

export async function getSuperAdminDashboard() {
  const now = new Date();
  const weekAgo = addDays(now, -7);

  const [
    studentTotal,
    studentActivated,
    studentDisabled,
    adminTotal,
    adminActive,
    subjectCount,
    classCount,
    materialCount,
    examTotal,
    examPublished,
    attemptsCompleted,
    resultAggregate,
    recentRegistrations,
    recentActivity,
    pendingTasks,
    expiringCodes,
    codeCounts,
    classPerformance,
  ] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.studentProfile.count({ where: { isActivated: true } }),
    prisma.user.count({
      where: { role: { key: ROLES.STUDENT }, status: USER_STATUS.DISABLED },
    }),
    prisma.user.count({ where: { role: { key: ROLES.MINI_ADMIN } } }),
    prisma.user.count({
      where: { role: { key: ROLES.MINI_ADMIN }, status: USER_STATUS.ACTIVE },
    }),
    prisma.subject.count({ where: { isActive: true } }),
    prisma.schoolClass.count({ where: { isActive: true } }),
    prisma.learningMaterial.count({ where: { status: PUBLISH_STATUS.PUBLISHED } }),
    prisma.examination.count(),
    prisma.examination.count({ where: { status: EXAM_STATUS.PUBLISHED } }),
    prisma.examAttempt.count({
      where: {
        status: { in: [ATTEMPT_STATUS.SUBMITTED, ATTEMPT_STATUS.AUTO_SUBMITTED] },
      },
    }),
    prisma.result.aggregate({ _avg: { percentage: true }, _count: { _all: true } }),
    prisma.user.findMany({
      where: { role: { key: ROLES.STUDENT }, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        fullName: true,
        username: true,
        createdAt: true,
        studentProfile: {
          select: { isActivated: true, schoolClass: { select: { name: true } } },
        },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        action: true,
        description: true,
        actorUsername: true,
        actorRole: true,
        severity: true,
        createdAt: true,
      },
    }),
    prisma.task.findMany({
      where: { status: { in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS] } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      include: {
        assignedTo: { select: { id: true, fullName: true, username: true } },
      },
    }),
    prisma.accessCode.findMany({
      where: {
        status: ACCESS_CODE_STATUS.ACTIVE,
        expiresAt: { gte: now, lte: addDays(now, 7) },
      },
      orderBy: { expiresAt: 'asc' },
      take: 5,
      include: {
        student: { select: { fullName: true, username: true } },
        schoolClass: { select: { name: true } },
      },
    }),
    prisma.accessCode.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.result.groupBy({
      by: ['classId'],
      _avg: { percentage: true },
      _count: { _all: true },
    }),
  ]);

  const classNames = await prisma.schoolClass.findMany({
    where: { id: { in: classPerformance.map((row) => row.classId) } },
    select: { id: true, name: true, orderIndex: true },
  });
  const nameMap = new Map(classNames.map((row) => [row.id, row]));

  return {
    students: {
      total: studentTotal,
      activated: studentActivated,
      awaiting: studentTotal - studentActivated,
      disabled: studentDisabled,
      activationRate: percentage(studentActivated, studentTotal),
    },
    admins: { total: adminTotal, active: adminActive },
    content: {
      subjects: subjectCount,
      classes: classCount,
      materials: materialCount,
    },
    exams: {
      total: examTotal,
      published: examPublished,
      attemptsCompleted,
      averageScore: resultAggregate._avg.percentage
        ? Math.round(resultAggregate._avg.percentage * 10) / 10
        : null,
      resultCount: resultAggregate._count._all,
    },
    codes: Object.fromEntries(
      codeCounts.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<string, number>>,
    recentRegistrations,
    recentActivity,
    pendingTasks,
    expiringCodes,
    classPerformance: classPerformance
      .map((row) => ({
        classId: row.classId,
        name: nameMap.get(row.classId)?.name ?? 'Unknown class',
        orderIndex: nameMap.get(row.classId)?.orderIndex ?? 999,
        average: Math.round((row._avg.percentage ?? 0) * 10) / 10,
        count: row._count._all,
      }))
      .sort((a, b) => a.orderIndex - b.orderIndex),
  };
}

/**
 * Mini Admin dashboard. Everything is filtered by the classes and subjects the
 * Super Admin assigned; an unassigned Mini Admin sees an empty (but honest)
 * workspace rather than the whole school.
 */
export async function getMiniAdminDashboard(user: AuthUser) {
  const classIds = user.assignedClassIds;
  const subjectIds = user.assignedSubjectIds;

  const [
    tasks,
    taskCounts,
    classes,
    subjects,
    materialsUploaded,
    examsManaged,
    studentCount,
    recentMaterials,
    recentResults,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignedToId: user.id,
        status: { in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS] },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 8,
      include: {
        createdBy: { select: { fullName: true, username: true } },
      },
    }),
    prisma.task.groupBy({
      by: ['status'],
      where: { assignedToId: user.id },
      _count: { _all: true },
    }),
    prisma.schoolClass.findMany({
      where: { id: { in: classIds } },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        name: true,
        _count: { select: { students: true, materials: true } },
      },
    }),
    prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, name: true, colorKey: true, iconKey: true },
    }),
    prisma.learningMaterial.count({ where: { uploadedById: user.id } }),
    prisma.examination.count({ where: { createdById: user.id } }),
    prisma.studentProfile.count({ where: { classId: { in: classIds } } }),
    prisma.learningMaterial.findMany({
      where: { uploadedById: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        subject: { select: { name: true } },
        schoolClass: { select: { name: true } },
      },
    }),
    prisma.result.findMany({
      where: { classId: { in: classIds } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      include: {
        student: { select: { fullName: true, username: true } },
        exam: { select: { title: true } },
      },
    }),
  ]);

  const counts = Object.fromEntries(
    taskCounts.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<string, number>>;

  return {
    tasks,
    taskCounts: {
      pending: counts[TASK_STATUS.PENDING] ?? 0,
      inProgress: counts[TASK_STATUS.IN_PROGRESS] ?? 0,
      completed: counts[TASK_STATUS.COMPLETED] ?? 0,
    },
    classes,
    subjects,
    materialsUploaded,
    examsManaged,
    studentCount,
    recentMaterials,
    recentResults,
  };
}

// -----------------------------------------------------------------------------
// Students
// -----------------------------------------------------------------------------

export interface StudentQuery {
  search?: string;
  classId?: string;
  status?: 'active' | 'disabled' | 'awaiting' | 'activated';
  page?: number;
  pageSize?: number;
}

export async function listStudents(user: AuthUser, query: StudentQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 20));

  const scope = classScopeFilter(user);

  const where = {
    ...(query.classId ? { classId: query.classId } : scope),
    ...(query.status === 'awaiting' ? { isActivated: false } : {}),
    ...(query.status === 'activated' ? { isActivated: true } : {}),
    ...(query.status === 'active' || query.status === 'disabled'
      ? {
          user: {
            status:
              query.status === 'active' ? USER_STATUS.ACTIVE : USER_STATUS.DISABLED,
          },
        }
      : {}),
    ...(query.search
      ? {
          user: {
            OR: [
              { fullName: { contains: query.search } },
              { username: { contains: query.search } },
              { email: { contains: query.search } },
            ],
          },
        }
      : {}),
  };

  const [total, students] = await Promise.all([
    prisma.studentProfile.count({ where }),
    prisma.studentProfile.findMany({
      where,
      orderBy: { user: { fullName: 'asc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            phone: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        schoolClass: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    students,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getStudentDetail(user: AuthUser, studentId: string) {
  const scope = classScopeFilter(user);

  const profile = await prisma.studentProfile.findFirst({
    where: { userId: studentId, ...scope },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          phone: true,
          status: true,
          mustChangePassword: true,
          lastLoginAt: true,
          lastLoginIp: true,
          createdAt: true,
          forumSuspendedUntil: true,
          failedLoginCount: true,
          lockedUntil: true,
        },
      },
      schoolClass: { select: { id: true, name: true } },
      activatedBy: { select: { fullName: true, username: true } },
    },
  });

  if (!profile) return null;

  const [results, progressCount, codes, recentLogins] = await Promise.all([
    prisma.result.findMany({
      where: { studentId },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      include: {
        exam: { select: { title: true } },
        subject: { select: { name: true } },
      },
    }),
    prisma.lessonProgress.count({
      where: { studentId, status: 'COMPLETED' },
    }),
    prisma.accessCode.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { createdBy: { select: { fullName: true, username: true } } },
    }),
    prisma.loginAttempt.findMany({
      where: { userId: studentId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  return { profile, results, progressCount, codes, recentLogins };
}
