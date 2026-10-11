/**
 * Seed process.env from `.env.production` for tooling scripts.
 *
 * WHY THIS EXISTS
 * `next build` / `next dev` auto-load `.env.production`, but a bare
 * `tsx scripts/foo.ts` does NOT. Any script that reads a build-time
 * `NEXT_PUBLIC_*` value (via `src/lib/site`) would therefore see the placeholder
 * default when run directly, while the actual build emitted the real value — a
 * false failure in the launch gate, or worse, a false pass.
 *
 * This module's body runs as a side effect at import time. Because ES `import`
 * is hoisted and evaluated in source order, importing this module FIRST (before
 * `src/lib/site`) guarantees the env is populated before `site.ts` reads it.
 * Top-level `await` is not an option in these CJS scripts, and a plain top-level
 * statement runs after all hoisted imports — so a side-effect module is the one
 * mechanism with the correct ordering.
 *
 * PRECEDENCE: an explicit shell export always wins over the file, matching the
 * precedence Next.js itself applies. This only fills in what is unset.
 *
 * It introduces NO second copy of any value — it only populates process.env so
 * the canonical reader (`src/lib/site`) resolves the same value during build and
 * during verification.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const envFile = join(process.cwd(), '.env.production');
if (!existsSync(envFile)) {
  // No production env file: leave the environment untouched. Scripts still run;
  // `src/lib/site` falls back to its documented default and the launch gate will
  // (correctly) flag the placeholder rather than silently pretending it is set.
} else {
  const raw = readFileSync(envFile, 'utf8');
  for (const line of raw.split('\n')) {
    // Skip comments and blank lines.
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!m) continue;
    const [, key, val] = m;
    if (process.env[key] === undefined) {
      // Strip a single pair of surrounding quotes if present.
      process.env[key] = val.replace(/^(['"])(.*)\1$/, '$2').trim();
    }
  }
}
