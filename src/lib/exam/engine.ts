import 'server-only';
import { prisma } from '../db';
import { AppError, forbidden, notFound } from '../errors';
import { secureShuffle } from '../crypto';
import { safeJsonParse } from '../utils';
import { recordAudit } from '../audit';
import { notify } from '../notifications';
import {
  ATTEMPT_STATUS,
  AUDIT_ACTIONS,
  EXAM_STATUS,
  FINISHED_ATTEMPT_STATUSES,
  NOTIFICATION_TYPES,
  gradeForPercentage,
} from '../constants';
import type { AuthUser } from '../auth/types';

/**
 * Examination engine.
 *
 * SECURITY MODEL
 * --------------
 * Everything that decides a mark happens here, on the server:
 *  - The answer key (`ExamOption.isCorrect`) is stripped from every payload a
 *    student can reach. `toStudentQuestion` is the only function that shapes
 *    questions for a student, and it cannot emit the flag.
 *  - The deadline is `ExamAttempt.expiresAt`, written when the attempt starts.
 *    The countdown in the browser is decoration; a late answer is rejected and
 *    a late submission is scored as auto-submitted at the deadline.
 *  - Attempt limits, availability windows and class membership are re-checked
 *    on every call, not just when the exam list was rendered.
 *  - Scoring reads options straight from the database. Nothing the client sends
 *    influences a mark beyond *which option id* was chosen.
 */

// -----------------------------------------------------------------------------
// Shapes handed to the student
// -----------------------------------------------------------------------------

export interface StudentOption {
  id: string;
  label: string;
  text: string;
}

export interface StudentQuestion {
  id: string;
  number: number;
  text: string;
  marks: number;
  options: StudentOption[];
}

export interface AttemptState {
  attemptId: string;
  examId: string;
  title: string;
  instructions: string | null;
  durationMins: number;
  totalMarks: number;
  startedAt: string;
  expiresAt: string;
  serverTime: string;
  questions: StudentQuestion[];
  answers: Record<string, string | null>;
  attemptNumber: number;
  attemptLimit: number;
}

// -----------------------------------------------------------------------------
// Availability
// -----------------------------------------------------------------------------

export interface ExamAvailability {
  available: boolean;
  reason: string | null;
  attemptsUsed: number;
  attemptsLeft: number;
  hasOpenAttempt: boolean;
  openAttemptId: string | null;
}

export async function getExamAvailability(
  examId: string,
  studentId: string,
): Promise<ExamAvailability> {
  const exam = await prisma.examination.findUnique({
    where: { id: examId },
    select: {
      id: true,
      status: true,
      availableFrom: true,
      availableTo: true,
      attemptLimit: true,
    },
  });

  if (!exam) throw notFound('That examination could not be found.');

  const attempts = await prisma.examAttempt.findMany({
    where: { examId, studentId },
    select: { id: true, status: true },
  });

  const finished = attempts.filter((attempt) =>
    (FINISHED_ATTEMPT_STATUSES as string[]).includes(attempt.status),
  );
  const open = attempts.find(
    (attempt) => attempt.status === ATTEMPT_STATUS.IN_PROGRESS,
  );

  const attemptsUsed = finished.length;
  const attemptsLeft = Math.max(0, exam.attemptLimit - attemptsUsed);

  const base = {
    attemptsUsed,
    attemptsLeft,
    hasOpenAttempt: Boolean(open),
    openAttemptId: open?.id ?? null,
  };

  if (exam.status !== EXAM_STATUS.PUBLISHED) {
    return { ...base, available: false, reason: 'This examination is not open.' };
  }

  const now = Date.now();
  if (exam.availableFrom && exam.availableFrom.getTime() > now) {
    return {
      ...base,
      available: false,
      reason: 'This examination has not started yet.',
    };
  }
  if (exam.availableTo && exam.availableTo.getTime() < now) {
    return { ...base, available: false, reason: 'This examination has closed.' };
  }

  if (!open && attemptsLeft <= 0) {
    return {
      ...base,
      available: false,
      reason: `You have used all ${exam.attemptLimit} attempt${
        exam.attemptLimit === 1 ? '' : 's'
      } for this examination.`,
    };
  }

  return { ...base, available: true, reason: null };
}

// -----------------------------------------------------------------------------
// Starting and resuming
// -----------------------------------------------------------------------------

export async function startOrResumeAttempt(
  examId: string,
  user: AuthUser,
): Promise<AttemptState> {
  const studentId = user.id;

  const exam = await prisma.examination.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: { number: 'asc' },
        include: { options: { orderBy: { orderIndex: 'asc' } } },
      },
    },
  });

  if (!exam) throw notFound('That examination could not be found.');

  if (exam.classId !== user.student?.classId) {
    throw forbidden('This examination is not for your class.');
  }

  const availability = await getExamAvailability(examId, studentId);

  // An open attempt may always be resumed, even after the window closes — the
  // student is already inside the paper and must be allowed to finish or be
  // auto-submitted at their own deadline.
  let attempt = availability.openAttemptId
    ? await prisma.examAttempt.findUnique({
        where: { id: availability.openAttemptId },
      })
    : null;

  if (attempt && attempt.expiresAt.getTime() <= Date.now()) {
    await finaliseAttempt(attempt.id, { auto: true });
    throw new AppError(
      'EXAM_RULE',
      'Your time for this examination had already run out. It has been submitted for you.',
    );
  }

  if (!attempt) {
    if (!availability.available) {
      throw new AppError(
        'EXAM_RULE',
        availability.reason ?? 'This examination is not available.',
      );
    }
    if (exam.questions.length === 0) {
      throw new AppError(
        'EXAM_RULE',
        'This examination has no questions yet. Please tell your teacher.',
      );
    }

    const order = exam.shuffleQuestions
      ? secureShuffle(exam.questions.map((question) => question.id))
      : exam.questions.map((question) => question.id);

    const now = new Date();
    attempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        attemptNumber: availability.attemptsUsed + 1,
        status: ATTEMPT_STATUS.IN_PROGRESS,
        startedAt: now,
        expiresAt: new Date(now.getTime() + exam.durationMins * 60_000),
        questionOrder: JSON.stringify(order),
        totalMarks: exam.totalMarks,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.EXAM_ATTEMPT_STARTED,
      actor: user,
      targetType: 'examination',
      targetId: examId,
      description: `${user.fullName} started "${exam.title}" (attempt ${attempt.attemptNumber}).`,
      metadata: { attemptId: attempt.id, attemptNumber: attempt.attemptNumber },
    });
  }

  const order = safeJsonParse<string[]>(attempt.questionOrder, []);
  const byId = new Map(exam.questions.map((question) => [question.id, question]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((question): question is (typeof exam.questions)[number] => Boolean(question));

  const existingAnswers = await prisma.examAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, selectedOptionId: true },
  });

  return {
    attemptId: attempt.id,
    examId: exam.id,
    title: exam.title,
    instructions: exam.instructions,
    durationMins: exam.durationMins,
    totalMarks: exam.totalMarks,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    serverTime: new Date().toISOString(),
    questions: ordered.map((question, index) =>
      toStudentQuestion(question, index + 1, exam.shuffleOptions),
    ),
    answers: Object.fromEntries(
      existingAnswers.map((answer) => [answer.questionId, answer.selectedOptionId]),
    ),
    attemptNumber: attempt.attemptNumber,
    attemptLimit: exam.attemptLimit,
  };
}

/**
 * The single place questions are shaped for a student. It builds a fresh object
 * rather than spreading the database row, so a column added later — including a
 * new answer-key column — can never leak by accident.
 */
function toStudentQuestion(
  question: {
    id: string;
    text: string;
    marks: number;
    options: { id: string; label: string; text: string }[];
  },
  displayNumber: number,
  shuffleOptions: boolean,
): StudentQuestion {
  const options = question.options.map((option) => ({
    id: option.id,
    label: option.label,
    text: option.text,
  }));

  return {
    id: question.id,
    number: displayNumber,
    text: question.text,
    marks: question.marks,
    options: shuffleOptions ? secureShuffle(options) : options,
  };
}

// -----------------------------------------------------------------------------
// Answering
// -----------------------------------------------------------------------------

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  optionId: string | null,
  user: AuthUser,
): Promise<{ savedAt: string; remainingSeconds: number }> {
  const attempt = await loadOwnAttempt(attemptId, user.id);

  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
    throw new AppError('EXAM_RULE', 'This examination has already been submitted.');
  }

  const remainingMs = attempt.expiresAt.getTime() - Date.now();
  if (remainingMs <= 0) {
    await finaliseAttempt(attemptId, { auto: true });
    throw new AppError(
      'EXAM_RULE',
      'Your time has run out. Your examination has been submitted.',
    );
  }

  // The question must belong to this attempt's exam, and the option to that
  // question — otherwise a crafted request could attach an option from an
  // easier paper.
  const question = await prisma.examQuestion.findFirst({
    where: { id: questionId, examId: attempt.examId },
    select: { id: true, options: { select: { id: true } } },
  });

  if (!question) {
    throw forbidden('That question is not part of this examination.');
  }
  if (optionId && !question.options.some((option) => option.id === optionId)) {
    throw forbidden('That answer is not one of the options for this question.');
  }

  await prisma.examAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, selectedOptionId: optionId },
    update: { selectedOptionId: optionId },
  });

  return {
    savedAt: new Date().toISOString(),
    remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
  };
}

/** Bulk flush used by the submit button so a final click is never lost. */
export async function saveAnswers(
  attemptId: string,
  answers: { questionId: string; optionId: string | null }[],
  user: AuthUser,
): Promise<void> {
  for (const answer of answers.slice(0, 500)) {
    await saveAnswer(attemptId, answer.questionId, answer.optionId, user).catch(
      () => undefined,
    );
  }
}

// -----------------------------------------------------------------------------
// Submission & scoring
// -----------------------------------------------------------------------------

export interface AttemptOutcome {
  attemptId: string;
  examId: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  answeredCount: number;
  submittedAt: string;
  durationSeconds: number;
  showResultInstantly: boolean;
}

export async function submitAttempt(
  attemptId: string,
  user: AuthUser,
): Promise<AttemptOutcome> {
  await loadOwnAttempt(attemptId, user.id);
  const outcome = await finaliseAttempt(attemptId, { auto: false, actor: user });
  return outcome;
}

/**
 * Scores an attempt and writes the immutable Result row.
 *
 * Idempotent: if the attempt is already finished, the stored outcome is
 * returned rather than rescored. That matters because the browser's expiry
 * timer, the student's submit click and a background sweep can all arrive at
 * roughly the same moment.
 */
export async function finaliseAttempt(
  attemptId: string,
  options: { auto: boolean; actor?: AuthUser },
): Promise<AttemptOutcome> {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          questions: {
            include: { options: { select: { id: true, isCorrect: true } } },
          },
        },
      },
      answers: true,
      result: true,
      student: { select: { id: true, fullName: true } },
    },
  });

  if (!attempt) throw notFound('That examination attempt could not be found.');

  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS && attempt.result) {
    return outcomeFrom(attempt.result, attempt.exam.title, attempt.exam.showResultInstantly);
  }

  const correctByQuestion = new Map<string, string | null>();
  let totalMarks = 0;

  for (const question of attempt.exam.questions) {
    totalMarks += question.marks;
    const correct = question.options.find((option) => option.isCorrect);
    correctByQuestion.set(question.id, correct?.id ?? null);
  }

  const answersByQuestion = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );

  let score = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const answerUpdates: { id: string; isCorrect: boolean; marksAwarded: number }[] = [];

  for (const question of attempt.exam.questions) {
    const answer = answersByQuestion.get(question.id);

    if (!answer?.selectedOptionId) {
      unansweredCount += 1;
      if (answer) {
        answerUpdates.push({ id: answer.id, isCorrect: false, marksAwarded: 0 });
      }
      continue;
    }

    const isCorrect = correctByQuestion.get(question.id) === answer.selectedOptionId;
    if (isCorrect) {
      score += question.marks;
      correctCount += 1;
    } else {
      incorrectCount += 1;
    }

    answerUpdates.push({
      id: answer.id,
      isCorrect,
      marksAwarded: isCorrect ? question.marks : 0,
    });
  }

  const submittedAt = new Date();
  const effectiveSubmittedAt = options.auto
    ? new Date(Math.min(submittedAt.getTime(), attempt.expiresAt.getTime()))
    : submittedAt;

  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
  const rounded = Math.round(percentage * 10) / 10;
  const grade = gradeForPercentage(rounded);
  const passed = rounded >= attempt.exam.passMark;
  const durationSeconds = Math.max(
    0,
    Math.round((effectiveSubmittedAt.getTime() - attempt.startedAt.getTime()) / 1000),
  );

  const answeredCount = correctCount + incorrectCount;

  // One transaction so an attempt can never end up marked "submitted" without
  // its Result row, or with half of its answers scored.
  const { updatedAttempt, result } = await prisma.$transaction(async (tx) => {
    // Per-answer marks, so the review screen can show which questions were
    // right without recomputing (and without ever exposing the key).
    for (const update of answerUpdates) {
      await tx.examAnswer.update({
        where: { id: update.id },
        data: { isCorrect: update.isCorrect, marksAwarded: update.marksAwarded },
      });
    }

    const attemptRow = await tx.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: options.auto
          ? ATTEMPT_STATUS.AUTO_SUBMITTED
          : ATTEMPT_STATUS.SUBMITTED,
        submittedAt: effectiveSubmittedAt,
        score,
        totalMarks,
        percentage: rounded,
        grade,
        passed,
        correctCount,
        incorrectCount,
        unansweredCount,
      },
    });

    const resultRow = await tx.result.upsert({
      where: { attemptId },
      create: {
        attemptId,
        examId: attempt.examId,
        studentId: attempt.studentId,
        classId: attempt.exam.classId,
        subjectId: attempt.exam.subjectId,
        score,
        totalMarks,
        percentage: rounded,
        grade,
        passed,
        correctCount,
        incorrectCount,
        unansweredCount,
        answeredCount,
        durationSeconds,
        submittedAt: effectiveSubmittedAt,
      },
      update: {},
    });

    return { updatedAttempt: attemptRow, result: resultRow };
  });

  await recordAudit({
    action: options.auto
      ? AUDIT_ACTIONS.EXAM_AUTO_SUBMITTED
      : AUDIT_ACTIONS.EXAM_SUBMITTED,
    actor: options.actor ?? null,
    targetType: 'exam_attempt',
    targetId: attemptId,
    description: `${attempt.student.fullName} ${
      options.auto ? 'ran out of time on' : 'submitted'
    } "${attempt.exam.title}" — ${score}/${totalMarks} (${rounded}%).`,
    metadata: {
      examId: attempt.examId,
      attemptNumber: updatedAttempt.attemptNumber,
      score,
      totalMarks,
      percentage: rounded,
      grade,
      passed,
      auto: options.auto,
    },
  });

  await notify({
    userId: attempt.studentId,
    type: NOTIFICATION_TYPES.RESULT,
    title: attempt.exam.showResultInstantly
      ? `Result ready: ${attempt.exam.title}`
      : `Submitted: ${attempt.exam.title}`,
    body: attempt.exam.showResultInstantly
      ? `You scored ${score} out of ${totalMarks} (${rounded}%). Grade ${grade}.`
      : 'Your answers were received. Your teacher will release the result.',
    link: `/student/results/${attemptId}`,
  });

  return outcomeFrom(result, attempt.exam.title, attempt.exam.showResultInstantly);
}

function outcomeFrom(
  result: {
    attemptId: string;
    examId: string;
    score: number;
    totalMarks: number;
    percentage: number;
    grade: string;
    passed: boolean;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    answeredCount: number;
    durationSeconds: number;
    submittedAt: Date;
  },
  examTitle: string,
  showResultInstantly: boolean,
): AttemptOutcome {
  return {
    attemptId: result.attemptId,
    examId: result.examId,
    examTitle,
    score: result.score,
    totalMarks: result.totalMarks,
    percentage: result.percentage,
    grade: result.grade,
    passed: result.passed,
    correctCount: result.correctCount,
    incorrectCount: result.incorrectCount,
    unansweredCount: result.unansweredCount,
    answeredCount: result.answeredCount,
    submittedAt: result.submittedAt.toISOString(),
    durationSeconds: result.durationSeconds,
    showResultInstantly,
  };
}

/**
 * Sweeps attempts whose deadline passed while the browser was closed.
 * Called opportunistically from the student and admin dashboards so the
 * platform needs no separate cron process to stay correct.
 */
export async function autoSubmitExpiredAttempts(limit = 25): Promise<number> {
  const expired = await prisma.examAttempt.findMany({
    where: {
      status: ATTEMPT_STATUS.IN_PROGRESS,
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
    take: limit,
  });

  let submitted = 0;
  for (const attempt of expired) {
    try {
      await finaliseAttempt(attempt.id, { auto: true });
      submitted += 1;
    } catch (error) {
      console.error('[fodan][exam] auto-submit failed', { attemptId: attempt.id, error });
    }
  }
  return submitted;
}

// -----------------------------------------------------------------------------
// Review
// -----------------------------------------------------------------------------

export interface ReviewQuestion {
  id: string;
  number: number;
  text: string;
  marks: number;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  options: (StudentOption & { isCorrect?: boolean })[];
}

/**
 * Post-submission review. The correct answer is included ONLY when the exam is
 * configured to reveal it and the attempt is finished — the filter happens here
 * on the server, never in the component.
 */
export async function getAttemptReview(attemptId: string, viewer: AuthUser) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          subject: { select: { name: true } },
          schoolClass: { select: { name: true } },
          questions: {
            orderBy: { number: 'asc' },
            include: { options: { orderBy: { orderIndex: 'asc' } } },
          },
        },
      },
      answers: true,
      result: true,
      student: { select: { id: true, fullName: true, username: true } },
    },
  });

  if (!attempt) throw notFound('That result could not be found.');

  const isOwner = attempt.studentId === viewer.id;
  const isStaffViewer = viewer.role !== 'STUDENT';

  if (!isOwner && !isStaffViewer) {
    throw forbidden('You can only view your own results.');
  }

  if (attempt.status === ATTEMPT_STATUS.IN_PROGRESS) {
    throw new AppError('EXAM_RULE', 'This examination has not been submitted yet.');
  }

  const revealAnswers = isStaffViewer || attempt.exam.showCorrectAnswers;
  const answersByQuestion = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );

  const questions: ReviewQuestion[] = attempt.exam.questions.map(
    (question, index) => {
      const answer = answersByQuestion.get(question.id);
      return {
        id: question.id,
        number: index + 1,
        text: question.text,
        marks: question.marks,
        selectedOptionId: answer?.selectedOptionId ?? null,
        isCorrect: answer?.isCorrect ?? null,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          text: option.text,
          ...(revealAnswers ? { isCorrect: option.isCorrect } : {}),
        })),
      };
    },
  );

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
    },
    exam: {
      id: attempt.exam.id,
      title: attempt.exam.title,
      subject: attempt.exam.subject.name,
      className: attempt.exam.schoolClass.name,
      passMark: attempt.exam.passMark,
      showResultInstantly: attempt.exam.showResultInstantly,
    },
    student: attempt.student,
    result: attempt.result,
    revealAnswers,
    questions,
  };
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

async function loadOwnAttempt(attemptId: string, studentId: string) {
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw notFound('That examination attempt could not be found.');
  if (attempt.studentId !== studentId) {
    // Deliberately the same message as "not found": a student must not be able
    // to discover that another student's attempt id exists.
    throw notFound('That examination attempt could not be found.');
  }
  return attempt;
}
