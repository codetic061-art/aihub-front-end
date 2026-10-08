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
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const total: Record<string, number> = {};
  let grandTotal = 0;

  for (const lang of LOCALES as readonly Locale[]) {
    const pages = loadPages(lang).map(toSnapshot);
    const out = join(OUT_DIR, `${lang}.json`);
    writeFileSync(out, JSON.stringify(pages, null, 0), 'utf8');
    total[lang] = pages.length;
    grandTotal += pages.length;
    console.log(`  ${lang}: ${pages.length} pages → src/content/${lang}.json`);
  }

  /**
   * A sanity gate, not a formality. The project's own validator already refuses
   * a content tree with a dangling pageref or an unmirrored Arabic page; this
   * re-checks the two invariants that would silently produce broken pages if the
   * ingest were run against a partial tree.
   */
  const en = JSON.parse(readFileSync(join(OUT_DIR, 'en.json'), 'utf8')) as SnapshotPage[];
  const ar = JSON.parse(readFileSync(join(OUT_DIR, 'ar.json'), 'utf8')) as SnapshotPage[];
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