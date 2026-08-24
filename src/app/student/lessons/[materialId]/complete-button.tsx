'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { updateProgressAction } from '@/app/student/actions';

/**
 * Marks a lesson complete and, when there is one, moves straight to the next
 * lesson in the topic — the flow a student actually wants is "done, what's
 * next?", not "done, now find your way back".
 */
export function CompleteLessonButton({
  materialId,
  completed,
  nextHref,
}: {
  materialId: string;
  completed: boolean;
  nextHref: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  if (completed) {
    return nextHref ? (
      <Button
        onClick={() => router.push(nextHref)}
        iconRight={<ArrowRight className="size-4" aria-hidden />}
      >
        Next lesson
      </Button>
    ) : (
      <Button variant="secondary" disabled iconLeft={<CheckCircle2 className="size-4" aria-hidden />}>
        Completed
      </Button>
    );
  }

  return (
    <Button
      loading={pending}
      loadingLabel="Saving…"
      iconLeft={<CheckCircle2 className="size-4" aria-hidden />}
      onClick={() => {
        startTransition(async () => {
          const formData = new FormData();
          formData.set('materialId', materialId);
          formData.set('completed', 'true');
          formData.set('progressPercent', '100');

          const result = await updateProgressAction(formData);

          if (!result.ok) {
            toast({ tone: 'error', title: 'Could not save', description: result.error });
            return;
          }

          toast({
            tone: 'success',
            title: 'Lesson completed',
            description: nextHref ? 'Moving to the next lesson.' : 'Well done.',
          });

          if (nextHref) router.push(nextHref);
          else router.refresh();
        });
      }}
    >
      Mark as completed
    </Button>
  );
}
