'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { revokeCodeAction } from './actions';
import { Button } from '@/components/ui/button';

export function RevokeButton({ codeId }: { codeId: string }) {
  const [state, action, pending] = useActionState(revokeCodeAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="codeId" value={codeId} />
      <input type="hidden" name="reason" value="Revoked by administrator" />
      <Button 
        type="submit" 
        variant="ghost" 
        size="sm" 
        className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
        loading={pending}
      >
        Revoke
      </Button>
    </form>
  );
}
