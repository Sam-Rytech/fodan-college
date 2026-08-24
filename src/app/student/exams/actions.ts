'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseInput, runAction, type ActionResult } from '@/lib/actions';
import { requireActivatedStudent } from '@/lib/auth/guards';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import {
  saveAnswer,
  saveAnswers,
  submitAttempt,
  type AttemptOutcome,
} from '@/lib/exam/engine';
import { saveAnswerSchema, submitAttemptSchema } from '@/lib/validation';
import { safeJsonParse } from '@/lib/utils';

/**
 * Examination server actions.
 *
 * Nothing here trusts the client beyond "which option id did you pick". The
 * engine re-verifies ownership of the attempt, that the question belongs to the
 * paper, that the option belongs to the question, and that the deadline has not
 * passed — on every call.
 */

export async function saveAnswerAction(input: {
  attemptId: string;
  questionId: string;
  optionId: string | null;
}): Promise<ActionResult<{ savedAt: string; remainingSeconds: number }>> {
  return runAction(async () => {
    const user = await requireActivatedStudent();
    const parsed = parseInput(saveAnswerSchema, input);

    const outcome = await saveAnswer(
      parsed.attemptId,
      parsed.questionId,
      parsed.optionId,
      user,
    );

    return actionSuccess(outcome);
  });
}

export async function submitAttemptAction(input: {
  attemptId: string;
  answers?: { questionId: string; optionId: string | null }[];
}): Promise<ActionResult<AttemptOutcome>> {
  return runAction(async () => {
    const user = await requireActivatedStudent();

    // Guards against a stuck submit button being clicked repeatedly.
    await enforceRateLimit(RATE_LIMITS.examSubmit, user.id);

    const parsed = parseInput(submitAttemptSchema, {
      attemptId: input.attemptId,
      answers: JSON.stringify(input.answers ?? []),
    });

    // Final flush: whatever the student clicked in the last second before
    // pressing submit is written before the paper is scored.
    const pending = safeJsonParse<{ questionId: string; optionId: string | null }[]>(
      parsed.answers,
      [],
    );
    if (pending.length > 0) {
      await saveAnswers(parsed.attemptId, pending, user);
    }

    const outcome = await submitAttempt(parsed.attemptId, user);

    revalidatePath('/student');
    revalidatePath('/student/exams');
    revalidatePath('/student/results');

    return actionSuccess(outcome);
  });
}
