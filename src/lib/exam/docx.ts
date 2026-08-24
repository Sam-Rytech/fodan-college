import 'server-only';
import mammoth from 'mammoth';
import { parseQuestionText, type ParseResult } from './question-parser';

/**
 * DOCX → plain text → parsed questions.
 *
 * Why go through HTML rather than mammoth's `extractRawText`: raw-text
 * extraction throws away Word's automatic list numbering, so a paper typed with
 * Word's numbered-list button arrives as an unnumbered wall of text. Converting
 * to HTML keeps `<ol><li>` structure, and the flattener below re-materialises
 * the numbers the author saw on screen. Tables are flattened too, because
 * question papers are often laid out in a two-column table.
 */

export interface DocxExtraction {
  text: string;
  /** mammoth's own warnings (unsupported styles, dropped images, and so on). */
  messages: string[];
}

export async function extractDocxText(buffer: Buffer): Promise<DocxExtraction> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      // Keep the markup minimal: we only need structure, never styling.
      styleMap: [
        "p[style-name='Heading 1'] => p:fresh",
        "p[style-name='Heading 2'] => p:fresh",
      ],
      convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    },
  );

  return {
    text: flattenHtml(result.value),
    messages: result.messages.map((message) => message.message),
  };
}

export async function parseExamDocx(buffer: Buffer): Promise<
  ParseResult & { extractionMessages: string[]; rawText: string }
> {
  const extraction = await extractDocxText(buffer);
  const parsed = parseQuestionText(extraction.text);

  return {
    ...parsed,
    extractionMessages: extraction.messages,
    rawText: extraction.text,
  };
}

// -----------------------------------------------------------------------------
// HTML flattening
// -----------------------------------------------------------------------------

const BLOCK_CLOSERS =
  /^\/(p|div|li|h[1-6]|tr|td|th|table|ol|ul|blockquote|pre)$/i;

/**
 * Turns mammoth's HTML into one line per block, restoring ordered-list numbers.
 * Deliberately a small hand-rolled scanner rather than a DOM parser: the input
 * is machine-generated, tightly constrained markup, and this keeps the
 * dependency surface (and therefore the attack surface) at zero.
 */
export function flattenHtml(html: string): string {
  const output: string[] = [];
  let buffer = '';

  /** Counter stack, one entry per nested <ol>. `null` marks an <ul>. */
  const listStack: (number | null)[] = [];
  let pendingMarker = '';

  const flush = () => {
    const line = decodeEntities(buffer).replace(/[ \t]+/g, ' ').trim();
    if (line !== '') output.push(`${pendingMarker}${line}`);
    buffer = '';
    pendingMarker = '';
  };

  let index = 0;
  while (index < html.length) {
    const char = html[index];

    if (char !== '<') {
      buffer += char;
      index += 1;
      continue;
    }

    const close = html.indexOf('>', index);
    if (close === -1) {
      buffer += html.slice(index);
      break;
    }

    const tag = html.slice(index + 1, close).trim();
    const name = tag.split(/[\s/]/)[0]?.toLowerCase() ?? '';

    if (/^br$/i.test(name)) {
      flush();
    } else if (name === 'ol') {
      flush();
      listStack.push(0);
    } else if (name === 'ul') {
      flush();
      listStack.push(null);
    } else if (tag.toLowerCase() === '/ol' || tag.toLowerCase() === '/ul') {
      flush();
      listStack.pop();
    } else if (name === 'li') {
      flush();
      const top = listStack[listStack.length - 1];
      if (typeof top === 'number') {
        const next = top + 1;
        listStack[listStack.length - 1] = next;
        pendingMarker = `${next}. `;
      }
    } else if (BLOCK_CLOSERS.test(tag)) {
      flush();
    }

    index = close + 1;
  }

  flush();
  return output.join('\n');
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '-',
  ndash: '-',
  hellip: '...',
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}
