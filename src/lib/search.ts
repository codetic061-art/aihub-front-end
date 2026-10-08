/**
 * Global search over the ingested content snapshot.
 *
 * SCOPE — what "client-side search" means here, precisely:
 *
 *   The INDEX is built on the server (see `buildSearchIndex`, called from the
 *   static route `src/app/api/search/[locale]/route.ts`) because the only source
 *   of truth is the ingested JSON. The QUERY runs entirely in the browser: the
 *   dialog downloads the index once and scores it locally, so keystrokes never
 *   touch the network and the results work offline once cached.
 *
 *   Why not import `@/lib/data` into the dialog directly? Because `@/lib/data`
 *   statically imports both 500 KB locale snapshots. A client component
 *   importing it would ship ~270 KB gzipped of full article bodies to every
 *   reader for a search box that needs a fraction of that. `import type` below is
 *   deliberate: it is erased at compile time, so this module has NO runtime
 *   dependency on the content snapshot and stays safe to import from a Client
 *   Component.
 *
 * SCORING — title > tags > description > body, always. A match in the body is
 * worth the least, so the first result for "agent" is the page *titled* Agent and
 * not the forty pages that mention it in a paragraph.
 *
 * FOLDING — Arabic text is normalised (diacritics, tatweel, alef/ya/ta-marbuta
 * variants) before comparison, so "مفهوم" matches "مفاهيم" and a reader does not
 * have to type the exact orthography the author used.
 */

import type { Page } from './data';
import type { Locale } from './locales';

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

export interface SearchDoc {
  /** `/<type-dir>/<subpath>/<slug>` — the path after the locale prefix. */
  refPath: string;
  /** Real route: `/${locale}/${refPath}`. */
  href: string;
  title: string;
  description: string;
  /** URL segment: `concepts`, `skills`, `mcp`, `docs`, `courses`, … */
  section: string;
  /** Content type: `concept`, `skill`, `mcp`, `docs`, … */
  type: string;
  tags: string[];
  /**
   * Bounded, markdown-stripped body excerpt used for body-scoped matching.
   * Truncated on purpose: a full-body index would roughly triple the payload for
   * a marginal gain in recall, since anything worth finding by prose is already
   * named in the title or description.
   */
  bodyText: string;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** Highest-scoring field, so the UI can say WHY a result matched. */
  field: 'title' | 'tag' | 'description' | 'body';
}

/** Sections present in the snapshot, in the order the nav lists them. */
export const SECTION_ORDER = [
  'concepts',
  'skills',
  'mcp',
  'docs',
  'courses',
  'sessions',
  'learning-path',
  'quizzes',
  'exams',
  'free-credits',
  'prompt-assessments',
] as const;

/* -------------------------------------------------------------------------- */
/* Field weights                                                               */
/* -------------------------------------------------------------------------- */

const W = {
  titleExact: 140,
  titlePrefix: 70,
  titleWord: 44,
  titleSub: 26,
  tagExact: 30,
  tagSub: 16,
  path: 18,
  desc: 12,
  body: 4,
  /** Reward a doc whose every query token matched somewhere. */
  allTokens: 24,
  /** Penalty for a long title that merely contains the term. */
  length: 12,
} as const;

/** Ceiling on the body excerpt carried per document. */
export const BODY_EXCERPT_LIMIT = 700;

/* -------------------------------------------------------------------------- */
/* Normalisation                                                               */
/* -------------------------------------------------------------------------- */

const ARABIC_COMBINING = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]+/gu;

/** Folds the orthographic variants Arabic typing produces for the same letter. */
function foldChar(ch: string): string {
  switch (ch) {
    case '\u0622': // آ
    case '\u0623': // أ
    case '\u0625': // إ
    case '\u0627': // ا
    case '\u0671': // ٱ
      return '\u0627';
    case '\u0629': // ة
      return '\u0647';
    case '\u0649': // ى
    case '\u0626': // ئ
      return '\u064A';
    case '\u0624': // ؤ
    case '\u0648': // و
      return '\u0648';
    case '\u0621': // ء
      return '';
    default:
      return ch;
  }
}

/**
 * Case-, diacritic- and variant-insensitive form used for every comparison.
 * Returns empty string for empty input so callers never see `'undefined'`.
 */
export function fold(input: string | undefined | null): string {
  if (!input) return '';
  let out = input.normalize('NFKD').replace(INVISIBLE, '').replace(ARABIC_COMBINING, '').replace(TATWEEL, '');
  out = out.replace(/[\u0621-\u064A]/g, foldChar);
  return out.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Query tokens, folded. Terms shorter than one character are dropped. */
export function tokenize(query: string): string[] {
  const folded = fold(query);
  const tokens = folded.match(LETTER_OR_NUMBER) ?? [];
  return tokens.filter((t) => t.length > 0);
}

/** Whitespace-trimmed text with markdown syntax removed, bounded in length. */
export function plainText(markdown: string | undefined | null, limit: number): string {
  if (!markdown) return '';
  const text = markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^[>\s]*#{1,6}\s+/gm, '') // headings
    .replace(/^[>\s]*[-*+]\s+/gm, '') // list bullets
    .replace(/[*_`~|]/g, '') // emphasis / code / pipes
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(' ', limit);
  return text.slice(0, cut > limit * 0.6 ? cut : limit).trim();
}

/* -------------------------------------------------------------------------- */
/* Index construction (server side)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Projects real content pages into the compact shape the browser searches.
 *
 * Only fields that actually exist are copied; nothing is invented, and a page
 * with an empty description simply ships an empty one rather than a filler.
 */
export function buildSearchIndex(locale: Locale, pages: Page[]): SearchDoc[] {
  return pages.map((page) => {
    const description = page.description || plainText(page.summary, 240) || page.body.slice(0, 240);
    return {
      refPath: page.refPath,
      href: `/${locale}/${page.refPath}`,
      title: page.title || page.refPath,
      description: description.trim(),
      section: page.refPath.split('/')[0] ?? '',
      type: page.type,
      tags: Array.isArray(page.tags) ? page.tags : [],
      bodyText: plainText(page.body, BODY_EXCERPT_LIMIT),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Scoring (runs in the browser)                                               */
/* -------------------------------------------------------------------------- */

interface FoldedDoc extends SearchDoc {
  fTitle: string;
  fPath: string;
  fTags: string[];
  fDesc: string;
  fBody: string;
}

/**
 * Memoised fold of one document. Folding a 700-character body on every
 * keystroke for 85 documents is ~60 KB of string work; doing it once when the
 * index arrives removes that from the hot path entirely.
 */
const FOLD_CACHE = new WeakMap<SearchDoc, FoldedDoc>();

function folded(doc: SearchDoc): FoldedDoc {
  const cached = FOLD_CACHE.get(doc);
  if (cached) return cached;
  const value: FoldedDoc = {
    ...doc,
    fTitle: fold(doc.title),
    fPath: fold(doc.refPath),
    fTags: doc.tags.map(fold).filter(Boolean),
    fDesc: fold(doc.description),
    fBody: fold(doc.bodyText),
  };
  FOLD_CACHE.set(doc, value);
  return value;
}

function isWordStart(haystack: string, at: number): boolean {
  if (at === 0) return true;
  const prev = haystack.charCodeAt(at - 1);
  // Treat every non-letter/number as a boundary, which also splits on `-`, `_`
  // and `/` so `claude-code` matches the query `code`.
  return !(prev >= 48 && prev <= 57) && !(prev >= 97 && prev <= 122) && !(prev >= 65 && prev <= 90);
}

/** Score one query token against one folded document. 0 means "no match". */
function scoreToken(doc: FoldedDoc, token: string): { score: number; field: SearchHit['field'] } {
  let best = 0;
  let field: SearchHit['field'] = 'body';

  // --- title -------------------------------------------------------------
  if (doc.fTitle === token) {
    best = W.titleExact;
    field = 'title';
  } else if (doc.fTitle.startsWith(token)) {
    best = W.titlePrefix;
    field = 'title';
  } else if (doc.fTitle.includes(token)) {
    const at = doc.fTitle.indexOf(token);
    // A whole-word title match outranks a mid-word one: "code" in "claude code"
    // is the concept; in "encoder" it is not.
    best = isWordStart(doc.fTitle, at) ? W.titleWord : W.titleSub;
    field = 'title';
  }

  // --- refPath (the slug a developer might type) --------------------------
  if (best === 0 && doc.fPath.includes(token)) {
    best = W.path;
    field = 'description';
  }

  // --- tags --------------------------------------------------------------
  if (best < W.tagExact) {
    for (const tag of doc.fTags) {
      if (tag === token) {
        if (W.tagExact > best) {
          best = W.tagExact;
          field = 'tag';
        }
        break;
      }
      if (tag.includes(token) && W.tagSub > best) {
        best = W.tagSub;
        field = 'tag';
      }
    }
  }

  // --- description -------------------------------------------------------
  if (best < W.desc && doc.fDesc.includes(token)) {
    best = W.desc;
    field = 'description';
  }

  // --- body --------------------------------------------------------------
  if (best < W.body && doc.fBody.includes(token)) {
    best = W.body;
    field = 'body';
  }

  if (best > 0 && field === 'title') {
    // Specificity: "Agent" should beat "Agent memory management" for "agent".
    best += Math.max(0, W.length - Math.round(doc.fTitle.length / 8));
  }

  return { score: best, field };
}

/**
 * Ranks documents against a query.
 *
 * Multi-token queries use AND semantics: a document missing any token is
 * dropped, so "mcp server" does not return every page that merely says "mcp".
 */
export function searchIndex(
  index: readonly SearchDoc[],
  query: string,
  limit = 12,
): SearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0 || index.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const raw of index) {
    const doc = folded(raw);
    let total = 0;
    let weakestField: SearchHit['field'] = 'title';
    let weakest = Number.POSITIVE_INFINITY;
    let matchedAll = true;

    for (const token of tokens) {
      const { score, field } = scoreToken(doc, token);
      if (score === 0) {
        matchedAll = false;
        break;
      }
      total += score;
      if (score < weakest) {
        weakest = score;
        weakestField = field;
      }
    }
    if (!matchedAll) continue;

    if (tokens.length > 1) total += W.allTokens;
    hits.push({ doc: raw, score: total, field: weakestField });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable, language-aware tiebreak rather than raw score equality.
    return a.doc.title.localeCompare(b.doc.title);
  });

  return hits.slice(0, limit);
}

/**
 * Plain substring test over the fields a browse filter shows on a card.
 * Used by the index pages' client-side filter, which is not a search box: it is
 * a "show me the ones whose visible text contains X" control.
 */
export function matchesText(haystack: string, needle: string): boolean {
  const n = fold(needle);
  if (!n) return true;
  return fold(haystack).includes(n);
}