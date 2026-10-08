"""
Drive a page over CDP and report what a user would actually see and do.

    python scripts/probe-page.py <url> [--shot out.png] [--click "selector"] ...

Verifies an interactive surface WORKS, not merely that it is served. A 200 with
plausible HTML is not evidence a quiz runs: the earlier check found the string
"QuizPlayer" in the served markup and still could not tell whether a single
question had rendered. This loads the page, waits for hydration, and reports the
real DOM.

Options:
    --shot PATH     save a screenshot
    --click SEL     click a selector, then re-report (repeatable)
    --wait SEC      hydration wait, default 2.5
    --eval JS       run JS and print the result

Requires a Chrome with --remote-debugging-port. The caller launches one; this
script never starts or stops a browser, so it cannot interfere with the user's
own session.
"""
from __future__ import annotations

import asyncio
import base64
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:9333"

REPORT_JS = r"""
(() => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = (sel) => [...document.querySelectorAll(sel)];

  const controls = all('button, input, select, textarea, [role="button"], [role="radio"], a[href]')
    .filter(visible)
    .slice(0, 30)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || null,
      role: el.getAttribute('role') || null,
      text: txt(el).slice(0, 46),
      disabled: el.disabled === true,
    }));

  // Any React hydration error would surface here.
  const err = all('[data-nextjs-error], #__next_error__').map(txt);

  return {
    title: document.title,
    h1: all('h1').map(txt).slice(0, 3),
    url: location.pathname,
    counts: {
      buttons: all('button').length,
      inputs: all('input').length,
      radios: all('[role="radio"], input[type="radio"]').length,
      forms: all('form').length,
      fieldsets: all('fieldset').length,
      progress: all('progress, [role="progressbar"]').length,
      svg: all('svg').length,
      bot: all('[data-bot]').length,
    },
    // A quiz's own text is the strongest signal it mounted.
    looksLikeAQuiz: /question|choose|select|answer|submit|quiz|امتحان|سؤال/i.test(document.body.innerText),
    controls,
    errors: err,
    bodyStart: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
  };
})()
"""


class CDP:
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self._id = 0
        self.ws = None

    async def connect(self):
        import websockets

        self.ws = await websockets.connect(self.ws_url, max_size=40 * 1024 * 1024)

    async def call(self, method: str, params: dict | None = None) -> dict:
        self._id += 1
        mid = self._id
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            raw = await asyncio.wait_for(self.ws.recv(), timeout=45)
            msg = json.loads(raw)
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    async def close(self):
        if self.ws:
            await self.ws.close()


def new_target(url: str) -> str:
    """
    Return the id of a page target to drive.

    Chrome 111+ requires PUT on /json/new and returns 405 to POST, so creating a
    tab that way is not portable. Reusing an existing page target and navigating
    it works on every version and does not leak a tab per probe.
    """
    with urllib.request.urlopen(f"{BASE}/json/list", timeout=15) as r:
        targets = json.loads(r.read())

    pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
    if pages:
        return pages[0]["id"]

    # No page target yet: create one with PUT.
    req = urllib.request.Request(
        f"{BASE}/json/new?{urllib.parse.quote('about:blank', safe='')}", method="PUT"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["id"]


def target_ws(tid: str) -> str:
    with urllib.request.urlopen(f"{BASE}/json/list", timeout=15) as r:
        for t in json.loads(r.read()):
            if t.get("id") == tid:
                return t["webSocketDebuggerUrl"]
    raise RuntimeError(f"target {tid} not found")


async def run(url: str, opts: dict) -> dict:
    tid = new_target("about:blank")
    cdp = CDP(target_ws(tid))
    await cdp.connect()
    try:
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Page.navigate", {"url": url})
        await asyncio.sleep(opts["wait"])

        for sel in opts["clicks"]:
            expr = (
                f"(() => {{ const e = document.querySelector({json.dumps(sel)});"
                f" if (!e) return 'NOT FOUND'; e.click(); return 'clicked'; }})()"
            )
            out = await cdp.call(
                "Runtime.evaluate", {"expression": expr, "returnByValue": True}
            )
            print(f"  click {sel}: {out.get('result', {}).get('value')}")
            await asyncio.sleep(0.8)

        res = await cdp.call(
            "Runtime.evaluate", {"expression": REPORT_JS, "returnByValue": True}
        )
        report = res.get("result", {}).get("value", {})

        if opts.get("eval"):
            e = await cdp.call(
                "Runtime.evaluate",
                {"expression": opts["eval"], "returnByValue": True},
            )
            report["_eval"] = e.get("result", {}).get("value")

        if opts.get("shot"):
            shot = await cdp.call("Page.captureScreenshot", {"format": "png"})
            Path(opts["shot"]).write_bytes(base64.b64decode(shot["data"]))
            report["_shot"] = opts["shot"]

        await cdp.call("Page.close")
        return report
    finally:
        await cdp.close()


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    url = sys.argv[1]
    opts = {"wait": 2.5, "clicks": [], "shot": None, "eval": None}
    i = 2
    while i < len(sys.argv):
        a = sys.argv[i]
        if a == "--shot":
            opts["shot"] = sys.argv[i + 1]; i += 2
        elif a == "--click":
            opts["clicks"].append(sys.argv[i + 1]); i += 2
        elif a == "--wait":
            opts["wait"] = float(sys.argv[i + 1]); i += 2
        elif a == "--eval":
            opts["eval"] = sys.argv[i + 1]; i += 2
        else:
            i += 1

    print(f"probing {url}")
    report = asyncio.run(run(url, opts))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
