'use client';

import { Printer } from 'lucide-react';
import { Button } from './button';

/**
 * Opens the browser's print dialog.
 *
 * Printing is a real requirement here — schools file paper copies of result
 * slips and class sheets — so the print stylesheet in globals.css strips the
 * interface chrome and the reports carry a letterhead.
 */
export function PrintButton({
  label = 'Print',
  size = 'sm',
}: {
  label?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <Button
      variant="secondary"
      size={size}
      className="no-print"
      onClick={() => window.print()}
      iconLeft={<Printer className="size-4" aria-hidden />}
    >
      {label}
    </Button>
  );
}
