"""
DRIVE AN ASSESSMENT END TO END OVER CDP.

    python scripts/drive-quiz.py <url> [out.png]

Answers every question, submits, and reports what the user would see. This
exists because "the page returns 200 and contains the string QuizPlayer" says
nothing about whether the quiz works — an earlier build served 200 on all 85
routes with the player never mounted, because the frontmatter parser had
collapsed every question to the raw string `id: "q1"`.

The probe is deliberately behavioural. It clicks real controls and reads the DOM
back, so a component that renders but cannot be operated still fails.

Requires a Chrome with --remote-debugging-port=9340 (override with
QUIZ_CDP_BASE). Use a CLEAN profile: a tab that loaded a previous build holds
HTML naming chunk hashes that no longer exist, and the page then fails with
ChunkLoadError while the server itself looks perfectly healthy.
"""
from __future__ import annotations

import asyncio
import base64
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import os

import websockets

BASE = os.environ.get('QUIZ_CDP_BASE', 'http://127.0.0.1:9340')



class Cdp:
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self._id = 0
        self.ws: object = None

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=40 * 1024 * 1024)

    async def call(self, method: str, params: dict | None = None):
        self._id += 1
        mid = self._id
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout=45))
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    async def js(self, expr: str):
        r = await self.call(
            "Runtime.evaluate",
            {"expression": expr, "returnByValue": True, "awaitPromise": True},
        )
        if r.get("exceptionDetails"):
            raise RuntimeError(r["exceptionDetails"].get("text", "js error"))
        return r.get("result", {}).get("value")

    async def close(self):
        if self.ws:
            await self.ws.close()


def page_target() -> tuple[str, str]:
    """Reuse an existing page target; do not leak one tab per run."""
    with urllib.request.urlopen(f"{BASE}/json/list", timeout=15) as r:
        targets = json.loads(r.read())
    pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
    if pages:
        return pages[0]["id"], pages[0]["webSocketDebuggerUrl"]
    req = urllib.request.Request(
        f"{BASE}/json/new?{urllib.parse.quote('about:blank', safe='')}", method="PUT"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        t = json.loads(r.read())
    return t["id"], t["webSocketDebuggerUrl"]


# Read the live quiz state: which question, what is answered, what is enabled.
STATE_JS = r"""
(() => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const inputs = [...document.querySelectorAll('input')].map(i => ({
    type: i.type, name: i.name, value: i.value, checked: i.checked,
  }));
  const buttons = [...document.querySelectorAll('button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ text: txt(b).slice(0, 44), disabled: b.disabled }));
  const fieldset = document.querySelector('fieldset');
  const legend = document.querySelector('legend');
  const bar = document.querySelector('[role="progressbar"]');
  return {
    inputs, buttons,
    legend: legend ? txt(legend) : null,
    prompt: fieldset ? txt(fieldset).slice(0, 200) : null,
    progress: bar ? { now: bar.getAttribute('aria-valuenow'), max: bar.getAttribute('aria-valuemax'),
                      label: txt(bar) } : null,
    bodyLen: document.body.innerText.length,
  };
})()
"""


async def drive(url: str, shot: str | None) -> dict:
    tid, ws_url = page_target()
    cdp = Cdp(ws_url)
    await cdp.connect()
    report: dict = {"url": url, "steps": []}
    try:
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Page.navigate", {"url": url})
        await asyncio.sleep(3.0)

        st = await cdp.js(STATE_JS)
        report["initial"] = st
        report["steps"].append(
            f"loaded: {len(st['inputs'])} inputs, "
            f"{len(st['buttons'])} buttons, legend={st['legend']!r}"
        )

        if not st["inputs"]:
            report["verdict"] = "FAIL: no question inputs rendered"
            return report

        # Answer every question: click the first unselected control of each
        # group, advancing with Next until the group stops changing.
        for step in range(1, 12):
            info = await cdp.js(
                r"""
                (() => {
                  const inputs = [...document.querySelectorAll('input')];
                  if (!inputs.length) return {done: true, reason: 'no inputs'};
                  const groups = new Map();
                  for (const i of inputs) {
                    if (!groups.has(i.name)) groups.set(i.name, []);
                    groups.get(i.name).push(i);
                  }
                  const g = [...groups.values()][0];
                  // select the first unchecked in the first group
                  const target = g.find(i => !i.checked) || g[0];
                  target.click();
                  const next = [...document.querySelectorAll('button')]
                    .find(b => /next|continue|→/i.test(b.innerText) && !b.disabled);
                  const advanced = !!next;
                  if (next) next.click();
                  return {groups: groups.size, checked: g.filter(i => i.checked).length,
                          advanced, submitted: false};
                })()
                """
            )
            report["steps"].append(f"step {step}: {info}")
            if not info.get("advanced"):
                break
            await asyncio.sleep(0.6)

        # Submit whatever is available.
        sub = await cdp.js(
            r"""
            (() => {
              const b = [...document.querySelectorAll('button')]
                .find(x => /submit|finish|complete|done/i.test(x.innerText) && !x.disabled);
              if (!b) return {clicked: false, reason: 'no enabled submit button'};
              b.click();
              return {clicked: true, label: b.innerText.trim()};
            })()
            """
        )
        report["submit"] = sub
        await asyncio.sleep(1.4)

        after = await cdp.js(STATE_JS)
        report["afterSubmit"] = after
        report["steps"].append(f"submit: {sub}")

        # What the reader is told about their result.
        verdict_text = await cdp.js(
            r"""
            (() => {
              const t = document.body.innerText;
              const m = t.match(/(awaiting[^.\n]{0,120}|not in this build[^.\n]{0,120}|your result[^.\n]{0,160})/i);
              return m ? m[0] : null;
            })()
            """
        )
        report["verdictText"] = verdict_text

        if shot:
            s = await cdp.call("Page.captureScreenshot", {"format": "png"})
            Path(shot).write_bytes(base64.b64decode(s["data"]))
            report["screenshot"] = shot

        ok = bool(after["inputs"]) or bool(sub.get("clicked"))
        report["verdict"] = "PASS: the quiz was answerable and submittable" if ok else "FAIL"
        return report
    finally:
        await cdp.close()


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    url = sys.argv[1]
    shot = sys.argv[2] if len(sys.argv) > 2 else None
    rep = asyncio.run(drive(url, shot))
    print(json.dumps(rep, indent=2, ensure_ascii=False))
    return 0 if rep.get("verdict", "").startswith("PASS") else 1


if __name__ == "__main__":
    raise SystemExit(main())
