/**
 * Single source of truth for every enumerated value in the domain.
 *
 * The Prisma schema stores these as plain strings (so the same schema runs on
 * PostgreSQL and SQLite). That trade means the *application* is responsible for
 * validity, so every enumerated column is defined here once, re-used by the Zod
 * schemas, and surfaced to the UI through the LABELS maps.
 *
 * This module is safe to import from client components — it contains no
 * secrets and no server-only imports.
 */

// -----------------------------------------------------------------------------
// Roles
// -----------------------------------------------------------------------------

export const ROLES = {
  STUDENT: 'STUDENT',
  MINI_ADMIN: 'MINI_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];
export const ROLE_KEYS = Object.values(ROLES) as RoleKey[];

export const ROLE_LABELS: Record<RoleKey, string> = {
  STUDENT: 'Student',
  MINI_ADMIN: 'Mini Admin',
  SUPER_ADMIN: 'Super Admin',
};

export const STAFF_ROLES: RoleKey[] = [ROLES.MINI_ADMIN, ROLES.SUPER_ADMIN];

// -----------------------------------------------------------------------------
// Permissions
// -----------------------------------------------------------------------------

export const PERMISSIONS = {
  MANAGE_STUDENTS: 'manage_students',
  MANAGE_ADMINS: 'manage_admins',
  MANAGE_CLASSES: 'manage_classes',
  MANAGE_SUBJECTS: 'manage_subjects',
  UPLOAD_MATERIALS: 'upload_materials',
  MANAGE_EXAMS: 'manage_exams',
  VIEW_RESULTS: 'view_results',
  MANAGE_FORUM: 'manage_forum',
  MANAGE_TASKS: 'manage_tasks',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_CODES: 'manage_codes',
  MANAGE_SETTINGS: 'manage_settings',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const PERMISSION_KEYS = Object.values(PERMISSIONS) as PermissionKey[];

export interface PermissionDefinition {
  key: PermissionKey;
  name: string;
  description: string;
  category: 'people' | 'academics' | 'content' | 'assessment' | 'community' | 'system';
  /** Permissions a Super Admin may never delegate to a Mini Admin. */
  superAdminOnly?: boolean;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: PERMISSIONS.MANAGE_STUDENTS,
    name: 'Manage students',
    description: 'View, edit, enable and disable student accounts.',
    category: 'people',
  },
  {
    key: PERMISSIONS.MANAGE_ADMINS,
    name: 'Manage administrators',
    description:
      'Create Mini Admins, assign their permissions and enable or disable their accounts.',
    category: 'people',
    superAdminOnly: true,
  },
  {
    key: PERMISSIONS.MANAGE_CLASSES,
    name: 'Manage classes',
    description: 'Create, rename, deactivate classes and assign students to them.',
    category: 'academics',
  },
  {
    key: PERMISSIONS.MANAGE_SUBJECTS,
    name: 'Manage subjects',
    description: 'Create and edit subjects, topics and their class mappings.',
    category: 'academics',
  },
  {
    key: PERMISSIONS.UPLOAD_MATERIALS,
    name: 'Upload learning materials',
    description: 'Upload, publish, edit and remove lesson materials.',
    category: 'content',
  },
  {
    key: PERMISSIONS.MANAGE_EXAMS,
    name: 'Manage examinations',
    description: 'Import DOCX question papers, create, publish and close examinations.',
    category: 'assessment',
  },
  {
    key: PERMISSIONS.VIEW_RESULTS,
    name: 'View results',
    description: 'View student, class, subject and examination performance data.',
    category: 'assessment',
  },
  {
    key: PERMISSIONS.MANAGE_FORUM,
    name: 'Moderate the forum',
    description: 'Hide posts, lock and pin discussions, and review reports.',
    category: 'community',
  },
  {
    key: PERMISSIONS.MANAGE_TASKS,
    name: 'Manage tasks',
    description: 'Create and assign administrative tasks to other administrators.',
    category: 'system',
  },
  {
    key: PERMISSIONS.VIEW_AUDIT_LOGS,
    name: 'View audit logs',
    description: 'Read the immutable record of security-relevant actions.',
    category: 'system',
    superAdminOnly: true,
  },
  {
    key: PERMISSIONS.MANAGE_CODES,
    name: 'Manage access codes',
    description: 'Generate, revoke and regenerate student activation codes.',
    category: 'people',
  },
  {
    key: PERMISSIONS.MANAGE_SETTINGS,
    name: 'Manage system settings',
    description: 'Change platform-wide configuration.',
    category: 'system',
    superAdminOnly: true,
  },
];

/** Permissions a Mini Admin is allowed to hold at all. */
export const DELEGATABLE_PERMISSIONS: PermissionKey[] = PERMISSION_DEFINITIONS.filter(
  (p) => !p.superAdminOnly,
).map((p) => p.key);

/** Default permission set granted to a freshly created Mini Admin. */
export const DEFAULT_MINI_ADMIN_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.UPLOAD_MATERIALS,
  PERMISSIONS.VIEW_RESULTS,
];

// -----------------------------------------------------------------------------
// Account status
// -----------------------------------------------------------------------------

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const STUDENT_TYPES = {
  PRIMARY: 'PRIMARY',
  SECONDARY: 'SECONDARY',
} as const;
export type StudentType = (typeof STUDENT_TYPES)[keyof typeof STUDENT_TYPES];
export const STUDENT_TYPE_KEYS = Object.values(STUDENT_TYPES) as StudentType[];

export const CLASS_LEVELS = STUDENT_TYPES;
export type ClassLevel = StudentType;

// -----------------------------------------------------------------------------
// Learning materials
// -----------------------------------------------------------------------------

export const MATERIAL_TYPES = {
  PDF: 'PDF',
  PPTX: 'PPTX',
  DOCX: 'DOCX',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
} as const;
export type MaterialType = (typeof MATERIAL_TYPES)[keyof typeof MATERIAL_TYPES];
export const MATERIAL_TYPE_KEYS = Object.values(MATERIAL_TYPES) as MaterialType[];

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  PDF: 'PDF document',
  PPTX: 'Presentation',
  DOCX: 'Word document',
  VIDEO: 'Video',
  AUDIO: 'Audio',
};

export const PUBLISH_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PublishStatus = (typeof PUBLISH_STATUS)[keyof typeof PUBLISH_STATUS];

export const LESSON_PROGRESS_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type LessonProgressStatus =
  (typeof LESSON_PROGRESS_STATUS)[keyof typeof LESSON_PROGRESS_STATUS];

// -----------------------------------------------------------------------------
// Access codes
// -----------------------------------------------------------------------------

export const ACCESS_CODE_STATUS = {
  ACTIVE: 'ACTIVE',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;
export type AccessCodeStatus =
  (typeof ACCESS_CODE_STATUS)[keyof typeof ACCESS_CODE_STATUS];

export const ACCESS_CODE_STATUS_LABELS: Record<AccessCodeStatus, string> = {
  ACTIVE: 'Active',
  USED: 'Used',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

// -----------------------------------------------------------------------------
// Examinations
// -----------------------------------------------------------------------------

export const EXAM_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
} as const;
export type ExamStatus = (typeof EXAM_STATUS)[keyof typeof EXAM_STATUS];

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
};

export const ATTEMPT_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  AUTO_SUBMITTED: 'AUTO_SUBMITTED',
  ABANDONED: 'ABANDONED',
} as const;
export type AttemptStatus = (typeof ATTEMPT_STATUS)[keyof typeof ATTEMPT_STATUS];

/** Attempt states that count against the attempt limit. */
export const FINISHED_ATTEMPT_STATUSES: AttemptStatus[] = [
  ATTEMPT_STATUS.SUBMITTED,
  ATTEMPT_STATUS.AUTO_SUBMITTED,
];

export const EXAM_IMPORT_STATUS = {
  PARSED: 'PARSED',
  FAILED: 'FAILED',
  COMMITTED: 'COMMITTED',
  DISCARDED: 'DISCARDED',
} as const;
export type ExamImportStatus =
  (typeof EXAM_IMPORT_STATUS)[keyof typeof EXAM_IMPORT_STATUS];

/**
 * Grade bands. Percentage is inclusive of `min`.
 * Kept in code (not settings) so historical results can never be re-graded by
 * an unrelated configuration change — the grade is written into the Result row.
 */
export const GRADE_BANDS = [
  { min: 75, grade: 'A', label: 'Excellent' },
  { min: 65, grade: 'B', label: 'Very good' },
  { min: 55, grade: 'C', label: 'Good' },
  { min: 45, grade: 'D', label: 'Fair' },
  { min: 40, grade: 'E', label: 'Pass' },
  { min: 0, grade: 'F', label: 'Fail' },
] as const;

export function gradeForPercentage(percentage: number): string {
  const band = GRADE_BANDS.find((b) => percentage >= b.min);
  return band ? band.grade : 'F';
}

// -----------------------------------------------------------------------------
// Forum
// -----------------------------------------------------------------------------

export const CONTENT_STATUS = {
  VISIBLE: 'VISIBLE',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED',
} as const;
export type ContentStatus = (typeof CONTENT_STATUS)[keyof typeof CONTENT_STATUS];

export const REPORT_STATUS = {
  OPEN: 'OPEN',
  ACTIONED: 'ACTIONED',
  DISMISSED: 'DISMISSED',
} as const;
export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

// -----------------------------------------------------------------------------
// Tasks
// -----------------------------------------------------------------------------

export const TASK_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];
export const TASK_PRIORITY_KEYS = Object.values(TASK_PRIORITY) as TaskPriority[];

export const TASK_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
export const TASK_STATUS_KEYS = Object.values(TASK_STATUS) as TaskStatus[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------

export const NOTIFICATION_TYPES = {
  LESSON: 'LESSON',
  EXAM: 'EXAM',
  RESULT: 'RESULT',
  FORUM: 'FORUM',
  TASK: 'TASK',
  ACCOUNT: 'ACCOUNT',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
} as const;
export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// -----------------------------------------------------------------------------
// Audit log actions
// -----------------------------------------------------------------------------

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',
  ACCOUNT_LOCKED: 'auth.account.locked',
  SESSION_REVOKED: 'auth.session.revoked',

  USER_REGISTERED: 'user.registered',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DISABLED: 'user.disabled',
  USER_ENABLED: 'user.enabled',
  USER_DELETED: 'user.deleted',

  PASSWORD_CHANGED: 'password.changed',
  PASSWORD_RESET_REQUESTED: 'password.reset.requested',
  PASSWORD_RESET_COMPLETED: 'password.reset.completed',
  PASSWORD_RESET_BY_ADMIN: 'password.reset.by_admin',

  PERMISSION_CHANGED: 'permission.changed',
  ROLE_CHANGED: 'role.changed',
  ADMIN_ASSIGNMENT_CHANGED: 'admin.assignment.changed',

  STUDENT_ACTIVATED: 'student.activated',
  STUDENT_DEACTIVATED: 'student.deactivated',
  CODE_GENERATED: 'code.generated',
  CODE_REDEEMED: 'code.redeemed',
  CODE_REDEEM_FAILED: 'code.redeem.failed',
  CODE_REVOKED: 'code.revoked',
  CODE_REGENERATED: 'code.regenerated',

  CLASS_CREATED: 'class.created',
  CLASS_UPDATED: 'class.updated',
  CLASS_DELETED: 'class.deleted',
  SUBJECT_CREATED: 'subject.created',
  SUBJECT_UPDATED: 'subject.updated',
  SUBJECT_DELETED: 'subject.deleted',
  TOPIC_CREATED: 'topic.created',
  TOPIC_UPDATED: 'topic.updated',
  TOPIC_DELETED: 'topic.deleted',

  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  FILE_DOWNLOADED: 'file.downloaded',
  MATERIAL_CREATED: 'material.created',
  MATERIAL_UPDATED: 'material.updated',
  MATERIAL_DELETED: 'material.deleted',

  EXAM_IMPORTED: 'exam.imported',
  EXAM_IMPORT_FAILED: 'exam.import.failed',
  EXAM_CREATED: 'exam.created',
  EXAM_UPDATED: 'exam.updated',
  EXAM_PUBLISHED: 'exam.published',
  EXAM_CLOSED: 'exam.closed',
  EXAM_DELETED: 'exam.deleted',
  EXAM_ATTEMPT_STARTED: 'exam.attempt.started',
  EXAM_SUBMITTED: 'exam.submitted',
  EXAM_AUTO_SUBMITTED: 'exam.auto_submitted',

  FORUM_POST_CREATED: 'forum.post.created',
  FORUM_REPLY_CREATED: 'forum.reply.created',
  FORUM_MODERATED: 'forum.moderated',
  FORUM_REPORTED: 'forum.reported',
  FORUM_USER_SUSPENDED: 'forum.user.suspended',

  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',

  SETTINGS_UPDATED: 'settings.updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;
export type AuditSeverity = (typeof AUDIT_SEVERITY)[keyof typeof AUDIT_SEVERITY];

// -----------------------------------------------------------------------------
// System setting keys
// -----------------------------------------------------------------------------

export const SETTING_KEYS = {
  ALLOW_REGISTRATION: 'allow_registration',
  REQUIRE_ACTIVATION: 'require_activation',
  FORUM_ENABLED: 'forum_enabled',
  FORUM_CROSS_CLASS: 'forum_cross_class',
  SHOW_CORRECT_ANSWERS_DEFAULT: 'show_correct_answers_default',
  ACCESS_CODE_VALIDITY_DAYS: 'access_code_validity_days',
  PLATFORM_ANNOUNCEMENT: 'platform_announcement',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface SettingDefinition {
  key: SettingKey;
  label: string;
  description: string;
  valueType: 'string' | 'number' | 'boolean';
  category: string;
  defaultValue: string;
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: SETTING_KEYS.ALLOW_REGISTRATION,
    label: 'Allow student self-registration',
    description: 'When off, only administrators can create student accounts.',
    valueType: 'boolean',
    category: 'access',
    defaultValue: 'true',
  },
  {
    key: SETTING_KEYS.REQUIRE_ACTIVATION,
    label: 'Require activation code',
    description:
      'When on, a registered student cannot open lessons or examinations until an access code is redeemed.',
    valueType: 'boolean',
    category: 'access',
    defaultValue: 'true',
  },
  {
    key: SETTING_KEYS.FORUM_ENABLED,
    label: 'Enable the forum',
    description: 'Turns class discussion boards on or off platform-wide.',
    valueType: 'boolean',
    category: 'community',
    defaultValue: 'true',
  },
  {
    key: SETTING_KEYS.FORUM_CROSS_CLASS,
    label: 'Allow cross-class forum access',
    description:
      'When off, a student may only read and post in the forum for their own class.',
    valueType: 'boolean',
    category: 'community',
    defaultValue: 'false',
  },
  {
    key: SETTING_KEYS.SHOW_CORRECT_ANSWERS_DEFAULT,
    label: 'Reveal correct answers by default',
    description:
      'Default for newly created examinations. Each examination can override this.',
    valueType: 'boolean',
    category: 'assessment',
    defaultValue: 'false',
  },
  {
    key: SETTING_KEYS.ACCESS_CODE_VALIDITY_DAYS,
    label: 'Access code validity (days)',
    description: 'How long a newly generated activation code remains usable.',
    valueType: 'number',
    category: 'access',
    defaultValue: '30',
  },
  {
    key: SETTING_KEYS.PLATFORM_ANNOUNCEMENT,
    label: 'Platform announcement',
    description: 'Shown as a banner on every dashboard. Leave empty to hide.',
    valueType: 'string',
    category: 'general',
    defaultValue: '',
  },
];

// -----------------------------------------------------------------------------
// Upload limits & accepted types
// -----------------------------------------------------------------------------

export interface UploadKindSpec {
  materialType: MaterialType;
  extensions: string[];
  mimeTypes: string[];
  /** Per-file limit in megabytes. */
  maxSizeMb: number;
}

export const UPLOAD_SPECS: UploadKindSpec[] = [
  {
    materialType: MATERIAL_TYPES.PDF,
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxSizeMb: 50,
  },
  {
    materialType: MATERIAL_TYPES.PPTX,
    extensions: ['.pptx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    maxSizeMb: 50,
  },
  {
    materialType: MATERIAL_TYPES.DOCX,
    extensions: ['.docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxSizeMb: 25,
  },
  {
    materialType: MATERIAL_TYPES.VIDEO,
    extensions: ['.mp4'],
    mimeTypes: ['video/mp4'],
    maxSizeMb: 500,
  },
  {
    materialType: MATERIAL_TYPES.AUDIO,
    extensions: ['.mp3'],
    mimeTypes: ['audio/mpeg', 'audio/mp3'],
    maxSizeMb: 100,
  },
];

export const THUMBNAIL_SPEC = {
  extensions: ['.png', '.jpg', '.jpeg', '.webp'],
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  maxSizeMb: 4,
};

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// -----------------------------------------------------------------------------
// Branding
// -----------------------------------------------------------------------------

export const BRAND = {
  name: 'Fodan College',
  motto: '…that they might have it abundantly',
  logo: '/brand/fodan-logo.png',
  email: 'fodancollege@gmail.com',
  phone: '08067578112',
  proprietor: 'Banjo Folahan Daniel',
} as const;

// -----------------------------------------------------------------------------
// Pagination
// -----------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
