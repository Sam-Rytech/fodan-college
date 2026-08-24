/**
 * Examination question parser.
 *
 * Pure text in, structured questions out — no file handling, no I/O, no
 * dependencies. The DOCX layer (docx.ts) turns a Word document into plain text
 * and hands it here, which keeps this logic exhaustively unit-testable without
 * fixture binaries.
 *
 * THE FORMAT
 * ----------
 *     1. What is the capital of Nigeria?
 *     A. Lagos
 *     *B. Abuja
 *     C. Ibadan
 *     D. Kano
 *
 * The asterisk immediately before the correct option is the answer key.
 *
 * Tolerated variations, because real documents are typed by people:
 *   - `*B.`, `* B.`, `B. *Abuja`, `B. Abuja *`  (asterisk before the label,
 *     before the option text, or trailing)
 *   - `1.` `1)` `Q1.` `Question 1:` for question numbers, or no number at all
 *   - `A.` `A)` `(A)` `A -` for option labels
 *   - Word's typographic characters (smart quotes, en dashes, ✱ ＊ • bullets)
 *   - Question text wrapped across several lines
 *   - Blank lines anywhere
 *
 * Anything ambiguous becomes a reported issue rather than a silent guess. An
 * examination is never published while errors remain.
 */

export interface ParsedOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestion {
  /** 1-based position in the finished paper, always renumbered contiguously. */
  number: number;
  /** The number written in the document, when there was one. */
  sourceNumber: number | null;
  text: string;
  options: ParsedOption[];
  /** 1-based line in the extracted text, for "fix line 42" style messages. */
  line: number;
}

export type IssueSeverity = 'error' | 'warning';

export interface ImportIssue {
  severity: IssueSeverity;
  code: ImportIssueCode;
  message: string;
  questionNumber: number | null;
  line: number | null;
}

export type ImportIssueCode =
  | 'NO_QUESTIONS'
  | 'NO_CORRECT_OPTION'
  | 'MULTIPLE_CORRECT_OPTIONS'
  | 'TOO_FEW_OPTIONS'
  | 'EMPTY_QUESTION_TEXT'
  | 'EMPTY_OPTION_TEXT'
  | 'DUPLICATE_OPTION_LABEL'
  | 'DUPLICATE_QUESTION'
  | 'DUPLICATE_OPTION_TEXT'
  | 'UNUSUAL_OPTION_COUNT'
  | 'ORPHAN_TEXT'
  | 'NON_SEQUENTIAL_NUMBERING';

export interface ParseResult {
  questions: ParsedQuestion[];
  issues: ImportIssue[];
  stats: {
    questionCount: number;
    optionCount: number;
    errorCount: number;
    warningCount: number;
    withAnswerKey: number;
  };
  /** True when the paper is safe to publish. */
  valid: boolean;
}

const MIN_OPTIONS = 2;
const EXPECTED_OPTIONS = 4;
const MAX_OPTIONS = 8;

// -----------------------------------------------------------------------------
// Normalisation
// -----------------------------------------------------------------------------

/** Word substitutes typographic look-alikes; fold them back to ASCII first. */
export function normaliseText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    // Asterisk look-alikes and bullets people use as an answer marker.
    .replace(/[✱＊٭∗✻✼✽]/g, '*')
    .replace(/[\t\v\f]/g, ' ');
}

// -----------------------------------------------------------------------------
// Line classification
// -----------------------------------------------------------------------------

const QUESTION_LINE =
  /^(?:(?:question|q)\s*)?(\d{1,3})\s*[.):\]]\s*(.*)$/i;
const QUESTION_LABEL_ONLY = /^question\s*[:.]?\s*(.*)$/i;

/**
 * Option label plus text. The leading group captures an asterisk that appears
 * before the label (`*B.` / `* B.`); an asterisk sitting after the label is
 * handled separately so that `B. *Abuja` works too.
 */
const OPTION_LINE =
  /^(\*\s*)?\(?([A-Ha-h])\)?\s*(?:[.):\]]|-|–)\s*(.*)$/;

interface Classified {
  kind: 'question' | 'option' | 'text' | 'blank';
  raw: string;
  line: number;
  number?: number;
  label?: string;
  text?: string;
  markedCorrect?: boolean;
}

function classify(raw: string, line: number): Classified {
  const trimmed = raw.trim();
  if (trimmed === '') return { kind: 'blank', raw, line };

  const option = OPTION_LINE.exec(trimmed);
  if (option) {
    const [, leadingStar, label, rest] = option;
    const { text, marked } = stripAnswerMarker(rest ?? '');
    // A single capital letter followed by a full stop is also how a sentence
    // can start ("A. B. C." initials), so require some option text.
    if (text.length > 0) {
      return {
        kind: 'option',
        raw,
        line,
        label: (label ?? '').toUpperCase(),
        text,
        markedCorrect: Boolean(leadingStar) || marked,
      };
    }
  }

  const question = QUESTION_LINE.exec(trimmed);
  if (question) {
    return {
      kind: 'question',
      raw,
      line,
      number: Number.parseInt(question[1] ?? '', 10),
      text: (question[2] ?? '').trim(),
    };
  }

  const labelled = QUESTION_LABEL_ONLY.exec(trimmed);
  if (labelled) {
    return { kind: 'question', raw, line, text: (labelled[1] ?? '').trim() };
  }

  return { kind: 'text', raw, line, text: trimmed };
}

/** Removes an answer asterisk from either end of the option text. */
function stripAnswerMarker(input: string): { text: string; marked: boolean } {
  let text = input.trim();
  let marked = false;

  if (text.startsWith('*')) {
    text = text.slice(1).trim();
    marked = true;
  }
  if (text.endsWith('*')) {
    text = text.slice(0, -1).trim();
    marked = true;
  }

  return { text, marked };
}

// -----------------------------------------------------------------------------
// Parsing
// -----------------------------------------------------------------------------

interface Draft {
  sourceNumber: number | null;
  textParts: string[];
  options: ParsedOption[];
  line: number;
}

export function parseQuestionText(input: string): ParseResult {
  const lines = normaliseText(input).split('\n');
  const classified = lines.map((raw, index) => classify(raw, index + 1));

  const drafts: Draft[] = [];
  const issues: ImportIssue[] = [];

  // The question under construction is always the last draft. Reading it from
  // the array rather than a captured variable keeps TypeScript's narrowing
  // accurate — a closure that reassigns a `let` defeats control-flow analysis.
  const openDraft = (): Draft | null => drafts[drafts.length - 1] ?? null;

  const startQuestion = (item: Classified) => {
    drafts.push({
      sourceNumber: item.number ?? null,
      textParts: item.text ? [item.text] : [],
      options: [],
      line: item.line,
    });
  };

  for (const item of classified) {
    const current = openDraft();

    switch (item.kind) {
      case 'blank':
        break;

      case 'question':
        startQuestion(item);
        break;

      case 'option': {
        if (!current) {
          issues.push({
            severity: 'warning',
            code: 'ORPHAN_TEXT',
            message: `Line ${item.line}: an option appears before any question and was ignored.`,
            questionNumber: null,
            line: item.line,
          });
          break;
        }
        current.options.push({
          label: item.label as string,
          text: item.text as string,
          isCorrect: Boolean(item.markedCorrect),
        });
        break;
      }

      case 'text': {
        const text = item.text ?? '';

        // A plain line once a question already has options means the previous
        // question ended and an unnumbered one is starting.
        if (current && current.options.length > 0) {
          startQuestion({ ...item, kind: 'question' });
          break;
        }

        if (current) {
          current.textParts.push(text);
          break;
        }

        // Text before the first question: a heading, an instruction line, or a
        // question with no number. Treat a line ending in '?' as a question.
        if (text.endsWith('?')) {
          startQuestion({ ...item, kind: 'question' });
        }
        break;
      }
    }
  }

  const questions = drafts
    .map(finaliseDraft)
    .filter((question): question is ParsedQuestion => question !== null)
    .map((question, index) => ({ ...question, number: index + 1 }));

  issues.push(...validate(questions, drafts));

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.length - errorCount;

  return {
    questions,
    issues: issues.sort(compareIssues),
    stats: {
      questionCount: questions.length,
      optionCount: questions.reduce((sum, q) => sum + q.options.length, 0),
      errorCount,
      warningCount,
      withAnswerKey: questions.filter((q) => q.options.some((o) => o.isCorrect)).length,
    },
    valid: errorCount === 0 && questions.length > 0,
  };
}

function finaliseDraft(draft: Draft): ParsedQuestion | null {
  const text = draft.textParts.join(' ').replace(/\s+/g, ' ').trim();

  // A "question" with neither text nor options is a stray heading.
  if (text === '' && draft.options.length === 0) return null;

  return {
    number: 0, // reassigned by the caller
    sourceNumber: draft.sourceNumber,
    text,
    options: draft.options.slice(0, MAX_OPTIONS),
    line: draft.line,
  };
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

function validate(questions: ParsedQuestion[], drafts: Draft[]): ImportIssue[] {
  const issues: ImportIssue[] = [];

  if (questions.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_QUESTIONS',
      message:
        'No questions were found. Check that each question is followed by its options on separate lines.',
      questionNumber: null,
      line: null,
    });
    return issues;
  }

  const seenQuestionText = new Map<string, number>();

  for (const question of questions) {
    const { number, line, options } = question;

    if (question.text.trim() === '') {
      issues.push({
        severity: 'error',
        code: 'EMPTY_QUESTION_TEXT',
        message: `Question ${number} has options but no question text.`,
        questionNumber: number,
        line,
      });
    }

    if (options.length < MIN_OPTIONS) {
      issues.push({
        severity: 'error',
        code: 'TOO_FEW_OPTIONS',
        message: `Question ${number} has ${options.length} option${
          options.length === 1 ? '' : 's'
        }. At least ${MIN_OPTIONS} are needed.`,
        questionNumber: number,
        line,
      });
    } else if (options.length !== EXPECTED_OPTIONS) {
      issues.push({
        severity: 'warning',
        code: 'UNUSUAL_OPTION_COUNT',
        message: `Question ${number} has ${options.length} options. Most questions have ${EXPECTED_OPTIONS}.`,
        questionNumber: number,
        line,
      });
    }

    const correct = options.filter((option) => option.isCorrect);
    if (correct.length === 0) {
      issues.push({
        severity: 'error',
        code: 'NO_CORRECT_OPTION',
        message: `Question ${number} has no correct answer. Put an asterisk (*) immediately before the correct option.`,
        questionNumber: number,
        line,
      });
    } else if (correct.length > 1) {
      issues.push({
        severity: 'error',
        code: 'MULTIPLE_CORRECT_OPTIONS',
        message: `Question ${number} marks ${correct.length} options as correct (${correct
          .map((option) => option.label)
          .join(', ')}). Exactly one is allowed.`,
        questionNumber: number,
        line,
      });
    }

    const labels = new Set<string>();
    const optionTexts = new Set<string>();
    for (const option of options) {
      if (labels.has(option.label)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_OPTION_LABEL',
          message: `Question ${number} uses option letter ${option.label} more than once.`,
          questionNumber: number,
          line,
        });
      }
      labels.add(option.label);

      if (option.text.trim() === '') {
        issues.push({
          severity: 'error',
          code: 'EMPTY_OPTION_TEXT',
          message: `Question ${number}, option ${option.label} has no text.`,
          questionNumber: number,
          line,
        });
      }

      const key = option.text.trim().toLowerCase();
      if (key && optionTexts.has(key)) {
        issues.push({
          severity: 'warning',
          code: 'DUPLICATE_OPTION_TEXT',
          message: `Question ${number} repeats the same option text more than once.`,
          questionNumber: number,
          line,
        });
      }
      optionTexts.add(key);
    }

    const fingerprint = question.text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (fingerprint) {
      const previous = seenQuestionText.get(fingerprint);
      if (previous !== undefined) {
        issues.push({
          severity: 'warning',
          code: 'DUPLICATE_QUESTION',
          message: `Question ${number} repeats question ${previous} word for word.`,
          questionNumber: number,
          line,
        });
      } else {
        seenQuestionText.set(fingerprint, number);
      }
    }
  }

  // Numbering in the source document that jumps or repeats usually means a
  // question was lost during typing — worth flagging, never fatal.
  const numbered = drafts
    .map((draft) => draft.sourceNumber)
    .filter((value): value is number => value !== null);

  if (numbered.length >= 2) {
    const outOfOrder = numbered.some(
      (value, index) => index > 0 && value !== (numbered[index - 1] as number) + 1,
    );
    if (outOfOrder) {
      issues.push({
        severity: 'warning',
        code: 'NON_SEQUENTIAL_NUMBERING',
        message:
          'The question numbers in the document are not sequential. Check that no question was skipped or duplicated.',
        questionNumber: null,
        line: null,
      });
    }
  }

  return issues;
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1 };

function compareIssues(a: ImportIssue, b: ImportIssue): number {
  const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (bySeverity !== 0) return bySeverity;
  return (a.questionNumber ?? 0) - (b.questionNumber ?? 0);
}

// -----------------------------------------------------------------------------
// Presentation helpers
// -----------------------------------------------------------------------------

/** Relabels options A, B, C… so a document that skipped a letter still imports. */
export function normaliseLabels(question: ParsedQuestion): ParsedQuestion {
  const alphabet = 'ABCDEFGH';
  return {
    ...question,
    options: question.options.map((option, index) => ({
      ...option,
      label: alphabet[index] ?? option.label,
    })),
  };
}

export const ISSUE_HELP: Record<ImportIssueCode, string> = {
  NO_QUESTIONS:
    'Each question should be on its own line, followed by its options on the lines beneath it.',
  NO_CORRECT_OPTION:
    'Put an asterisk directly before the correct option, like *B. Abuja',
  MULTIPLE_CORRECT_OPTIONS:
    'Remove the asterisk from every option except the correct one.',
  TOO_FEW_OPTIONS: 'Add the missing options beneath the question.',
  EMPTY_QUESTION_TEXT: 'Type the question above its options.',
  EMPTY_OPTION_TEXT: 'Type the answer text after the option letter.',
  DUPLICATE_OPTION_LABEL: 'Give each option a different letter: A, B, C, D.',
  DUPLICATE_QUESTION: 'Remove the repeated question, or reword one of them.',
  DUPLICATE_OPTION_TEXT: 'Two options say the same thing. Reword one of them.',
  UNUSUAL_OPTION_COUNT:
    'This is only a notice. Import it as it is if the question is meant to be this way.',
  ORPHAN_TEXT: 'Move this line beneath the question it belongs to.',
  NON_SEQUENTIAL_NUMBERING:
    'This is only a notice. Questions are renumbered automatically when imported.',
};
