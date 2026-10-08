"""
REBUILD src/content/{en,ar}.json FROM THE LAST GOOD BUILD.

WHAT HAPPENED
    `npm run build` runs `prebuild` -> `npm run ingest`. Ingest reads the MDX tree
    at `../content` (overridable with AIHUB_CONTENT_ROOT). That directory no longer
    exists, and ingest treats "no MDX" as "an empty site" rather than as a fatal
    error — so it wrote `[]` over 85 pages per locale and the build carried on.
    The MDX source is unrecoverable: not in the Recycle Bin, not under Temp, no
    git history (the repo had zero commits).

WHAT THIS SCRIPT RECOVERS, AND FROM WHERE
    Two independent copies survive inside `.next/`, both produced by the last
    successful build:

    1. `.next/server/app/<locale>/**/*.html` — the PRERENDERED page. This is the
       real rendered body, so prose, headings and lists come back as markdown.
    2. `.next/server/app/api/search/<locale>.body` — a JSON projection of the
       snapshot that keeps `refPath`, `type`, `title`, `description` and `tags`
       for all 85 pages. Its `bodyText` is a ~20% search excerpt, so it is used
       for METADATA only, never as the body.

WHAT IS PERMANENTLY LOST
    Everything the render never displayed, because it was stripped before HTML:
      - `frontmatter.questions[]` beyond the FIRST question of each quiz
      - `answer.correct` (deliberately stripped — see src/lib/assessment.ts)
      - `difficulty`, `points`, `concepts`, `reason_wrong`
      - `rubric` and `assessments` on prompt-assessment pages
      - `updated_at`, `verified_at`, `related`, `source_url`
    Question PROMPTS and OPTION LABELS are recovered from the rendered markup
    (the exam ships all 9 questions and 47 options), but no answer key exists in
    any artefact — which is the intended design, not a loss from this recovery.

RUN
    python scripts/rebuild-content-from-build.py            # dry run, reports
    python scripts/rebuild-content-from-build.py --write    # writes src/content
"""
from __future__ import annotations

import argparse
import html as html_mod
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEXT = ROOT / ".next"
SNAPSHOT_DIR = ROOT / "src" / "content"
LOCALES = ("en", "ar")

# MDX components the renderer emitted as literal text. Strip the tags, keep the
# prose — the content between them is real article text.
MDX_TAGS = (
    "Callout|Card|CardGrid|Tabs?|Tab|Steps?|Step|Quiz|Exam|PromptSpec|"
    "Lesson|Course|Bot|Mermaid|KeyValue|Stat|Grid|Note|Warning|Info"
)


# --------------------------------------------------------------- primitives --


def strip_tags(md: str) -> str:
    """Remove literal MDX component tags the render left as visible text."""
    return re.sub(rf"</?(?:{MDX_TAGS})\b[^>]*>", "", md)


def html_to_body(h: str) -> str:
    """Recover readable markdown body text from a prerendered page."""
    m = re.search(r"<main\b[^>]*>(.*?)</main>", h, re.S)
    body = m.group(1) if m else ""
    # Chrome and non-content furniture never belonged to the article.
    body = re.sub(
        r"<(script|style|nav|footer|header|aside|form)\b.*?</\1>", " ", body, flags=re.S
    )

    # Block boundaries become newlines BEFORE tags are stripped, otherwise every
    # element would run together into one paragraph.
    body = re.sub(
        r"</(p|div|li|h[1-6]|section|tr|blockquote|pre|figcaption|dt|dd)>",
        "\n",
        body,
        flags=re.I,
    )
    body = re.sub(r"<li\b[^>]*>", "- ", body, flags=re.I)
    body = re.sub(
        r"<h([1-6])\b[^>]*>(.*?)</h\1>",
        lambda mm: "\n" + "#" * int(mm.group(1)) + " "
        + re.sub(r"<[^>]+>", "", mm.group(2)),
        body,
        flags=re.S | re.I,
    )
    body = re.sub(
        r"<(strong|b)\b[^>]*>(.*?)</\1>", r"**\2**", body, flags=re.S | re.I
    )
    body = re.sub(r"<(em|i)\b[^>]*>(.*?)</\1>", r"*\2*", body, flags=re.S | re.I)
    body = re.sub(
        r"<code\b[^>]*>(.*?)</code>",
        lambda mm: "`" + re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", mm.group(1))) + "`",
        body,
        flags=re.S | re.I,
    )
    # A single-row table cell kept as a pipe row is noise in prose.
    body = re.sub(r"<[^>]+>", "", body)
    body = html_mod.unescape(body)
    body = re.sub(r"[ \t]+", " ", body)
    body = re.sub(r" *\n *", "\n", body)
    body = strip_tags(body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    # Leftover bare pipe rows from tables carry no content once flattened.
    body = re.sub(r"\n\|?[|\-: ]+\|\n", "\n", body)
    return body.strip()


# ------------------------------------------------------------- locate inputs --


def find_prerendered() -> dict[str, dict[str, Path]]:
    """(locale, refPath) -> prerendered html path."""
    out: dict[str, dict[str, Path]] = defaultdict(dict)
    app = NEXT / "server" / "app"
    if not app.is_dir():
        fail(f"no prerendered pages at {app} — nothing to recover from")
    for root, _dirs, files in os.walk(app):
        for name in files:
            if not name.endswith(".html"):
                continue
            fp = Path(root) / name
            parts = fp.relative_to(app).with_suffix("").parts
            if not parts or parts[0] not in LOCALES:
                continue
            out[parts[0]]["/".join(parts[1:])] = fp
    return out


def find_search_index(locale: str) -> list[dict]:
    """The per-locale search projection: metadata for every page."""
    fp = NEXT / "server" / "app" / "api" / "search" / f"{locale}.body"
    if not fp.is_file():
        fail(f"missing {fp} — the search index is the only complete page list")
    data = json.loads(fp.read_text(encoding="utf-8"))
    return data["docs"]


# --------------------------------------------------------- assessment pages --


def recover_questions_from_flight(html: str) -> list[dict]:
    """
    Recover the FULL question set from the RSC flight payload.

    The rendered markup only shows question ONE — the rest are behind a
    client-side "next" — but the payload React serialised into the page carries
    every question object with its real `id`, `type`, `points` and `options`.

    There is no `answer` in the payload, which is the point: the answer key was
    stripped before render (see src/lib/assessment.ts) and the leak gate proves it
    never reaches the browser. So these recover as answerable questions that
    cannot be graded client-side, and that is correct rather than incomplete.
    """
    payload = "".join(
        re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.S)
    )
    if not payload:
        return []
    # The payload is the body of a JS string literal.
    payload = (
        payload.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")
    )
    marker = '"questions":['
    idx = payload.find(marker)
    if idx < 0:
        return []
    start = payload.index("[", idx)
    depth = 0
    for k in range(start, len(payload)):
        if payload[k] == "[":
            depth += 1
        elif payload[k] == "]":
            depth -= 1
            if depth == 0:
                end = k + 1
                break
    else:
        return []
    try:
        questions = json.loads(payload[start:end])
    except json.JSONDecodeError:
        # A `scenario` question nests objects; if the slice is truncated, fall
        # back to the rendered question rather than losing the page's questions.
        return recover_questions(html)
    return questions if isinstance(questions, list) else []


def recover_questions(html: str) -> list[dict]:
    """
    Recover question prompts + option labels from rendered assessment markup.

    A fieldset is one question, its legend reads "Question N of M", and the text
    between the legend and the first <label> is the prompt. There is no answer
    key in the HTML by design, so `answer` is deliberately absent.
    """
    out: list[dict] = []
    for idx, block in enumerate(re.findall(r"<fieldset\b[^>]*>(.*?)</fieldset>", html, re.S), 1):
        legend = re.search(r"<legend[^>]*>(.*?)</legend>", block, re.S)
        legend_txt = (
            html_mod.unescape(re.sub(r"<[^>]+>", "", legend.group(1))).strip()
            if legend
            else ""
        )
        # The legend often repeats the ordinal as the prompt's first run.
        after = block.split("</legend>", 1)[1] if "</legend>" in block else block
        prompt_html = after.split("<label", 1)[0]
        prompt = html_mod.unescape(
            re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", prompt_html))
        ).strip()
        prompt = re.sub(r"^Question\s+\d+\s*", "", prompt).strip()
        if not prompt and legend_txt:
            prompt = re.sub(r"^Question\s+\d+\s*(of\s*\d+)?\s*", "", legend_txt).strip()

        options = [
            html_mod.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", l))).strip()
            for l in re.findall(r"<label\b[^>]*>(.*?)</label>", block, re.S)
        ]
        options = [o for o in options if o]
        if not options:
            continue
        out.append(
            {
                "id": f"q{idx}",
                "type": "choice" if len(options) <= 4 else "multi",
                "prompt": prompt,
                "options": [
                    {"id": f"q{idx}-o{n}", "label": o} for n, o in enumerate(options, 1)
                ],
            }
        )
    return out


def recover_rubric(html: str) -> list[dict]:
    """
    Recover prompt-assessment criteria from the rendered rubric table.

    Only the criterion text survives: the level bands lived in frontmatter and
    were never rendered. An empty result is honest — the page still works, it just
    shows no criteria.
    """
    rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", html, re.S)
    out = []
    for r in rows:
        cells = [
            html_mod.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", c))).strip()
            for c in re.findall(r"<t[hd]\b[^>]*>(.*?)</t[hd]>", r, re.S)
        ]
        cells = [c for c in cells if c]
        if len(cells) >= 2 and len(cells[0]) > 8:
            out.append({"id": f"c{len(out)+1}", "criterion": cells[0], "hint": cells[1][:160]})
    return out


# -------------------------------------------------------------------- build --


def build(locale: str, pages_html: dict[str, Path]) -> list[dict]:
    docs = find_search_index(locale)
    out: list[dict] = []

    for doc in docs:
        ref = doc["refPath"]
        fp = pages_html.get(ref)
        body = ""
        questions: list[dict] = []
        rubric: list[dict] = []
        if fp is not None:
            h = fp.read_text(encoding="utf-8", errors="replace")
            body = html_to_body(h)
            if doc.get("type") in ("quiz", "exam"):
                # The flight payload carries every question; the rendered markup
                # only shows question one. Prefer the payload, and fall back to
                # the markup when there is no payload or it holds a single item.
                questions = recover_questions_from_flight(h)
                if len(questions) <= 1:
                    questions = recover_questions(h) or questions
            elif doc.get("type") == "prompt-assessment":
                rubric = recover_rubric(h)

        desc = (doc.get("description") or "").strip()
        front: dict[str, object] = {
            "title": doc.get("title"),
            "slug": ref.split("/")[-1],
            "type": doc.get("type"),
            "description": desc,
            "tags": doc.get("tags") or [],
        }
        if questions:
            front["questions"] = questions
        if rubric:
            front["rubric"] = rubric
        front = {k: v for k, v in front.items() if v not in (None, "", [])}

        out.append(
            {
                "refPath": ref,
                "type": doc.get("type") or "concept",
                "title": doc.get("title") or "",
                "description": desc,
                "summary": desc or next(
                    (l.lstrip("# -").strip() for l in body.split("\n") if len(l.strip()) > 40),
                    "",
                )[:200],
                "tags": doc.get("tags") or [],
                "frontmatter": front,
                "body": body,
                "words": len(body.split()),
            }
        )
    return out


def fail(msg: str) -> None:
    print(f"\nABORT: {msg}", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="write src/content/*.json")
    args = ap.parse_args()

    html_by_locale = find_prerendered()
    print(f"prerendered pages: " + ", ".join(f"{k}={len(v)}" for k, v in sorted(html_by_locale.items())))

    built: dict[str, list[dict]] = {}
    for locale in LOCALES:
        if locale not in html_by_locale:
            fail(f"no prerendered pages for locale {locale}")
        pages = build(locale, html_by_locale[locale])
        built[locale] = pages
        body_chars = sum(len(p["body"]) for p in pages)
        qs = sum(len(p["frontmatter"].get("questions", [])) for p in pages)
        empty = [p["refPath"] for p in pages if not p["body"]]
        print(
            f"\n{locale}: {len(pages)} pages, {sum(p['words'] for p in pages):,} words, "
            f"{body_chars:,} body chars"
        )
        print(f"   questions recovered: {qs}")
        print(f"   pages with an empty body: {len(empty)}" + (f" -> {empty[:5]}" if empty else ""))
        for p in pages:
            if p["frontmatter"].get("questions"):
                print(f"     {p['refPath']}: {len(p['frontmatter']['questions'])} questions")

    if not args.write:
        print("\nDRY RUN — pass --write to replace src/content/{en,ar}.json")
        return 0

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    for locale, pages in built.items():
        target = SNAPSHOT_DIR / f"{locale}.json"
        target.write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"wrote {target.relative_to(ROOT)} ({target.stat().st_size:,}b)")
    print(
        "\nRECOVERED, with known gaps: no answer keys (never shipped to the browser),\n"
        "and no difficulty/points/updated_at metadata (never rendered). Quizzes and\n"
        "exams therefore grade as 'awaiting results' until a real answer key exists."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())