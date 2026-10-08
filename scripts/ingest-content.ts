/**
 * Build-time content ingest: MDX tree → one static JSON snapshot per locale.
 *
 * WHY THIS EXISTS
 * Reading the MDX tree at request time (or build time inside a Server Component)
 * makes Next trace the entire content directory into the server bundle — the
 * build warns about exactly that, and it is correct to warn. It also means the
 * "filesystem" is a runtime dependency of a static site.
 *
 * So content is ingested ONCE, here, into `src/content/<locale>.json`. After
 * that the app imports plain JSON: no `node:fs` in any component, no tracing,
 * fully static output, and the 170+ routes prerender from data.
 *
 * Run automatically by `prebuild` and `predev` (see package.json). Re-run it
 * manually with:  npm run ingest
 *
 * The snapshot is committed-adjacent build output, not a source of truth — the
 * MDX files are. If they disagree, the MDX files win and this must be re-run.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadPages,
  getPage,
  firstParagraph,
  LOCALES,
  type Locale,
  type Page,
  CONTENT_ROOT,
  contentRootExists,
} from './lib/content';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '..', 'src', 'content');

/** Only the fields a template can render. Keeps the snapshot small and reviewable. */
interface SnapshotPage {
  refPath: string;
  type: string;
  title: string;
  description: string;
  summary: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  body: string;
  /** Words in the body — drives reading-time and list previews. */
  words: number;
}

function toSnapshot(p: Page): SnapshotPage {
  const fm = p.frontmatter as Record<string, unknown>;
  const description =
    typeof fm.description === 'string' && fm.description.trim()
      ? fm.description.trim()
      : firstParagraph(p.body).slice(0, 200);

  const summary =
    typeof fm.summary === 'string' && fm.summary.trim()
      ? fm.summary.trim()
      : '';

  const words = p.body.split(/\s+/).filter(Boolean).length;

  return {
    refPath: p.refPath,
    type: p.type,
    title: typeof fm.title === 'string' ? fm.title : p.refPath,
    description,
    summary,
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    frontmatter: fm,
    body: p.body,
    words,
  };
}

function main(): void {
  // No MDX tree means there is nothing to ingest. The recovered snapshot in
  // src/content IS the content of record (see CONTENT_ROOT in lib/content.ts),
  // so exiting 0 here is what lets `prebuild` continue instead of failing the
  // build or — far worse — overwriting the snapshot with an empty array.
  if (!contentRootExists()) {
    const en = join(OUT_DIR, 'en.json');
    const n = existsSync(en)
      ? (JSON.parse(readFileSync(en, 'utf8')) as unknown[]).length
      : 0;
    console.log(
      `ingest: no MDX tree at ${CONTENT_ROOT}; using the existing snapshot ` +
        `(${n} pages per locale). Nothing written.`,
    );
    return;
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

    const total: Record<string, number> = {};
let grandTotal = 0;

// Build both locales IN MEMORY first. Writing before the invariants are checked
// is how 85 pages per locale were once replaced with `[]`: the write happened,
// then the gate failed, and the "failing" run left an empty site behind. A
// sanity gate that runs after the damage is not a gate.
const built: Record<string, SnapshotPage[]> = {};
for (const lang of LOCALES as readonly Locale[]) {
const pages = loadPages(lang).map(toSnapshot);
if (pages.length === 0) {
console.error(
`\nFAILED: ingest produced 0 pages for "${lang}".\n` +
`  Source tree: ${CONTENT_ROOT}\n` +
'  Refusing to overwrite src/content with an empty site. The MDX tree is\n' +
'  missing or unreadable — restore it, or set AIHUB_CONTENT_ROOT to the\n' +
'  directory that holds it. Nothing was written.',
);
process.exit(1);
}
built[lang] = pages;
total[lang] = pages.length;
grandTotal += pages.length;
console.log(`  ${lang}: ${pages.length} pages (validated in memory, not yet written)`);
}

const en = built.en;
const ar = built.ar;
const enRefs = new Set(en.map((p) => p.refPath));

const orphans = ar.filter((p) => !enRefs.has(p.refPath));
if (orphans.length) {
console.error(
`\nFAILED: ${orphans.length} Arabic page(s) have no English mirror:\n` +
orphans.slice(0, 8).map((p) => `  ${p.refPath}`).join('\n'),
);
process.exit(1);
}

const emptyTitle = en.filter((p) => !p.title || !p.title.trim());
if (emptyTitle.length) {
console.error(
`\nFAILED: ${emptyTitle.length} page(s) have no title:\n` +
emptyTitle.slice(0, 8).map((p) => `  ${p.refPath}`).join('\n'),
);
process.exit(1);
}

// Only now is it safe to touch the snapshot on disk.
for (const lang of LOCALES as readonly Locale[]) {
const out = join(OUT_DIR, `${lang}.json`);
writeFileSync(out, JSON.stringify(built[lang], null, 0), 'utf8');
console.log(`  wrote src/content/${lang}.json (${built[lang].length} pages)`);
}

    // Confirm the reader still resolves a known record from disk — guards against
    // the snapshot and the tree drifting apart unnoticed.
    const probe = getPage('en', 'concepts/token');
    if (!probe) {
console.error('\nFAILED: content/en/concepts/token.mdx is not readable.');
process.exit(1);
    }

    console.log(`\ningested ${grandTotal} pages total; invariants hold`);
}

main();