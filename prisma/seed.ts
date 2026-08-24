/**
 * Database seed.
 *
 * Two clearly separated layers:
 *
 *  1. REFERENCE DATA — roles, permissions, settings, classes, subjects, class
 *     forums and the bootstrap Super Admin. Safe and expected in production.
 *     Everything is idempotent (upsert by natural key), so re-running the seed
 *     after a schema change never duplicates or clobbers live data.
 *
 *  2. DEMONSTRATION DATA — sample administrators, students, topics and an
 *     examination. Written ONLY when SEED_DEMO=true, never in production, and
 *     every demo account is marked in its record so it can be identified and
 *     removed. Run `npm run db:seed` with SEED_DEMO=true for a populated
 *     development environment.
 *
 * The initial Super Admin password comes from SUPERADMIN_PASSWORD and is
 * immediately bcrypt-hashed; the account is flagged mustChangePassword so the
 * bootstrap credential cannot survive the first login.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

const prisma = new PrismaClient();

const DEMO = process.env.SEED_DEMO === 'true' && process.env.NODE_ENV !== 'production';
const BCRYPT_ROUNDS = Number.parseInt(process.env.PASSWORD_BCRYPT_ROUNDS ?? '12', 10);

// Mirrors src/lib/constants.ts. Duplicated deliberately: the seed runs through
// tsx outside Next's module graph, and importing 'server-only' modules there
// would fail. The test suite asserts the two lists stay in step.
const ROLE_DEFS = [
  {
    key: 'STUDENT',
    name: 'Student',
    description: 'Learns, takes examinations and takes part in the class forum.',
  },
  {
    key: 'MINI_ADMIN',
    name: 'Mini Admin',
    description: 'Carries out only the duties the Super Admin has assigned.',
  },
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full control of the platform.',
  },
];

const PERMISSION_DEFS = [
  ['manage_students', 'Manage students', 'View, edit, enable and disable student accounts.', 'people'],
  ['manage_admins', 'Manage administrators', 'Create Mini Admins and assign their permissions.', 'people'],
  ['manage_classes', 'Manage classes', 'Create, rename and deactivate classes.', 'academics'],
  ['manage_subjects', 'Manage subjects', 'Create and edit subjects and topics.', 'academics'],
  ['upload_materials', 'Upload learning materials', 'Upload, publish and remove lesson materials.', 'content'],
  ['manage_exams', 'Manage examinations', 'Import, create, publish and close examinations.', 'assessment'],
  ['view_results', 'View results', 'View student, class and subject performance.', 'assessment'],
  ['manage_forum', 'Moderate the forum', 'Hide posts, lock discussions and review reports.', 'community'],
  ['manage_tasks', 'Manage tasks', 'Create and assign administrative tasks.', 'system'],
  ['view_audit_logs', 'View audit logs', 'Read the immutable record of security-relevant actions.', 'system'],
  ['manage_codes', 'Manage access codes', 'Generate, revoke and regenerate activation codes.', 'people'],
  ['manage_settings', 'Manage system settings', 'Change platform-wide configuration.', 'system'],
] as const;

/** A newly created Mini Admin starts with these; the Super Admin adjusts. */
const MINI_ADMIN_DEFAULTS = ['upload_materials', 'view_results'];

const SETTING_DEFS = [
  ['allow_registration', 'true', 'boolean', 'access', 'Allow student self-registration.'],
  ['require_activation', 'true', 'boolean', 'access', 'Require an activation code before lessons open.'],
  ['forum_enabled', 'true', 'boolean', 'community', 'Turn class discussion boards on or off.'],
  ['forum_cross_class', 'false', 'boolean', 'community', 'Allow students to read other classes’ forums.'],
  ['show_correct_answers_default', 'false', 'boolean', 'assessment', 'Default answer visibility for new examinations.'],
  ['access_code_validity_days', '30', 'number', 'access', 'How long a new activation code remains usable.'],
  ['platform_announcement', '', 'string', 'general', 'Banner shown on every dashboard.'],
] as const;

const CLASS_DEFS = [
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    name: `Primary ${n}`,
    slug: `primary-${n}`,
    level: 'PRIMARY',
    orderIndex: n,
  })),
  { name: 'JSS 1', slug: 'jss-1', level: 'SECONDARY', orderIndex: 10 },
  { name: 'JSS 2', slug: 'jss-2', level: 'SECONDARY', orderIndex: 11 },
  { name: 'JSS 3', slug: 'jss-3', level: 'SECONDARY', orderIndex: 12 },
  { name: 'SS 1', slug: 'ss-1', level: 'SECONDARY', orderIndex: 13 },
  { name: 'SS 2', slug: 'ss-2', level: 'SECONDARY', orderIndex: 14 },
  { name: 'SS 3', slug: 'ss-3', level: 'SECONDARY', orderIndex: 15 },
];

const SUBJECT_DEFS = [
  {
    name: 'English Language',
    code: 'ENG',
    slug: 'english-language',
    colorKey: 'rose',
    iconKey: 'book-open',
    orderIndex: 1,
    description: 'Reading, writing, grammar, comprehension and composition.',
  },
  {
    name: 'Mathematics',
    code: 'MTH',
    slug: 'mathematics',
    colorKey: 'blue',
    iconKey: 'calculator',
    orderIndex: 2,
    description: 'Number, algebra, geometry, statistics and problem solving.',
  },
  {
    name: 'Computer Studies',
    code: 'CMP',
    slug: 'computer-studies',
    colorKey: 'violet',
    iconKey: 'monitor',
    orderIndex: 3,
    description: 'Computer fundamentals, software, hardware and safe computing.',
  },
  {
    name: 'Data Processing',
    code: 'DAP',
    slug: 'data-processing',
    colorKey: 'emerald',
    iconKey: 'database',
    orderIndex: 4,
    description: 'Data handling, spreadsheets, databases and information systems.',
  },
];

async function main() {
  console.log('\nFodan College — database seed');
  console.log('================================\n');

  const roles = await seedRoles();
  await seedPermissions(roles);
  await seedSettings();
  const classes = await seedClasses();
  const subjects = await seedSubjects();
  await mapSubjectsToClasses(classes, subjects);
  await seedForumCategories(classes);
  const superAdmin = await seedSuperAdmin(roles.SUPER_ADMIN);

  if (DEMO) {
    console.log('\nDemonstration data (SEED_DEMO=true)');
    console.log('-----------------------------------');
    await seedDemoData(roles, classes, subjects, superAdmin.id);
  } else {
    console.log(
      '\nSkipping demonstration data. Set SEED_DEMO=true to create sample accounts and content.',
    );
  }

  console.log('\nSeed complete.\n');
}

// -----------------------------------------------------------------------------
// Reference data
// -----------------------------------------------------------------------------

async function seedRoles() {
  const map: Record<string, string> = {};

  for (const role of ROLE_DEFS) {
    const record = await prisma.role.upsert({
      where: { key: role.key },
      create: { ...role, isSystem: true },
      update: { name: role.name, description: role.description },
    });
    map[role.key] = record.id;
  }

  console.log(`Roles                 ${ROLE_DEFS.length} ready`);
  return map as Record<'STUDENT' | 'MINI_ADMIN' | 'SUPER_ADMIN', string>;
}

async function seedPermissions(roles: Record<string, string>) {
  const ids: Record<string, string> = {};

  for (const [key, name, description, category] of PERMISSION_DEFS) {
    const record = await prisma.permission.upsert({
      where: { key },
      create: { key, name, description, category },
      update: { name, description, category },
    });
    ids[key] = record.id;
  }

  // The Super Admin role is granted everything explicitly as well as implicitly
  // in code, so the permissions screen shows an accurate picture.
  for (const [key] of PERMISSION_DEFS) {
    await linkRolePermission(roles.SUPER_ADMIN as string, ids[key] as string);
  }
  for (const key of MINI_ADMIN_DEFAULTS) {
    await linkRolePermission(roles.MINI_ADMIN as string, ids[key] as string);
  }

  console.log(`Permissions           ${PERMISSION_DEFS.length} ready`);
  return ids;
}

async function linkRolePermission(roleId: string, permissionId: string) {
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    create: { roleId, permissionId },
    update: {},
  });
}

async function seedSettings() {
  for (const [key, value, valueType, category, description] of SETTING_DEFS) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, valueType, category, description },
      // Never overwrite a value an administrator has chosen.
      update: { valueType, category, description },
    });
  }
  console.log(`Settings              ${SETTING_DEFS.length} ready`);
}

async function seedClasses() {
  const map: Record<string, string> = {};

  for (const definition of CLASS_DEFS) {
    const record = await prisma.schoolClass.upsert({
      where: { slug: definition.slug },
      create: definition,
      update: {
        name: definition.name,
        level: definition.level,
        orderIndex: definition.orderIndex,
      },
    });
    map[definition.slug] = record.id;
  }

  console.log(`Classes               ${CLASS_DEFS.length} ready`);
  return map;
}

async function seedSubjects() {
  const map: Record<string, string> = {};

  for (const definition of SUBJECT_DEFS) {
    const record = await prisma.subject.upsert({
      where: { code: definition.code },
      create: definition,
      update: {
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        colorKey: definition.colorKey,
        iconKey: definition.iconKey,
        orderIndex: definition.orderIndex,
      },
    });
    map[definition.slug] = record.id;
  }

  console.log(`Subjects              ${SUBJECT_DEFS.length} ready`);
  return map;
}

async function mapSubjectsToClasses(
  classes: Record<string, string>,
  subjects: Record<string, string>,
) {
  let count = 0;
  for (const classId of Object.values(classes)) {
    for (const subjectId of Object.values(subjects)) {
      await prisma.classSubject.upsert({
        where: { classId_subjectId: { classId, subjectId } },
        create: { classId, subjectId },
        update: {},
      });
      count += 1;
    }
  }
  console.log(`Class/subject links   ${count} ready`);
}

async function seedForumCategories(classes: Record<string, string>) {
  let count = 0;

  for (const [slug, classId] of Object.entries(classes)) {
    const schoolClass = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!schoolClass) continue;

    await prisma.forumCategory.upsert({
      where: { slug: `${slug}-forum` },
      create: {
        name: `${schoolClass.name} Forum`,
        slug: `${slug}-forum`,
        description: `Discussion board for ${schoolClass.name}. Ask questions and help one another.`,
        classId,
        orderIndex: schoolClass.orderIndex,
      },
      update: { name: `${schoolClass.name} Forum` },
    });
    count += 1;
  }

  await prisma.forumCategory.upsert({
    where: { slug: 'announcements' },
    create: {
      name: 'School Announcements',
      slug: 'announcements',
      description: 'Notices from the school. Read-only for students.',
      isGlobal: true,
      isLocked: true,
      orderIndex: 0,
    },
    update: {},
  });

  console.log(`Forum categories      ${count + 1} ready`);
}

async function seedSuperAdmin(roleId: string) {
  const username = process.env.SUPERADMIN_USERNAME?.trim() || 'FBanjo';
  const password = process.env.SUPERADMIN_PASSWORD?.trim();
  const email = process.env.SUPERADMIN_EMAIL?.trim() || null;
  const phone = process.env.SUPERADMIN_PHONE?.trim() || null;
  const fullName = process.env.SUPERADMIN_FULLNAME?.trim() || 'Super Administrator';

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    console.log(`Super Admin           "${username}" already exists — left untouched`);
    return existing;
  }

  if (!password) {
    throw new Error(
      'SUPERADMIN_PASSWORD is not set. Add it to .env before running the seed.\n' +
        'The value is hashed immediately and the account must change it at first login.',
    );
  }
  if (password.startsWith('CHANGE_ME')) {
    throw new Error('SUPERADMIN_PASSWORD still holds its placeholder value.');
  }

  const created = await prisma.user.create({
    data: {
      username,
      fullName,
      email,
      phone: phone ? normalisePhone(phone) : null,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      roleId,
      status: 'ACTIVE',
      // The bootstrap credential is single-use by policy: it opens the door once.
      mustChangePassword: true,
      emailVerifiedAt: email ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'user.created',
      actorUsername: 'system:seed',
      actorRole: 'SUPER_ADMIN',
      targetType: 'user',
      targetId: created.id,
      description: `Bootstrap Super Admin "${username}" created by the seed script.`,
      severity: 'CRITICAL',
    },
  });

  console.log(`Super Admin           "${username}" created (must change password at first login)`);
  return created;
}

function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^\+234\d{10}$/.test(digits)) return digits;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  return null;
}

// -----------------------------------------------------------------------------
// Demonstration data
// -----------------------------------------------------------------------------

const DEMO_PASSWORD = 'FodanDemo2026!';

async function seedDemoData(
  roles: Record<string, string>,
  classes: Record<string, string>,
  subjects: Record<string, string>,
  superAdminId: string,
) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Mini Admin ---------------------------------------------------------
  const miniAdmin = await prisma.user.upsert({
    where: { username: 'demo.teacher' },
    create: {
      username: 'demo.teacher',
      fullName: 'Adaeze Okonkwo',
      email: 'demo.teacher@fodancollege.local',
      passwordHash,
      roleId: roles.MINI_ADMIN as string,
      mustChangePassword: false,
      createdById: superAdminId,
    },
    update: {},
  });

  const jss1 = classes['jss-1'] as string;
  const primary4 = classes['primary-4'] as string;

  for (const classId of [jss1, primary4]) {
    await prisma.adminClassAssignment.upsert({
      where: { userId_classId: { userId: miniAdmin.id, classId } },
      create: { userId: miniAdmin.id, classId },
      update: {},
    });
  }
  for (const subjectId of [subjects['mathematics'] as string, subjects['computer-studies'] as string]) {
    await prisma.adminSubjectAssignment.upsert({
      where: { userId_subjectId: { userId: miniAdmin.id, subjectId } },
      create: { userId: miniAdmin.id, subjectId },
      update: {},
    });
  }

  // --- Students -----------------------------------------------------------
  const studentDefs = [
    { username: 'demo.student', fullName: 'Chidinma Eze', classSlug: 'jss-1', type: 'SECONDARY', activated: true },
    { username: 'demo.student2', fullName: 'Tunde Adeyemi', classSlug: 'jss-1', type: 'SECONDARY', activated: true },
    { username: 'demo.student3', fullName: 'Halima Bello', classSlug: 'jss-1', type: 'SECONDARY', activated: true },
    { username: 'demo.newbie', fullName: 'Emeka Nwosu', classSlug: 'primary-4', type: 'PRIMARY', activated: false },
  ];

  const students: { id: string; classId: string }[] = [];

  for (const definition of studentDefs) {
    const classId = classes[definition.classSlug] as string;
    const user = await prisma.user.upsert({
      where: { username: definition.username },
      create: {
        username: definition.username,
        fullName: definition.fullName,
        email: `${definition.username}@fodancollege.local`,
        passwordHash,
        roleId: roles.STUDENT as string,
        mustChangePassword: false,
        studentProfile: {
          create: {
            classId,
            studentType: definition.type,
            isActivated: definition.activated,
            activatedAt: definition.activated ? new Date() : null,
            activatedById: definition.activated ? superAdminId : null,
          },
        },
      },
      update: {},
    });
    students.push({ id: user.id, classId });
  }

  console.log(`Demo accounts         1 Mini Admin, ${studentDefs.length} students (password: ${DEMO_PASSWORD})`);

  // --- Topics -------------------------------------------------------------
  const topicDefs = [
    { subject: 'mathematics', classSlug: 'jss-1', title: 'Introduction to Algebra', description: 'Letters standing for numbers, simple expressions and substitution.' },
    { subject: 'mathematics', classSlug: 'jss-1', title: 'Whole Numbers and Place Value', description: 'Reading, writing and ordering large numbers.' },
    { subject: 'english-language', classSlug: 'jss-1', title: 'Parts of Speech', description: 'Nouns, pronouns, verbs, adjectives and adverbs.' },
    { subject: 'computer-studies', classSlug: 'jss-1', title: 'Parts of a Computer', description: 'Input, output, storage and processing devices.' },
    { subject: 'data-processing', classSlug: 'jss-1', title: 'What is Data?', description: 'Data, information and how they differ.' },
    { subject: 'mathematics', classSlug: 'primary-4', title: 'Addition and Subtraction', description: 'Working with numbers up to four digits.' },
  ];

  let topicCount = 0;
  for (const definition of topicDefs) {
    const subjectId = subjects[definition.subject] as string;
    const classId = classes[definition.classSlug] as string;
    const slug = definition.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    await prisma.topic.upsert({
      where: { subjectId_classId_slug: { subjectId, classId, slug } },
      create: {
        title: definition.title,
        slug,
        description: definition.description,
        subjectId,
        classId,
        orderIndex: topicCount,
        createdById: miniAdmin.id,
      },
      update: {},
    });
    topicCount += 1;
  }
  console.log(`Demo topics           ${topicCount} ready`);

  // --- An examination with a real answer key ------------------------------
  const mathId = subjects['mathematics'] as string;
  const examTitle = 'JSS 1 Mathematics — First Assessment';

  const existingExam = await prisma.examination.findFirst({
    where: { title: examTitle, classId: jss1 },
  });

  if (!existingExam) {
    const questions = [
      { text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correct: 1 },
      { text: 'What is 5 × 5?', options: ['10', '15', '25', '30'], correct: 2 },
      { text: 'Which of these is an even number?', options: ['7', '11', '14', '19'], correct: 2 },
      { text: 'What is the value of x in x + 3 = 10?', options: ['5', '6', '7', '13'], correct: 2 },
      { text: 'What is one quarter of 20?', options: ['4', '5', '10', '15'], correct: 1 },
      { text: 'Which number is the largest?', options: ['1,209', '1,092', '1,920', '1,029'], correct: 2 },
      { text: 'What is 100 − 47?', options: ['43', '53', '57', '63'], correct: 1 },
      { text: 'How many sides does a hexagon have?', options: ['4', '5', '6', '8'], correct: 2 },
      { text: 'What is 3²?', options: ['6', '9', '12', '27'], correct: 1 },
      { text: 'Which of these is a prime number?', options: ['9', '15', '21', '23'], correct: 3 },
    ];

    const exam = await prisma.examination.create({
      data: {
        title: examTitle,
        subjectId: mathId,
        classId: jss1,
        instructions:
          'Answer every question. Each question carries one mark. You may move backwards and forwards between questions before submitting.',
        durationMins: 20,
        totalQuestions: questions.length,
        totalMarks: questions.length,
        passMark: 40,
        attemptLimit: 2,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        shuffleQuestions: true,
        showCorrectAnswers: true,
        createdById: miniAdmin.id,
      },
    });

    for (const [index, question] of questions.entries()) {
      await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          number: index + 1,
          text: question.text,
          marks: 1,
          options: {
            create: question.options.map((text, optionIndex) => ({
              label: 'ABCD'[optionIndex] as string,
              text,
              isCorrect: optionIndex === question.correct,
              orderIndex: optionIndex,
            })),
          },
        },
      });
    }

    console.log(`Demo examination      "${examTitle}" with ${questions.length} questions`);
  }

  // --- A forum thread -----------------------------------------------------
  const forum = await prisma.forumCategory.findUnique({ where: { slug: 'jss-1-forum' } });
  const firstStudent = students[0];

  if (forum && firstStudent) {
    const existingPost = await prisma.forumPost.findFirst({
      where: { categoryId: forum.id, authorId: firstStudent.id },
    });

    if (!existingPost) {
      const post = await prisma.forumPost.create({
        data: {
          categoryId: forum.id,
          authorId: firstStudent.id,
          title: 'How do I know which letter to substitute in algebra?',
          body: 'I watched the Introduction to Algebra video but I still get confused when there are two letters. Does anyone have a simple way to remember?',
          replyCount: 1,
          lastReplyAt: new Date(),
        },
      });

      const secondStudent = students[1];
      if (secondStudent) {
        await prisma.forumReply.create({
          data: {
            postId: post.id,
            authorId: secondStudent.id,
            body: 'Write the letter and its value on the side first, then replace it one at a time. It helped me a lot.',
          },
        });
      }
      console.log('Demo forum            1 thread with 1 reply');
    }
  }

  // --- An administrative task --------------------------------------------
  const existingTask = await prisma.task.findFirst({
    where: { assignedToId: miniAdmin.id },
  });

  if (!existingTask) {
    const task = await prisma.task.create({
      data: {
        title: 'Upload the JSS 1 Mathematics revision pack',
        description:
          'Prepare and upload the revision PDF and the accompanying video for Introduction to Algebra.',
        assignedToId: miniAdmin.id,
        createdById: superAdminId,
        priority: 'HIGH',
        status: 'PENDING',
        dueDate: new Date(Date.now() + 7 * 86_400_000),
      },
    });

    await prisma.taskHistory.create({
      data: {
        taskId: task.id,
        actorId: superAdminId,
        action: 'CREATED',
        toStatus: 'PENDING',
        note: 'Task created and assigned.',
      },
    });
    console.log('Demo task             1 assigned to demo.teacher');
  }

  // --- Some completed results, so analytics screens are not empty ---------
  const publishedExam = await prisma.examination.findFirst({
    where: { classId: jss1, status: 'PUBLISHED' },
    include: { questions: { include: { options: true } } },
  });

  if (publishedExam) {
    for (const student of students.filter((s) => s.classId === jss1)) {
      const already = await prisma.examAttempt.findFirst({
        where: { examId: publishedExam.id, studentId: student.id },
      });
      if (already) continue;

      const startedAt = new Date(Date.now() - randomInt(1, 6) * 86_400_000);
      const submittedAt = new Date(startedAt.getTime() + randomInt(6, 18) * 60_000);

      const attempt = await prisma.examAttempt.create({
        data: {
          examId: publishedExam.id,
          studentId: student.id,
          attemptNumber: 1,
          status: 'SUBMITTED',
          startedAt,
          expiresAt: new Date(startedAt.getTime() + publishedExam.durationMins * 60_000),
          submittedAt,
          questionOrder: JSON.stringify(publishedExam.questions.map((q) => q.id)),
          totalMarks: publishedExam.totalMarks,
        },
      });

      let score = 0;
      for (const question of publishedExam.questions) {
        const correct = question.options.find((option) => option.isCorrect);
        const getsItRight = randomInt(0, 100) < 68;
        const chosen = getsItRight
          ? correct
          : question.options.find((option) => !option.isCorrect);

        if (getsItRight) score += question.marks;

        await prisma.examAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: question.id,
            selectedOptionId: chosen?.id ?? null,
            isCorrect: getsItRight,
            marksAwarded: getsItRight ? question.marks : 0,
          },
        });
      }

      const totalMarks = publishedExam.totalMarks;
      const percentage = Math.round((score / totalMarks) * 1000) / 10;
      const grade =
        percentage >= 75 ? 'A' : percentage >= 65 ? 'B' : percentage >= 55 ? 'C' : percentage >= 45 ? 'D' : percentage >= 40 ? 'E' : 'F';

      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          score,
          percentage,
          grade,
          passed: percentage >= publishedExam.passMark,
          correctCount: score,
          incorrectCount: totalMarks - score,
          unansweredCount: 0,
        },
      });

      await prisma.result.create({
        data: {
          attemptId: attempt.id,
          examId: publishedExam.id,
          studentId: student.id,
          classId: jss1,
          subjectId: publishedExam.subjectId,
          score,
          totalMarks,
          percentage,
          grade,
          passed: percentage >= publishedExam.passMark,
          correctCount: score,
          incorrectCount: totalMarks - score,
          unansweredCount: 0,
          answeredCount: totalMarks,
          durationSeconds: Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000),
          submittedAt,
        },
      });
    }
    console.log('Demo results          generated for JSS 1 students');
  }
}

main()
  .catch((error) => {
    console.error('\nSeed failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
