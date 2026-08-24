/**
 * Text sanitisation for user-authored content (forum posts and replies).
 *
 * STRATEGY
 * --------
 * The forum stores plain text, never HTML. React escapes text nodes by default,
 * so the primary XSS defence is simply never calling dangerouslySetInnerHTML on
 * user content. This module is defence in depth on top of that:
 *
 *  1. Strip control characters and normalise whitespace on the way in.
 *  2. Render a *restricted* markup subset (bold, italic, code, links, lists)
 *     ourselves, from the sanitised plain text, into React elements — not into
 *     an HTML string. There is therefore no point at which user text becomes
 *     markup that a browser parses.
 *  3. Link targets are re-validated against an http/https allowlist, so a
 *     `javascript:` or `data:` URL can never reach an href.
 *
 * This module is intentionally dependency-free and safe on client and server.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

/** Single-line input: collapse all whitespace, strip control characters. */
export function sanitiseLine(input: string, maxLength = 200): string {
  return input
    .replace(CONTROL_CHARS, '')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Multi-line input: keep paragraph breaks, cap consecutive blank lines. */
export function sanitiseRichText(input: string, maxLength = 20_000): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(ZERO_WIDTH, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/** Search terms: strip SQL/LIKE wildcards and anything exotic. */
export function sanitiseSearch(input: string, maxLength = 80): string {
  return input
    .replace(CONTROL_CHARS, '')
    .replace(/[%_\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Filenames offered back to the browser in Content-Disposition. */
export function sanitiseFilename(input: string, fallback = 'download'): string {
  const cleaned = input
    .replace(CONTROL_CHARS, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120);
  return cleaned || fallback;
}

const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** Returns the URL when it is safe to place in an href, otherwise null. */
export function safeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return SAFE_URL_SCHEMES.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Restricted markup tokeniser
// -----------------------------------------------------------------------------

export type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; value: string; href: string };

export type Block =
  | { kind: 'paragraph'; tokens: InlineToken[] }
  | { kind: 'quote'; tokens: InlineToken[] }
  | { kind: 'list'; items: InlineToken[][] };

/**
 * Parses sanitised plain text into a small block/inline tree that the renderer
 * turns into React elements. Anything not recognised stays literal text.
 */
export function parseRestrictedMarkup(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', tokens: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ kind: 'list', items: listItems.map(parseInline) });
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const listMatch = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1] ?? '');
      continue;
    }

    const quoteMatch = /^>\s?(.*)$/.exec(trimmed);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'quote', tokens: parseInline(quoteMatch[1] ?? '') });
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

const INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*)|(_[^_\n]+_)|(`[^`\n]+`)|(https?:\/\/[^\s<>"']+)/g;

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ kind: 'text', value: text.slice(lastIndex, index) });
    }

    const raw = match[0];
    if (raw.startsWith('**')) {
      tokens.push({ kind: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('_')) {
      tokens.push({ kind: 'italic', value: raw.slice(1, -1) });
    } else if (raw.startsWith('`')) {
      tokens.push({ kind: 'code', value: raw.slice(1, -1) });
    } else {
      const href = safeUrl(raw);
      if (href) {
        tokens.push({ kind: 'link', value: raw, href });
      } else {
        tokens.push({ kind: 'text', value: raw });
      }
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ kind: 'text', value: text }];
}

/** Plain-text excerpt for list views and notification bodies. */
export function excerpt(text: string, maxLength = 180): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLength) return flat;
  return `${flat.slice(0, maxLength - 1).trimEnd()}…`;
}
