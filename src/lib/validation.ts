import { z } from 'zod';
import {
  ACCESS_CODE_STATUS,
  CONTENT_STATUS,
  EXAM_STATUS,
  MATERIAL_TYPE_KEYS,
  PERMISSION_KEYS,
  PUBLISH_STATUS,
  ROLES,
  STUDENT_TYPE_KEYS,
  TASK_PRIORITY_KEYS,
  TASK_STATUS_KEYS,
  USER_STATUS,
} from './constants';
import { PASSWORD_MIN_LENGTH } from './password-policy';
import { sanitiseLine, sanitiseRichText, sanitiseSearch } from './sanitize';

/**
 * Every externally supplied value is parsed by one of these schemas before it
 * reaches a query. Validation and sanitisation happen together — the `.transform`
 * calls mean a handler cannot accidentally use the raw string.
 *
 * Safe to import from client components (used for inline form validation), so
 * nothing server-only may appear here.
 */

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

export const idSchema = z
  .string()
  .trim()
  .min(1, 'Required.')
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid identifier.');

export const optionalId = z
  .union([idSchema, z.literal(''), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

export const lineSchema = (max = 200, label = 'This field') =>
  z
    .string()
    .transform((value) => sanitiseLine(value, max))
    .pipe(z.string().min(1, `${label} is required.`).max(max));

export const optionalLine = (max = 200) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const cleaned = sanitiseLine(value ?? '', max);
      return cleaned === '' ? null : cleaned;
    });

export const richTextSchema = (max = 20_000, label = 'This field') =>
  z
    .string()
    .transform((value) => sanitiseRichText(value, max))
    .pipe(z.string().min(1, `${label} is required.`).max(max));

export const optionalRichText = (max = 20_000) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const cleaned = sanitiseRichText(value ?? '', max);
      return cleaned === '' ? null : cleaned;
    });

export const searchSchema = z
  .string()
  .optional()
  .transform((value) => sanitiseSearch(value ?? ''))
  .transform((value) => (value === '' ? undefined : value));

export const booleanSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean'
      ? value
      : ['1', 'true', 'on', 'yes'].includes(value.toLowerCase()),
  );

export const intSchema = (min: number, max: number, label = 'Value') =>
  z
    .union([z.number(), z.string()])
    .transform((value) => (typeof value === 'number' ? value : Number(value.trim())))
    .pipe(
      z
        .number({ invalid_type_error: `${label} must be a number.` })
        .int(`${label} must be a whole number.`)
        .min(min, `${label} must be at least ${min}.`)
        .max(max, `${label} must be at most ${max}.`),
    );

export const dateSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((date) => !Number.isNaN(date.getTime()), 'Enter a valid date.');

export const optionalDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const paginationSchema = z.object({
  page: intSchema(1, 100_000, 'Page').optional().default(1),
  pageSize: intSchema(5, 100, 'Page size').optional().default(20),
});

// -----------------------------------------------------------------------------
// Identity fields
// -----------------------------------------------------------------------------

export const usernameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(3, 'Username must be at least 3 characters.')
      .max(32, 'Username must be at most 32 characters.')
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
        'Use letters, numbers, dots, dashes and underscores only.',
      ),
  );

export const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().email('Enter a valid email address.').max(150));

export const optionalEmail = z
  .string()
  .optional()
  .transform((value) => (value ?? '').trim().toLowerCase())
  .transform((value) => (value === '' ? null : value))
  .refine(
    (value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value),
    'Enter a valid email address.',
  );

/**
 * Nigerian mobile numbers, stored canonically as +234XXXXXXXXXX so that a number
 * entered as 08067578112 and +2348067578112 cannot create two accounts.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^\+234\d{10}$/.test(digits)) return digits;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\+\d{8,15}$/.test(digits)) return digits; // other international formats
  return null;
}

export const phoneSchema = z
  .string()
  .transform((value) => normalisePhone(value))
  .refine((value): value is string => value !== null, 'Enter a valid phone number.');

export const optionalPhone = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? normalisePhone(value) : null))
  .refine(
    (value) => value === null || /^\+\d{8,15}$/.test(value),
    'Enter a valid phone number.',
  );

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(72, 'Password must be at most 72 characters.');

export const fullNameSchema = z
  .string()
  .transform((value) => sanitiseLine(value, 120))
  .pipe(
    z
      .string()
      .min(3, 'Enter your full name.')
      .max(120)
      .regex(/^[\p{L}][\p{L}\s'.-]*$/u, 'Use letters, spaces, apostrophes and hyphens only.'),
  );

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------

export const loginSchema = z.object({
  identifier: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(3, 'Enter your username, email or phone number.').max(150)),
  password: z.string().min(1, 'Enter your password.').max(200),
  next: z
    .string()
    .optional()
    .transform((value) => {
      // Only same-site relative paths may be used as a post-login destination.
      if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
      return value.slice(0, 300);
    }),
});

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    username: usernameSchema,
    email: optionalEmail,
    phone: optionalPhone,
    password: passwordSchema,
    confirmPassword: z.string(),
    classId: optionalId,
    studentType: z.enum(STUDENT_TYPE_KEYS as [string, ...string[]]),
    guardianName: optionalLine(120),
    guardianPhone: optionalPhone,
    acceptTerms: booleanSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Both passwords must match.',
    path: ['confirmPassword'],
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: 'Provide an email address or a phone number.',
    path: ['email'],
  })
  .refine((data) => data.acceptTerms === true, {
    message: 'You must accept the terms to register.',
    path: ['acceptTerms'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Both passwords must match.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Choose a password different from your current one.',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({
  identifier: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(3, 'Enter your username, email or phone number.').max(150)),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'This reset link is not valid.').max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Both passwords must match.',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  guardianName: optionalLine(120),
  guardianPhone: optionalPhone,
  dateOfBirth: optionalDate,
  gender: z
    .string()
    .optional()
    .transform((value) => {
      const cleaned = sanitiseLine(value ?? '', 20);
      return cleaned === '' ? null : cleaned;
    }),
});

// -----------------------------------------------------------------------------
// Administration: users, roles, permissions
// -----------------------------------------------------------------------------

export const createAdminSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  email: emailSchema,
  phone: optionalPhone,
  temporaryPassword: passwordSchema,
  permissions: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((value) => {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      return list.filter((key): key is string =>
        (PERMISSION_KEYS as readonly string[]).includes(key),
      );
    }),
  classIds: idListSchema(),
  subjectIds: idListSchema(),
});

export const updateAdminPermissionsSchema = z.object({
  userId: idSchema,
  permissions: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((value) => {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      return list.filter((key): key is string =>
        (PERMISSION_KEYS as readonly string[]).includes(key),
      );
    }),
});

export const updateAdminAssignmentsSchema = z.object({
  userId: idSchema,
  classIds: idListSchema(),
  subjectIds: idListSchema(),
});

export const setUserStatusSchema = z.object({
  userId: idSchema,
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.DISABLED]),
  reason: optionalLine(300),
});

export const adminResetPasswordSchema = z.object({
  userId: idSchema,
  temporaryPassword: passwordSchema,
});

export const createStudentSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  temporaryPassword: passwordSchema,
  classId: idSchema,
  studentType: z.enum(STUDENT_TYPE_KEYS as [string, ...string[]]),
  admissionNumber: optionalLine(40),
  guardianName: optionalLine(120),
  guardianPhone: optionalPhone,
});

export const updateStudentSchema = z.object({
  userId: idSchema,
  fullName: fullNameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  classId: optionalId,
  studentType: z.enum(STUDENT_TYPE_KEYS as [string, ...string[]]),
  admissionNumber: optionalLine(40),
  guardianName: optionalLine(120),
  guardianPhone: optionalPhone,
});

export const selectClassSchema = z.object({
  classId: idSchema,
});

function idListSchema() {
  return z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((value) => {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      return list
        .map((item) => item.trim())
        .filter((item) => /^[A-Za-z0-9_-]{1,64}$/.test(item));
    });
}

export const idListField = idListSchema;

// -----------------------------------------------------------------------------
// Academic structure
// -----------------------------------------------------------------------------

export const classSchema = z.object({
  id: optionalId,
  name: lineSchema(60, 'Class name'),
  level: z.enum(STUDENT_TYPE_KEYS as [string, ...string[]]),
  description: optionalLine(300),
  orderIndex: intSchema(0, 999, 'Order').optional().default(0),
  isActive: booleanSchema.optional().default(true),
  subjectIds: idListSchema(),
});

export const subjectSchema = z.object({
  id: optionalId,
  name: lineSchema(80, 'Subject name'),
  code: z
    .string()
    .transform((value) => sanitiseLine(value, 12).toUpperCase().replace(/\s+/g, ''))
    .pipe(
      z
        .string()
        .min(2, 'Subject code is required.')
        .max(12)
        .regex(/^[A-Z0-9]+$/, 'Use capital letters and numbers only.'),
    ),
  description: optionalLine(300),
  colorKey: z
    .string()
    .optional()
    .transform((value) => sanitiseLine(value ?? 'blue', 20) || 'blue'),
  iconKey: z
    .string()
    .optional()
    .transform((value) => sanitiseLine(value ?? 'book', 20) || 'book'),
  orderIndex: intSchema(0, 999, 'Order').optional().default(0),
  isActive: booleanSchema.optional().default(true),
  classIds: idListSchema(),
});

export const topicSchema = z.object({
  id: optionalId,
  title: lineSchema(150, 'Topic title'),
  description: optionalLine(600),
  subjectId: idSchema,
  classId: idSchema,
  orderIndex: intSchema(0, 999, 'Order').optional().default(0),
  isPublished: booleanSchema.optional().default(true),
});

// -----------------------------------------------------------------------------
// Learning materials
// -----------------------------------------------------------------------------

export const materialMetadataSchema = z.object({
  id: optionalId,
  title: lineSchema(150, 'Title'),
  description: optionalRichText(2000),
  topicId: idSchema,
  type: z.enum(MATERIAL_TYPE_KEYS as [string, ...string[]]),
  status: z
    .enum([PUBLISH_STATUS.DRAFT, PUBLISH_STATUS.PUBLISHED, PUBLISH_STATUS.ARCHIVED])
    .optional()
    .default(PUBLISH_STATUS.DRAFT),
  orderIndex: intSchema(0, 999, 'Order').optional().default(0),
  downloadable: booleanSchema.optional().default(true),
});

export const progressUpdateSchema = z.object({
  materialId: idSchema,
  progressPercent: intSchema(0, 100, 'Progress').optional().default(0),
  lastPositionSeconds: intSchema(0, 86_400, 'Position').optional().default(0),
  completed: booleanSchema.optional().default(false),
});

// -----------------------------------------------------------------------------
// Access codes
// -----------------------------------------------------------------------------

export const generateCodeSchema = z.object({
  studentId: idSchema,
  classId: optionalId,
  subjectId: optionalId,
  validityDays: intSchema(1, 365, 'Validity').optional().default(30),
  note: optionalLine(200),
});

export const bulkGenerateCodesSchema = z.object({
  studentIds: idListSchema().refine(
    (ids) => ids.length > 0 && ids.length <= 200,
    'Select between 1 and 200 students.',
  ),
  classId: optionalId,
  validityDays: intSchema(1, 365, 'Validity').optional().default(30),
  note: optionalLine(200),
});

export const revokeCodeSchema = z.object({
  codeId: idSchema,
  reason: optionalLine(200),
});

export const redeemCodeSchema = z.object({
  code: z
    .string()
    .transform((value) => value.trim().toUpperCase().replace(/\s+/g, ''))
    .pipe(
      z
        .string()
        .min(6, 'Enter the full activation code.')
        .max(40, 'That code is too long.')
        .regex(/^[A-Z0-9-]+$/, 'Activation codes contain letters, numbers and dashes only.'),
    ),
});

export const codeFilterSchema = z.object({
  status: z
    .enum([
      ACCESS_CODE_STATUS.ACTIVE,
      ACCESS_CODE_STATUS.USED,
      ACCESS_CODE_STATUS.EXPIRED,
      ACCESS_CODE_STATUS.REVOKED,
    ])
    .optional(),
  classId: optionalId,
  search: searchSchema,
  page: intSchema(1, 10_000, 'Page').optional().default(1),
});

// -----------------------------------------------------------------------------
// Examinations
// -----------------------------------------------------------------------------

export const examSettingsSchema = z.object({
  id: optionalId,
  title: lineSchema(150, 'Examination title'),
  subjectId: idSchema,
  classId: idSchema,
  instructions: optionalRichText(4000),
  durationMins: intSchema(1, 600, 'Duration'),
  passMark: intSchema(0, 100, 'Pass mark'),
  attemptLimit: intSchema(1, 10, 'Attempt limit'),
  availableFrom: optionalDate,
  availableTo: optionalDate,
  shuffleQuestions: booleanSchema.optional().default(true),
  shuffleOptions: booleanSchema.optional().default(false),
  showResultInstantly: booleanSchema.optional().default(true),
  showCorrectAnswers: booleanSchema.optional().default(false),
});

export const examStatusSchema = z.object({
  examId: idSchema,
  status: z.enum([EXAM_STATUS.DRAFT, EXAM_STATUS.PUBLISHED, EXAM_STATUS.CLOSED]),
});

export const commitImportSchema = z.object({
  importId: idSchema,
  title: lineSchema(150, 'Examination title'),
  subjectId: idSchema,
  classId: idSchema,
  instructions: optionalRichText(4000),
  durationMins: intSchema(1, 600, 'Duration'),
  passMark: intSchema(0, 100, 'Pass mark'),
  attemptLimit: intSchema(1, 10, 'Attempt limit'),
  marksPerQuestion: intSchema(1, 20, 'Marks per question').optional().default(1),
  availableFrom: optionalDate,
  availableTo: optionalDate,
  shuffleQuestions: booleanSchema.optional().default(true),
  shuffleOptions: booleanSchema.optional().default(false),
  showCorrectAnswers: booleanSchema.optional().default(false),
});

export const startAttemptSchema = z.object({
  examId: idSchema,
});

export const saveAnswerSchema = z.object({
  attemptId: idSchema,
  questionId: idSchema,
  optionId: z
    .union([idSchema, z.literal(''), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
});

export const submitAttemptSchema = z.object({
  attemptId: idSchema,
  /** Optional final flush of answers, so a submit never loses the last click. */
  answers: z
    .string()
    .optional()
    .transform((value) => value ?? '[]'),
});

// -----------------------------------------------------------------------------
// Forum
// -----------------------------------------------------------------------------

export const forumCategorySchema = z.object({
  id: optionalId,
  name: lineSchema(80, 'Category name'),
  description: optionalLine(300),
  classId: optionalId,
  isGlobal: booleanSchema.optional().default(false),
  isActive: booleanSchema.optional().default(true),
  orderIndex: intSchema(0, 999, 'Order').optional().default(0),
});

export const forumPostSchema = z.object({
  categoryId: idSchema,
  title: lineSchema(150, 'Title'),
  body: richTextSchema(10_000, 'Message'),
});

export const forumReplySchema = z.object({
  postId: idSchema,
  parentReplyId: optionalId,
  body: richTextSchema(5000, 'Reply'),
});

export const forumModerationSchema = z.object({
  targetType: z.enum(['post', 'reply']),
  targetId: idSchema,
  action: z.enum(['hide', 'restore', 'pin', 'unpin', 'lock', 'unlock', 'delete']),
  reason: optionalLine(300),
});

export const forumReportSchema = z.object({
  targetType: z.enum(['post', 'reply']),
  targetId: idSchema,
  reason: lineSchema(300, 'Reason'),
});

export const forumSuspendSchema = z.object({
  userId: idSchema,
  days: intSchema(0, 365, 'Days'),
  reason: optionalLine(300),
});

export const contentStatusSchema = z.enum([
  CONTENT_STATUS.VISIBLE,
  CONTENT_STATUS.HIDDEN,
  CONTENT_STATUS.DELETED,
]);

// -----------------------------------------------------------------------------
// Tasks
// -----------------------------------------------------------------------------

export const taskSchema = z.object({
  id: optionalId,
  title: lineSchema(150, 'Task title'),
  description: optionalRichText(4000),
  assignedToId: idSchema,
  priority: z.enum(TASK_PRIORITY_KEYS as [string, ...string[]]),
  dueDate: optionalDate,
});

export const taskStatusSchema = z.object({
  taskId: idSchema,
  status: z.enum(TASK_STATUS_KEYS as [string, ...string[]]),
  note: optionalLine(500),
});

// -----------------------------------------------------------------------------
// Settings & notifications
// -----------------------------------------------------------------------------

export const settingsSchema = z.record(z.string(), z.string());

export const announcementSchema = z.object({
  title: lineSchema(120, 'Title'),
  body: richTextSchema(2000, 'Message'),
  audience: z.enum(['ALL', 'STUDENTS', 'ADMINS']),
  classId: optionalId,
});

export const notificationReadSchema = z.object({
  notificationId: optionalId,
  all: booleanSchema.optional().default(false),
});

export const roleSchema = z.enum([ROLES.STUDENT, ROLES.MINI_ADMIN, ROLES.SUPER_ADMIN]);
