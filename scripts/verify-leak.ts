/**
 * ANSWER-KEY LEAK GATE
 *
 * Greps the BUILT, SERVED pages for anything that would let a reader score
 * themselves without attempting the assessment.
 *
 * WHY THIS IS A SEPARATE GATE
 *
 * "I stripped the keys before rendering" is not the same claim as "the keys are
 * not in the document", and only the second one matters. The leak here came
 * through a second route nobody was watching: `stripAnswerKey` did its job on
 * the questions array, while the island ALSO received `page` — the whole Page
 * object. These are Client Components, so React serialises their props into the
 * RSC payload embedded in the HTML, which put the frontmatter straight back into
 * the page source:
 *
 *   "answer":{"kind":"choice","correct":["no-baseline"]}
 *
 * Every distractor's `reason_wrong` came with it, and since only the correct
 * option lacks a `reason_wrong`, the key was readable by inspection even without
 * parsing the `correct` array.
 *
 * A source-level assertion cannot catch that. The props typechecked, the build
 * was clean, all 85 routes returned 200, and the page still leaked. The only
 * thing that finds it is looking at the bytes the server actually sends.
 *
 * Run: npm run verify:leak   (needs a server; use scripts/serve-and-check.sh)
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.AIHUB_LEAK_PORT ?? 3217);
const BASE = `http://127.0.0.1:${PORT}`;

/** Paths that must not ship a key. */
const PATHS = [
  '/en/quizzes/ai-fundamentals/evaluating-ai-output-methods',
  '/en/exams/ai-fundamentals/ai-fundamentals-final',
  '/en/prompt-assessments/flaky-ci-test-prompt',
  '/ar/quizzes/ai-fundamentals/evaluating-ai-output-methods',
];

/**
 * Markers that must not appear in a served assessment page.
 *
 * `reason_wrong` is the sharpest: it is present on every WRONG option and absent
 * on the correct one, so its presence alone identifies the answer.
 */
const FORBIDDEN: { needle: RegExp; why: string }[] = [
  { needle: /reason_wrong/, why: 'only wrong options carry it, so it marks the answer' },
  // The key only ever appears as a JSON KEY, so match that structure rather than
  // the bare word. A plain `"correct"` needle false-positives on the English
  // word in a prompt ("Which statements ... are correct?") and on the i18n label
  // (`"correct":"correct"`), which is how the gate first reported a leak that
  // was not there.
  // The value must be an array or object: a real key is
  // `"correct":["opt-id"]` or `"correct":{"term":"def"}`. The i18n bundle
  // holds `"correct":"correct"` — a label whose English text is the word —
  // and matching only the key would flag that as a leak.
  { needle: /"correct"\s*:\s*[\[{]/, why: 'the answer key, as a JSON key' },
  { needle: /\\"correct\\"\s*:\s*[\[{]/, why: 'the answer key, RSC-escaped' },
  { needle: /answerKey/, why: 'a grading key handed to the client' },
  { needle: /"matches"\s*:/, why: 'a matching question answered on the client' },
];

/** Sanity: the pages under test must actually exist and be substantial. */
const MIN_BYTES = 20_000;

let failures = 0;
const fail = (m: string) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m: string) => console.log(`  ok    ${m}`);

async function waitForServer(timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${BASE}/en`, { signal: AbortSignal.timeout(8_000) });
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(1_000);
  }
  return false;
}

async function main() {
  console.log(`\n— answer-key leak —`);
  console.log(`  probing ${BASE}`);

  let server: ReturnType<typeof spawn> | null = null;
  if (!(await waitForServer(2_000))) {
    console.log('  no server found; starting one');
    server = spawn('npm', ['run', 'start', '--', '-p', String(PORT)], {
      stdio: 'ignore',
      shell: true,
    });
    if (!(await waitForServer())) {
      fail('could not start a server to probe');
      process.exit(1);
    }
  }

  try {
    for (const path of PATHS) {
      const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(30_000) });
      const body = await res.text();
      const label = path.padEnd(56);

      if (res.status !== 200) {
        fail(`${label} HTTP ${res.status}`);
        continue;
      }
      if (body.length < MIN_BYTES) {
        fail(`${label} only ${body.length} bytes — too small to be the real page`);
        continue;
      }

      const hits = FORBIDDEN.filter((f) => f.needle.test(body));
      if (hits.length) {
        for (const h of hits) {
          fail(`${label} ships ${h.needle} — ${h.why}`);
        }
      } else {
        pass(`${label} ${body.length.toLocaleString()}b, no key material`);
      }
    }

    // Every chunk the HTML references must actually resolve. A prerendered page
    // that names a chunk hash the build never emitted makes the whole client
    // bundle fail to load: the page renders server-side, then the browser throws
    // ChunkLoadError and swaps in "This page couldn't load / Reload / Back". A 200
    // on the HTML says nothing about this, and the 404 only appears as a
    // subresource — which is why it survived a build that reported success.
    //
    // This is the check that catches a genuinely inconsistent build, and it
    // belongs next to the leak checks because both are assertions about the
    // bytes the server actually sends rather than about the source.
    const quizUrl = `${BASE}/en/quizzes/ai-fundamentals/evaluating-ai-output-methods`;
    const html = await (await fetch(quizUrl)).text();
    const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[\w-]+\.js/g) ?? [])];
    const broken: string[] = [];
    for (const c of chunks) {
      const r = await fetch(`${BASE}${c}`).catch(() => null);
      if (!r || r.status !== 200) broken.push(`${c} (${r?.status ?? 'unreachable'})`);
    }
    broken.length === 0
      ? pass(`all ${chunks.length} referenced chunks resolve`)
      : fail(`${broken.length} of ${chunks.length} chunks 404: ${broken.slice(0, 3).join(', ')}`);

    // The page must still be a real quiz: stripping must not have gutted it.
    const quiz = await fetch(`${BASE}/en/quizzes/ai-fundamentals/evaluating-ai-output-methods`, {
      signal: AbortSignal.timeout(30_000),
    }).then((r) => r.text());
    const radios = (quiz.match(/type="radio"/g) ?? []).length;
    const fieldset = quiz.includes('<fieldset');
    const progressbar = quiz.includes('role="progressbar"');

    radios >= 4
      ? pass(`the quiz still renders its options (${radios} radios)`)
      : fail(`the quiz rendered only ${radios} radio inputs — the player is not mounted`);
    fieldset ? pass('question is in a fieldset with a legend') : fail('no fieldset/legend');
    progressbar ? pass('progress is exposed to assistive tech') : fail('no progressbar role');
  } finally {
    if (server) server.kill();
  }

  console.log(
    failures === 0 ? '\nleak: all checks passed' : `\nleak: ${failures} failure(s)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
