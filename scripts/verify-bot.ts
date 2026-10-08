/**
 * BOT V2 — geometry + render gate.
 *
 * Two layers, because they catch different failures:
 *
 *   1. SOURCE — the traced paths are present and well-formed, the state and pose
 *      tables are complete, and the palette/theming contract holds.
 *   2. RENDER — the figure is rasterised headlessly and the pixels are measured.
 *
 * Layer 2 is not optional. An earlier version rebuilt the bot from the design
 * pack's proportional anatomy and every source-level check passed while the
 * rendered figure was visibly wrong: the helmet too narrow, the arms detached,
 * the legs hidden behind the torso, the boots as four separate blobs. Checks
 * that read the source cannot see geometry that is present but mis-assembled,
 * and they cannot see a missing fill at all — an earlier revision emitted
 * capsules with no `fill`, which rasterised as an empty head above four floating
 * rings while every proportion assertion still passed.
 *
 * So the figure is rendered and measured, and the silhouette is compared against
 * the reference it was traced from.
 *
 * Run: npm run verify:bot
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BotFigure, BOT_VIEWBOX, FACES, POSES, H, FIG_W } from '../src/components/bot/parts';

const PARTS = join(process.cwd(), 'src/components/bot/parts.tsx');
const BOT = join(process.cwd(), 'src/components/bot/bot.tsx');
const src = readFileSync(PARTS, 'utf8');
const bot = readFileSync(BOT, 'utf8');

let failures = 0;
const fail = (m: string) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m: string) => console.log(`  ok    ${m}`);

/* ================================================================== *
 * LAYER 1 — SOURCE
 * ================================================================== */

console.log('\n— traced geometry —');

const outer = /const OUTER = "([^"]+)";/.exec(src)?.[1] ?? '';
const inner = /const INNER = "([^"]+)";/.exec(src)?.[1] ?? '';
const visor = /const VISOR_D = "([^"]+)";/.exec(src)?.[1] ?? '';

outer.length > 200
  ? pass(`silhouette path traced (${outer.length} chars)`)
  : fail('silhouette path missing or truncated — the figure has no outline');

inner.length > 500
  ? pass(`interior detail lines traced (${inner.length} chars)`)
  : fail('interior detail lines missing — chest panel, ear ring and joints are gone');

visor.length > 100
  ? pass(`visor path traced (${visor.length} chars)`)
  : fail('visor path missing');

const subpaths = (d: string) => (d.match(/M /g) ?? []).length;
subpaths(inner) >= 10
  ? pass(`interior has ${subpaths(inner)} sub-paths (chest, ear, knees, boot tops, face edges)`)
  : fail(`interior has only ${subpaths(inner)} sub-paths; expected the full detail set`);

// Every path must be a closed shape — an unclosed contour renders as a
// straight-line seam, which is how the traced version first came out.
const unclosed = [...outer, ...inner, ...visor].filter((_, i) => false);
const allPaths = [
  ['silhouette', outer],
  ['interior', inner],
  ['visor', visor],
] as const;
let bad = 0;
for (const [name, d] of allPaths) {
  const m = d.match(/M /g)?.length ?? 0;
  const z = d.match(/Z/g)?.length ?? 0;
  if (m !== z) { fail(`${name}: ${m} sub-paths but ${z} Z closes — unclosed contour will show a seam`); bad++; }
}
if (bad === 0) pass('every traced sub-path is closed (M count == Z count)');

console.log('\n— figure contract —');
H === 256
  ? pass(`design height ${H} units`)
  : fail(`design height should be 256, got ${H}`);
FIG_W > 0 && FIG_W < H
  ? pass(`figure is taller than wide (${FIG_W}x${H}, w:h ${(FIG_W / H).toFixed(3)})`)
  : fail(`figure proportion is wrong: ${FIG_W}x${H}`);

// Silhouette proportion, measured against the reference rather than a constant.
//
// The old gate asserted w:h 0.547, taken from the PREVIOUS reference — a
// cream-filled figure with both arms at its sides. The current reference extends
// one arm horizontally, so it is legitimately wider and measures 0.704. Keeping
// the old number failed a correct trace. The check now compares the traced
// outline's own bounding box against the reference, so it catches a figure that
// has drifted while staying valid for a figure that has changed pose.
const REF_WH = 0.704;

const outerPts = [...outer.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
  Number(m[1]),
  Number(m[2]),
]);
const ox = outerPts.map((p) => p[0]);
const oy = outerPts.map((p) => p[1]);
const figW = Math.max(...ox) - Math.min(...ox);
const figH = Math.max(...oy) - Math.min(...oy);
const wh = figW / figH;

Math.abs(wh - REF_WH) < 0.03
  ? pass(`traced silhouette w:h ${wh.toFixed(3)} — within 0.03 of the reference's ${REF_WH}`)
  : fail(`traced silhouette w:h ${wh.toFixed(3)} has drifted from the reference's ${REF_WH}`);

// The figure must sit inside the declared viewBox, or it clips.
figW <= FIG_W + 0.5 && figH <= H + 0.5
  ? pass(`figure ${figW.toFixed(1)}x${figH.toFixed(1)} fits the ${FIG_W}x${H} viewBox`)
  : fail(`figure ${figW.toFixed(1)}x${figH.toFixed(1)} overflows the ${FIG_W}x${H} viewBox`);

console.log('\n— palette + theming —');
// --bot-fill is deliberately absent. The body carries no fill because the
// reference is unfilled line art; a cream body darkens the whole figure against
// the page. --bot-fill still exists as a token for the genuinely cream card.
for (const tok of ['--bot-stroke', '--bot-visor', '--bot-eye']) {
  src.includes(tok) ? pass(`colour comes from ${tok}`) : fail(`missing ${tok}`);
}
for (const bad2 of ['--color-blue', '--color-orange', '--color-accent']) {
  src.includes(bad2)
    ? fail(`the bot must carry no accent colour: ${bad2}`)
    : pass(`no ${bad2} on the bot`);
}

// The body must stay unfilled. An earlier revision wrapped the silhouette in a
// cream fill layer; against light paper that turns the character into a solid
// blob and the style is lost.
src.includes('id="bot-body"')
  ? fail('a bot-body FILL layer exists; the reference is unfilled line art')
  : pass('no body fill layer — the figure is line art, as the reference is');

console.log('\n— states and poses —');
const STATES = [
  'welcome', 'exploring', 'learning', 'thinking', 'reading', 'pointing',
  'recommending', 'searching', 'testing', 'success', 'warning', 'updating',
  'idle', 'error', 'celebration',
];
const absent = STATES.filter((s) => !(s in FACES));
absent.length === 0
  ? pass(`all ${STATES.length} brief states exist`)
  : fail(`missing states: ${absent.join(', ')}`);

const sigs = new Set(
  Object.values(FACES).map((f) => `${f.eyes.dx},${f.eyes.dy},${f.eyes.ry},${f.eyes.rx},${f.curve},${f.width}`),
);
sigs.size === Object.keys(FACES).length
  ? pass(`all ${Object.keys(FACES).length} states are visually distinct`)
  : fail(`${Object.keys(FACES).length} states collapse to ${sigs.size} distinct faces`);

// The face is fixed by the design pack: two eyes and one mouth, nothing else.
const faceEllipses = (src.match(/className="bot-eye"/g) ?? []).length;
const faceMouths = (src.match(/className="bot-mouth"/g) ?? []).length;
faceEllipses === 2
  ? pass('exactly 2 eyes in the face layer')
  : fail(`face layer has ${faceEllipses} eyes; L1 fixes two`);
faceMouths === 1
  ? pass('exactly 1 mouth arc in the face layer')
  : fail(`face layer has ${faceMouths} mouths; L1 fixes one`);
for (const forbidden of ['antenna', 'cheek', 'eyebrow']) {
  src.includes(forbidden) ? fail(`L1 forbids ${forbidden}`) : pass(`no ${forbidden}`);
}

const POSES_REQ = [
  'standing', 'pointing', 'waving', 'thinking', 'reading',
  'celebrating', 'floating', 'sitting', 'typing',
];
const missingPoses = POSES_REQ.filter((p) => !(p in POSES));
missingPoses.length === 0
  ? pass(`all ${POSES_REQ.length} poses exist`)
  : fail(`missing poses: ${missingPoses.join(', ')}`);

bot.includes('BotContactSheet')
  ? pass('contact sheet present — variants compared, not judged one at a time')
  : fail('no contact sheet');
bot.includes('prefers-reduced-motion')
  ? pass('reduced-motion respected')
  : fail('no prefers-reduced-motion handling');

/* ================================================================== *
 * LAYER 2 — RENDERED PIXELS
 * ================================================================== */

console.log('\n— rendered pixels —');

const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

if (!chrome) {
  fail('no Chromium on this machine — render checks cannot run. This is a gap, not a skip.');
} else {
  const dir = mkdtempSync(join(tmpdir(), 'botchk-'));
  try {
    /** Minimal React-element serialiser — avoids pulling in a renderer. */
    const toSvg = (node: unknown): string => {
      if (node === null || node === undefined || node === false) return '';
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(toSvg).join('');
      const el = node as { type: unknown; props: Record<string, unknown> };
      if (typeof el.type === 'function') return toSvg((el.type as (p: unknown) => unknown)(el.props));
      const tag = el.type as string;
      const attrs: string[] = [];
      for (const [k, v] of Object.entries(el.props ?? {})) {
        if (v === null || v === undefined || v === false || k === 'children') continue;
        attrs.push(`${k}="${String(v).replace(/"/g, '&quot;')}"`);
      }
      const inner = toSvg(el.props?.children);
      const a = attrs.join(' ');
      return inner ? `<${tag} ${a}>${inner}</${tag}>` : `<${tag} ${a}/>`;
    };

    const render = (state: string, pose: string) =>
      toSvg(BotFigure({ state, pose }))
        .replace(/var\(--bot-fill,\s*([^)]+)\)/g, '$1')
        .replace(/var\(--bot-stroke,\s*([^)]+)\)/g, '$1')
        .replace(/var\(--bot-visor,\s*([^)]+)\)/g, '$1')
        .replace(/var\(--bot-eye,\s*([^)]+)\)/g, '$1');

    const body = render('welcome', 'standing');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BOT_VIEWBOX}" width="400" height="540">${body}</svg>`;
    const htmlPath = join(dir, 'b.html');
    writeFileSync(
      htmlPath,
      `<!doctype html><body style="margin:0;background:#FBF8F2">${svg}</body>`,
      'utf8',
    );

    const png = join(dir, 'b.png');
    execFileSync(
      chrome,
      [
        '--headless', '--disable-gpu', '--hide-scrollbars',
        `--screenshot=${png}`,
        '--window-size=420,560',
        `file:///${htmlPath.replace(/\\/g, '/')}`,
      ],
      { stdio: 'pipe', timeout: 120000 },
    );

    const py = join(dir, 'm.py');
    writeFileSync(
      py,
      [
        'from PIL import Image',
        'import numpy as np, json',
        `im = Image.open(r"${png.replace(/\\/g, '/')}").convert("RGB")`,
        'a = np.asarray(im).astype(int)',
        'bg = np.array([251, 248, 242])',
        'ink = np.linalg.norm(a - bg, axis=2) > 22',
        'ys, xs = np.nonzero(ink)',
        'if not len(ys):',
        '    print(json.dumps({"error": "no ink"})); raise SystemExit',
        'top, bot_y = int(ys.min()), int(ys.max())',
        'h = bot_y - top + 1',
        'w = int(xs.max() - xs.min() + 1)',
        'cov = {}',
        'n = 10',
        'for i in range(n):',
        '    y0, y1 = top + h * i // n, top + h * (i + 1) // n',
        '    seg = ink[y0:y1]',
        '    cols = np.nonzero(seg.any(axis=0))[0]',
        '    ww = int(cols.max() - cols.min() + 1) if len(cols) else 1',
        '    cov[str(i)] = round(float(seg.sum()) / max(ww, 1), 2)',
        'print(json.dumps({"h": h, "w": w, "cov": cov}))',
      ].join('\n'),
      'utf8',
    );

    const m = JSON.parse(execFileSync('python', [py], { encoding: 'utf8' }).trim());

    if (m.error) {
      fail(`render produced no ink (${m.error})`);
    } else {
      pass(`rendered ink bbox ${m.w}x${m.h}px`);

      m.h > m.w
        ? pass(`figure is taller than wide (${m.h} vs ${m.w})`)
        : fail(`figure not taller than wide: ${m.w} wide x ${m.h} tall`);

      // The body must be a FILLED silhouette. A missing fill shows as low
      // coverage in the middle bands; this is the v1 empty-limb regression.
      const mid = Math.min(m.cov['4'], m.cov['5']);
      mid > 1.0
        ? pass(`torso band is solid (min coverage ${mid})`)
        : fail(`torso band coverage ${mid} — the body is hollow, the v1 bug is back`);

      // The visor is a large solid dark mass in the upper third.
      const visorCov = m.cov['1'];
      visorCov > 3
        ? pass(`visor band is a filled mass (coverage ${visorCov})`)
        : fail(`visor band coverage ${visorCov} — the visor is not filled`);

      // The lower third must carry the legs and boots.
      const low = Math.min(m.cov['7'], m.cov['8']);
      low > 0.4
        ? pass(`legs/boots band has mass (coverage ${low})`)
        : fail(`legs band coverage ${low} — legs or boots are missing`);
    }
  } catch (e) {
    fail(`render check errored: ${(e as Error)?.message ?? e}`);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

console.log(
  failures === 0 ? '\nbot: all checks passed' : `\nbot: ${failures} failure(s)`,
);
process.exit(failures === 0 ? 0 : 1);