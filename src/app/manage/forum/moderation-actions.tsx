'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { resolveReportAction } from './actions';
import { Button } from '@/components/ui/button';

export function ModerationActions({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(resolveReportAction, null);

  return (
    <div className="flex items-center gap-2 justify-end">
      <form action={action}>
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="action" value="DISMISSED" />
        <Button 
          type="submit" 
          variant="ghost" 
          size="sm" 
          loading={pending}
        >
          Dismiss
        </Button>
      </form>
      <form action={action}>
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="action" value="ACTIONED" />
        <Button 
          type="submit" 
          variant="primary" 
          size="sm" 
          className="bg-danger-600 hover:bg-danger-700 focus-visible:outline-danger-600"
          loading={pending}
        >
          Hide Content
        </Button>
      </form>
    </div>
  );
}
