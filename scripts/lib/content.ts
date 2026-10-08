/**
 * Content source — the single adapter between the MDX tree and every template.
 *
 * WHY THIS EXISTS
 * There are 85 content pages today (170 with both languages) and the number will
 * grow. Nothing in the UI may read the filesystem directly; templates ask this
 * module for records and render whatever they are handed. That is what keeps
 * "170 pages" from becoming "170 implementations".
 *
 * SOURCE OF TRUTH
 * The MDX tree at `content/<lang>/<type-folder>/…`, indexed by the project's own
 * contract `docs/url-routing.md`:
 *
 *   content/<lang>/<type-folder>/[<subpath>/]<slug>.mdx → /<lang>/<type-folder>/[<subpath>/]<slug>
 *
 * The content lives OUTSIDE this app's folder (one level up, in the aihub repo
 * root) because the design pack folder is the frontend's home and must not
 * absorb the content corpus. CONTENT_ROOT is resolved from here and can be
 * overridden with AIHUB_CONTENT_ROOT for tests.
 *
 * SERVER-ONLY, BUILD-TIME ONLY. This module touches the filesystem, so it lives
 * under scripts/ where no component can reach it: `src/lib/data.ts` serves the
 * JSON snapshot this produces, and importing this from a component would make
 * Next trace the entire content tree into the server bundle.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import {
  ALL_TYPES,
  TYPE_BY_DIR,
  TYPE_DIRS,
  type ContentType,
  type Locale,
} from '../../src/lib/locales';

/**
 * Locale list and URL-shape constants come from `./locales`, which is the only
 * module the edge middleware is allowed to import. They are re-exported here so
 * server components have one import site for "content + locales", while the
 * middleware stays free of `node:fs`.
 */
export {
  LOCALES,
  isLocale,
  dirFor,
  TYPE_DIRS,
  TYPE_BY_DIR,
  ALL_TYPES,
  DEFAULT_LOCALE,
  splitLocalePath,
  type Locale,
  type ContentType,
} from '../../src/lib/locales';

/** Content root: `…/aihub/content`, resolved relative to this app. */
export const CONTENT_ROOT =
  process.env.AIHUB_CONTENT_ROOT ?? resolve(process.cwd(), '..', 'content');

export interface PageFrontmatter {
  title?: string;
  slug?: string;
  lang?: string;
  type?: string;
  description?: string;
  summary?: string;
  tags?: string[];
  kind?: string;
  level?: string;
  estimated_minutes?: number;
  position?: number;
  module?: string;
  module_title?: string;
  course?: string;
  course_title?: string;
  next_session?: string;
  previous_session?: string;
  quiz?: string;
  exam?: string;
  assesses?: string;
  modules?: string[];
  sessions?: string[];
  concepts?: string[];
  prerequisites?: string[];
  official_resources?: { title?: string; url?: string }[];
  glossary?: { term?: string; definition?: string }[];
  outcomes?: string[];
  objectives?: string[];
  passes?: string;
  passing_score?: number;
  [key: string]: unknown;
}

export interface Page {
  /** `/<lang>/<type-dir>/<subpath>/<slug>` — the canonical path, no extension. */
  refPath: string;
  /** Content type from frontmatter, validated against TYPE_DIRS. */
  type: ContentType;
  lang: Locale;
  frontmatter: PageFrontmatter;
  /** Markdown body with the frontmatter block removed. */
  body: string;
  file: string;
}

/* -------------------------------------------------------------------------- */
/* Minimal YAML frontmatter reader                                             */
/* -------------------------------------------------------------------------- */
/* Deliberately not a full YAML parser. The content tree is machine-authored and
   uses a narrow subset: scalars, inline `[a, b]` and `{a: 1}` collections, and
   `- ` block sequences. A real parser would be a dependency with no other use.
   Throws on anything it cannot read rather than returning a half-record — a
   silently mis-parsed frontmatter field is exactly how fabricated content ships. */

function parseScalar(raw: string): unknown {
  const v = raw.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d*\.\d+$/.test(v)) return Number(v);
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map((s) => parseScalar(s));
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return {};
    const out: Record<string, unknown> = {};
    for (const part of splitTopLevel(inner)) {
      const i = part.indexOf(':');
      if (i === -1) continue;
      out[part.slice(0, i).trim().replace(/^["']|["']$/g, '')] = parseScalar(
        part.slice(i + 1),
      );
    }
    return out;
  }
  return v;
}

/** Split on commas that are not inside quotes, brackets or braces. */
function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (const ch of input) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function parseFrontmatter(src: string): {
  data: PageFrontmatter;
  body: string;
} {
  const text = src.replace(/^﻿/, '');
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { data: {}, body: text };

  const data: PageFrontmatter = {};
  const lines = m[1].split(/\r?\n/);
  let i = 0;

  /**
   * Indentation of a line, in columns.
   *
   * The character class is [ \t] and NOT a backslash-s: the source is split
   * on a carriage-return-optional newline, but a stray CR can still survive,
   * and a backslash-s matches it. That made every line measure one column
   * deeper than it really was, which broke exactly the comparisons that
   * decide block membership, so a two-level block parsed as an empty one and
   * a sequence of mappings came back with its items missing.
   */
  const indentOf = (l: string): number => {
    const m2 = /^([ \t]*)/.exec(l);
    return m2 ? m2[1].replace(/\t/g, '  ').length : 0;
  };

  /**
   * Read `key: value` from a line, tolerating leading indentation and quoted
   * keys. Returns null when the line is not a mapping entry.
   *
   * Centralised on purpose. This regex was inlined at three call sites, each
   * indexing group 1 for the key and group 2 for the value; widening it to
   * accept quoted keys shifted the groups, so every site read the wrong capture
   * at once. The key may be bare, single-quoted or double-quoted, because a
   * matching question's answer is a map with quoted keys:
   *
   *     correct:
   *       "deterministic-check": "def-deterministic"
   */
  const readEntry = (
    line: string,
  ): { key: string; rest: string } | null => {
    const m = /^[ \t]*(?:"([^"]+)"|'([^']+)'|([A-Za-z_][\w-]*))\s*:\s*(.*)$/.exec(line);
    if (!m) return null;
    const key = m[1] ?? m[2] ?? m[3];
    return { key, rest: m[4] };
  };

  const isBlank = (l: string): boolean => !l.trim() || l.trimStart().startsWith('#');

  /**
   * Read a block that starts at `start` and is indented deeper than
   * `parentIndent`: either a sequence (`- item`) or a mapping (`key: value`).
   * Returns the value and the index of the first line that is no longer part of
   * the block.
   *
   * This is RECURSIVE, which the previous version was not, and that is the whole
   * fix. Assessment frontmatter nests three deep:
   *
   *     questions:            <- mapping key
   *       - id: "q1"          <- sequence of mappings
   *         options:          <- mapping inside a sequence item
   *           - id: "a"       <- sequence inside that mapping
   *             label: "..."  <- mapping inside that sequence item
   *
   * The old reader handled `key:` followed by `- scalar` items and
   * `key:` followed by `sub: value` lines, one level deep. Given a `- id: "q1"`
   * item it took the whole line as a scalar, so every quiz's questions became
   * the single string `id: "q1"` and the UI rendered nothing: 0 inputs, 0
   * radios, 0 form fields on a page whose body said the questions were "not in
   * this build".
   */
  const readBlock = (start: number, parentIndent: number): { value: unknown; next: number } => {
    let j = start;
    // Find the first real line to learn the block's own indent.
    while (j < lines.length && isBlank(lines[j])) j++;
    if (j >= lines.length) return { value: null, next: j };
    const blockIndent = indentOf(lines[j]);
    if (blockIndent <= parentIndent) return { value: null, next: start };

    // --- sequence of items ------------------------------------------------ //
    if (/^\s*-\s+/.test(lines[j]) || /^\s*-\s*$/.test(lines[j])) {
      const items: unknown[] = [];
      while (j < lines.length) {
        if (isBlank(lines[j])) {
          j++;
          continue;
        }
        const ind = indentOf(lines[j]);
        if (ind < blockIndent) break;
        if (ind > blockIndent) break; // deeper than the dash: part of the item
        if (!/^\s*-\s*/.test(lines[j])) break;

        const rest = lines[j].replace(/^\s*-\s*/, '');
        if (rest.trim() === '') {
          // `-` alone, value on following lines.
          const sub = readBlock(j + 1, blockIndent);
          items.push(sub.value);
          j = sub.next;
          continue;
        }
        // `- key: value` — the item is a MAPPING whose first key sits on the
        // dash line. Rewrite the dash as a space so the same mapping reader
        // can parse it, and recurse from this line at the item's own indent.
        //
        // That substitution is the whole trick: `  - id: "q1"` becomes
        // `    id: "q1"` at indent 4, and every following line of the item is
        // already at indent 4 or deeper, so the mapping reader consumes the
        // whole item and stops when it reaches the next `- `.
        if (/^[ \t]*(?:"([^"]+)"|\'([^\']+)\'|([A-Za-z_][\w-]*))\s*:\s*(.*)$/.test(rest)) {
          const itemIndent = ind + 2; // the dash occupies one column plus a space
          lines[j] = ' '.repeat(itemIndent) + rest;
          const inline = readBlock(j, itemIndent - 1);
          items.push(inline.value);
          j = inline.next;
          continue;
        }
        items.push(parseScalar(rest));
        j++;
      }
      return { value: items, next: j };
    }

    // --- mapping ----------------------------------------------------------- //
    const map: Record<string, unknown> = {};
    while (j < lines.length) {
      if (isBlank(lines[j])) {
        j++;
        continue;
      }
      const ind = indentOf(lines[j]);
      if (ind < blockIndent) break;
      // A sequence dash at this level belongs to the enclosing block.
      if (ind === blockIndent && /^\s*-\s*/.test(lines[j])) break;
      // Deeper than the mapping's own indent: not ours.
      if (ind > blockIndent) {
        j++;
        continue;
      }
      const entry = readEntry(lines[j]);
      if (!entry) {
        j++;
        continue;
      }
      const { key, rest } = entry;
      if (rest.trim() === '') {
        const sub = readBlock(j + 1, blockIndent);
        map[key] = sub.value;
        j = sub.next;
        continue;
      }
      map[key] = parseScalar(rest);
      j++;
    }
    return { value: map, next: j };
  };

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const entry = readEntry(line);
    if (!entry) {
      i++;
      continue;
    }
    const { key, rest } = entry;
    if (rest.trim() === '') {
      const sub = readBlock(i + 1, 0);
      data[key] = sub.value;
      i = sub.next;
      continue;
    }
    data[key] = parseScalar(rest);
    i++;
  }

  return { data, body: text.slice(m[0].length) };
}

/* -------------------------------------------------------------------------- */
/* Filesystem walk                                                             */
/* -------------------------------------------------------------------------- */

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

export function contentRootExists(): boolean {
  return existsSync(CONTENT_ROOT);
}

/** Read every page for a locale, or an empty list when the tree is absent. */
export function loadPages(lang: Locale): Page[] {
  const pages: Page[] = [];
  for (const [type, dir] of Object.entries(TYPE_DIRS) as [ContentType, string][]) {
    const base = join(CONTENT_ROOT, lang, dir);
    for (const file of walk(base)) {
      const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'));
      const declared = typeof data.type === 'string' ? data.type : type;
      if (!ALL_TYPES.includes(declared as ContentType)) continue;
      const rel = file
        .slice(base.length + 1)
        .replace(/\.mdx$/, '')
        .split(sep)
        .join('/');
      pages.push({
        refPath: `${dir}/${rel}`,
        type: declared as ContentType,
        lang,
        frontmatter: { ...data, type: declared, lang },
        body,
        file,
      });
    }
  }
  return pages;
}

/** Resolve a `/<lang>/<type-dir>/<…>` path to a page, or null. */
export function getPage(lang: Locale, refPath: string): Page | null {
  const file = join(CONTENT_ROOT, lang, `${refPath}.mdx`);
  if (!existsSync(file)) return null;
  const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'));
  const dir = refPath.split('/')[0];
  const type = TYPE_BY_DIR[dir];
  if (!type) return null;
  return {
    refPath,
    type: type as ContentType,
    lang,
    frontmatter: { ...data, type, lang },
    body,
    file,
  };
}

export function listByType(lang: Locale, type: ContentType): Page[] {
  return loadPages(lang).filter((p) => p.type === type);
}

/**
 * Strip frontmatter and return the first meaningful paragraph — used for meta
 * descriptions and card summaries when the page has no explicit `summary`.
 */
export function firstParagraph(body: string): string {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^---[\s\S]*?---/, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>]/g, ' ');
  for (const para of cleaned.split(/\n{2,}/)) {
    const t = para.trim().replace(/\s+/g, ' ');
    if (t.length > 40) return t;
  }
  return '';
}