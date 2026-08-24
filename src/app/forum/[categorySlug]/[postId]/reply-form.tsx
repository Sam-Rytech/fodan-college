'use client';

import * as React from 'react';
import { useActionState, useRef } from 'react';
import { createReplyAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Textarea, Field } from '@/components/ui/field';

export function ReplyForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState(createReplyAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  const errors = state?.ok === false ? state.fieldErrors : {};

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
      <h3 className="text-lg font-medium text-[var(--text-strong)] mb-4">Post a Reply</h3>
      <form ref={formRef} action={action} className="space-y-4">
        <input type="hidden" name="postId" value={postId} />
        
        <Field error={errors?.body}>
          <Textarea 
            name="body" 
            placeholder="Write your reply here..." 
            rows={4} 
            required
          />
        </Field>

        {state?.ok === false && state.error && (
          <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
            {state.error}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Post Reply
          </Button>
        </div>
      </form>
    </div>
  );
}
