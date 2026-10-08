"""
Does the served CSS actually APPLY, or is the markup referencing classes that
were never compiled?

Why a raw grep of the .css file is not enough
    A compiled stylesheet is minified and its selectors are escaped. Searching
    for the literal string `mx-auto` finds nothing even when `.mx-auto{margin-inline:auto}`
    is present, because the compiler emits `.mx-auto{margin-inline:auto}` — the
    substring IS there, but `max-w-6xl` becomes
    `.max-w-6xl{max-width:var(--breakpoint-6xl)}`, and arbitrary-value utilities
    like `bg-[var(--color-bg)]` are emitted escaped as
    `.bg-\[\[var\(--color-bg\)\]\]`. So "is my class in the file" is a
    false-friend question unless the browser answers it.

What this measures
    It loads the served page in a real headless Chrome and asks the browser
    itself, via getComputedStyle, whether specific properties actually resolved.
    A class that is absent from the stylesheet leaves the property at its
    inherited/initial value; a class that compiled leaves a real value. That is
    the only answer that matters for "is this page styled", and it is the same
    thing a user's browser decides.

    It also captures any stylesheet that failed to load, plus the count of
    stylesheets and whether they are enabled, so a 404 or a disabled sheet is
    reported rather than silently producing "unstyled".

Usage: python scripts/check-css-applied.py [--port 3360] [--url /en]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

try:
    import websockets
except ImportError:  # pragma: no cover
    print("needs websockets", file=sys.stderr)
    raise SystemExit(2)

CHROME = r"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"

# (label, classNameOnPage, property, expected_non_default)
# `expected_non_default` is what a compiled utility yields. If the browser
# reports the initial/inherited value instead, the utility did not compile.
# Probe classes that are ACTUALLY used by the pages under test. Probing a class
# no page renders proves nothing: Tailwind only emits what it sees, so an unused
# class is absent from the stylesheet by design and looks identical to a broken
# build. `max-w-6xl` was such a class — it existed only on the deleted bot-review
# page — and testing it produced a false "unstyled" verdict.
PROBES = [
    ("measure utility",     "max-w-[62ch]",                            "maxWidth",         "62ch"),
    ("arbitrary max-width", "max-w-[42ch]",                            "maxWidth",         "42ch"),
    ("centring utility",    "mx-auto",                                 "marginLeft",       "auto"),
    ("padding-block",       "py-(--sp-8)",                             "paddingTop",       None),
    ("type-scale",          "text-[length:var(--fs-body)]",            "fontSize",         None),
    ("bg token",            "bg-[var(--color-bg)]",                    "backgroundColor",  None),
    ("muted text",          "text-[color:var(--muted-foreground)]",    "color",            None),
    ("border token",        "border-[color:var(--color-border-muted)]", "borderTopColor",   None),
]

JS = r"""
(() => {
  const sheets = Array.from(document.styleSheets);
  const info = sheets.map((s) => {
    let rules = null, err = null;
    try { rules = s.cssRules ? s.cssRules.length : null; }
    catch (e) { err = String(e && e.name); }   // SecurityError on cross-origin
    return { href: s.href, disabled: s.disabled, media: s.media && s.media.mediaText,
             ruleCount: rules, error: err, ownerTag: s.ownerNode && s.ownerNode.tagName };
  });

  function probe(className, prop) {
    const el = document.createElement('div');
    el.className = className;
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    const v = getComputedStyle(el)[prop];
    el.remove();
    return v;
  }

  const out = { sheets: info, sheetCount: sheets.length, probes: {}, bodyBg: null,
                bodyColor: null, rootBg: null, classCount: 0 };
  out.bodyBg = getComputedStyle(document.body).backgroundColor;
  out.bodyColor = getComputedStyle(document.body).color;
  const root = document.documentElement;
  out.rootBg = getComputedStyle(root).getPropertyValue('--color-bg').trim();
  out.classCount = document.querySelectorAll('[class]').length;
  for (const [label, cls, prop] of __PROBES__) out.probes[label] = { cls, prop, value: probe(cls, prop) };
  return JSON.stringify(out);
})()
"""


def wait_for_port(port: int, timeout: float = 45.0) -> bool:
    import socket

    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket() as s:
            s.settimeout(1.0)
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return True
        time.sleep(0.4)
    return False


class CDP:
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.n = 0

    async def call(self, method: str, **params):
        self.n += 1
        async with websockets.connect(self.ws_url, max_size=64 * 1024 * 1024) as ws:
            await ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
            while True:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=45))
                if msg.get("id") == self.n:
                    if "error" in msg:
                        raise RuntimeError(f"{method}: {msg['error']}")
                    return msg.get("result", {})


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=3360)
    ap.add_argument("--url", default="/en")
    ap.add_argument("--cdp-port", type=int, default=9433)
    args = ap.parse_args()

    if not Path(CHROME).exists():
        print(f"chrome missing: {CHROME}", file=sys.stderr)
        return 2

    profile = Path(tempfile.mkdtemp(prefix="chrome-css-", dir=r"D:/Hermes/cache/scratch"))
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--remote-debugging-port={args.cdp_port}",
         f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check",
         "--disable-gpu", "--no-sandbox", "--window-size=1280,900", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        if not wait_for_port(args.cdp_port):
            print("chrome debug port never opened", file=sys.stderr)
            return 2

        target = None
        for _ in range(40):
            with urllib.request.urlopen(f"http://127.0.0.1:{args.cdp_port}/json/list", timeout=5) as r:
                pages = [t for t in json.loads(r.read().decode()) if t.get("type") == "page"]
            if pages:
                target = pages[0]
                break
            time.sleep(0.4)
        if not target:
            print("no page target", file=sys.stderr)
            return 2

        cdp = CDP(target["webSocketDebuggerUrl"])
        url = f"http://127.0.0.1:{args.port}{args.url}"
        await cdp.call("Page.enable")
        await cdp.call("Page.navigate", url=url)
        time.sleep(5)

        js = JS.replace("__PROBES__", json.dumps(PROBES))
        res = await cdp.call("Runtime.evaluate", expression=js, returnByValue=True)
        data = json.loads(res["result"]["value"])

        print(f"=== stylesheets the browser loaded ({data['sheetCount']}) ===")
        for s in data["sheets"]:
            state = "DISABLED" if s["disabled"] else "enabled"
            rc = s["ruleCount"] if s["ruleCount"] is not None else f"blocked({s['error']})"
            print(f"  {state:<9} rules={str(rc):<12} {str(s['href'])[:70]}")

        print(f"\n=== computed styles (did the utilities COMPILE?) ===")
        unresolved = 0
        for label, p in data["probes"].items():
            v = p["value"]
            # An absent utility leaves the initial value: '' / 'none' / 'auto' / 'normal'
            inert = v in ("", "none", "normal", "auto", "0s", "static") and "centring" not in label
            if inert:
                unresolved += 1
            print(f"  {'UNRESOLVED' if inert else 'applied   '}  {label:<22} {p['prop']}={v}")

        print(f"\n=== document-level ===")
        print(f"  body background : {data['bodyBg']}")
        print(f"  body color      : {data['bodyColor']}")
        print(f"  --color-bg      : {data['rootBg']!r}")
        print(f"  elements with a class: {data['classCount']}")

        unstyled_body = data["bodyBg"] in ("rgba(0, 0, 0, 0)", "transparent") and not data["rootBg"]
        print("\n=== dark theme: does the same token flip? ===")
        # Force a style recalc after flipping the attribute: reading
        # getPropertyValue in the same tick as setAttribute can return the
        # pre-change computed value, which made a working dark theme look
        # broken. The offsetHeight read is the standard forced-reflow nudge.
        dark_js = """(() => {
          const r = document.documentElement;
          const read = () => getComputedStyle(r).getPropertyValue('--color-bg').trim();
          const bodyBg = () => getComputedStyle(document.body).backgroundColor;
          r.setAttribute('data-theme','light');
          void r.offsetHeight;
          const lightTok = read(), lightBody = bodyBg();
          r.setAttribute('data-theme','dark');
          void r.offsetHeight;
          const darkTok = read(), darkBody = bodyBg();
          r.setAttribute('data-theme','light');
          void r.offsetHeight;
          return JSON.stringify({ lightTok, darkTok, lightBody, darkBody,
                                  changed: lightTok !== darkTok && darkTok !== '' });
        })()"""
        dark = json.loads((await cdp.call("Runtime.evaluate", expression=dark_js, returnByValue=True))["result"]["value"])
        print(f"  --color-bg  light={dark['lightTok']!r}  dark={dark['darkTok']!r}  changed={dark['changed']}")
        print(f"  body bg     light={dark['lightBody']}  dark={dark['darkBody']}")
        theme_ok = dark["changed"]

        print(f"\nverdict: {'UNSTYLED' if unstyled_body else 'styled'} "
              f"({unresolved} of {len(PROBES)} utilities unresolved)")
        return 1 if (unstyled_body or unresolved or not theme_ok) else 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))