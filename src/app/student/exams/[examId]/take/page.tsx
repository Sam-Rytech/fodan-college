import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { guardLearningAccess } from '@/lib/auth/guards';
import { startOrResumeAttempt } from '@/lib/exam/engine';
import { isAppError } from '@/lib/errors';
import { ExamRunner } from './exam-runner';

export const metadata: Metadata = {
  title: 'Examination in progress',
  robots: { index: false, follow: false },
};

/**
 * Creates or resumes the attempt, then hands a sanitised payload to the client.
 *
 * The payload contains no answer key — `startOrResumeAttempt` builds each
 * question through a function that cannot emit `isCorrect`. Even a student who
 * opens the network tab sees only the options they are being asked to choose
 * between.
 */
export default async function TakeExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const user = await guardLearningAccess();
  const { examId } = await params;

  let attempt;
  try {
    attempt = await startOrResumeAttempt(examId, user);
  } catch (error) {
    if (isAppError(error) && error.code === 'EXAM_RULE') {
      return (
        <div className="mx-auto max-w-lg py-8">
          <Alert tone="warn" title="This paper cannot be opened">
            {error.message}
          </Alert>
          <div className="mt-5 flex gap-3">
            <Button asChild>
              <Link href="/student/exams">Back to examinations</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/student/results">See my results</Link>
            </Button>
          </div>
        </div>
      );
    }
    if (isAppError(error) && error.code === 'FORBIDDEN') {
      redirect('/student/exams');
    }
    throw error;
  }

  return <ExamRunner attempt={attempt} studentName={user.fullName} />;
}
