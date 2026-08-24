import * as React from 'react';
import { cn } from '@/lib/utils';
import { parseRestrictedMarkup, type InlineToken } from '@/lib/sanitize';

/**
 * Renders user-authored text.
 *
 * The critical property: this component never produces an HTML string and never
 * touches `dangerouslySetInnerHTML`. The text is parsed into a small token tree
 * and each token becomes a React element, so anything a user types is escaped
 * by React as ordinary text content. A `<script>` in a forum post is displayed,
 * not executed — there is no code path in which it could be.
 *
 * A deliberately small subset is understood: **bold**, _italic_, `code`,
 * bullet lists, > quotes and bare http(s) links. Link targets are re-checked
 * against a scheme allowlist in `sanitize.ts` before they reach an href.
 */
export function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = React.useMemo(() => parseRestrictedMarkup(text), [text]);

  return (
    <div
      className={cn(
        'space-y-3 text-sm leading-relaxed text-[var(--text-body)]',
        className,
      )}
    >
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'list':
            return (
              <ul key={index} className="ml-5 list-disc space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Inline tokens={item} />
                  </li>
                ))}
              </ul>
            );
          case 'quote':
            return (
              <blockquote
                key={index}
                className="border-l-3 border-brand-400 bg-[var(--surface-sunken)] py-2 pl-3 pr-2 italic"
              >
                <Inline tokens={block.tokens} />
              </blockquote>
            );
          default:
            return (
              <p key={index}>
                <Inline tokens={block.tokens} />
              </p>
            );
        }
      })}
    </div>
  );
}

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case 'bold':
            return (
              <strong key={index} className="font-bold text-[var(--text-strong)]">
                {token.value}
              </strong>
            );
          case 'italic':
            return <em key={index}>{token.value}</em>;
          case 'code':
            return (
              <code
                key={index}
                className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[0.8125rem]"
              >
                {token.value}
              </code>
            );
          case 'link':
            return (
              <a
                key={index}
                href={token.href}
                target="_blank"
                // noopener/noreferrer on every outbound link: the destination
                // must never get a handle on this window.
                rel="noopener noreferrer nofollow"
                className="break-all font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
              >
                {token.value}
              </a>
            );
          default:
            return <React.Fragment key={index}>{token.value}</React.Fragment>;
        }
      })}
    </>
  );
}
