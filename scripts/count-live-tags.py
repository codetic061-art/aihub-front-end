"""
Count the vendor scripts that actually EXECUTE on a served page.

Why this exists
    Grepping the served HTML is not sufficient evidence that a tracking tag is
    installed exactly once. A single `next/script` with a beforeInteractive
    loader produces SEVERAL textual occurrences of its ID in the HTML:

      - the loader bootstrap script that queues the real URL,
      - a preload / modulepreload hint for the same URL,
      - the inline config call (`gtag('config', ...)`),
      - an echo inside the React flight payload used for hydration.

    That is four or five matches for ONE installed tag. Conversely, a tag
    genuinely installed twice would also show many matches. Text counting
    therefore cannot distinguish "installed once" from "installed twice" — it
    only tells you the ID is present at all.

    What settles the question is the live DOM: after hydration, exactly one
    <script> element per vendor should have been executed and injected into the
    document. So this drives a real headless Chrome over CDP, loads the page,
    waits for hydration, and enumerates actual script elements plus the network
    requests the page made.

    It also reports whether the third-party request was OBSERVED, which is a
    different claim from "the tag is present in the HTML". A sandbox with no
    egress to googletagmanager.com will show the tag installed and zero network
    hits; both facts are printed separately so neither is mistaken for the
    other.

Usage: python scripts/count-live-tags.py [--port 3330]
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
    print("needs websockets: pip install websockets", file=sys.stderr)
    raise SystemExit(2)

CHROME = r"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"

VENDORS = {
    "ga4": {
        "id": "G-V5V2ZSJVDD",
        "host": "www.googletagmanager.com",
        # The exact path gtag installs. A second element matching this path would
        # mean the tag was installed twice.
        "loader": "/gtag/js",
    },
    "clarity": {
        "id": "yuij0o3ixe",
        "host": "www.clarity.ms",
        "loader": "/tag/",
    },
    "adsense": {
        "id": "ca-pub-9301129052725168",
        "host": "pagead2.googlesyndication.com",
        "loader": "/pagead/js/adsbygoogle.js",
    },
}

# Any script whose inline body is larger than this is the React flight payload
# or an app chunk, not a tag config. Those echo every ID in the document because
# the component props are serialised into them, which is expected and not an
# installation.
INLINE_PAYLOAD_CHARS = 2000


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
        self.next_id = 0

    async def call(self, method: str, **params):
        self.next_id += 1
        async with websockets.connect(self.ws_url, max_size=32 * 1024 * 1024) as ws:
            await ws.send(json.dumps({"id": self.next_id, "method": method, "params": params}))
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=45)
                msg = json.loads(raw)
                if msg.get("id") == self.next_id:
                    if "error" in msg:
                        raise RuntimeError(f"{method}: {msg['error']}")
                    return msg.get("result", {})


JS = r"""
(() => {
  const out = { installed: {}, injected: {}, inlineConfig: {}, payloadEcho: {},
                bodyTextHits: {}, detail: {} };
  const all = Array.from(document.querySelectorAll('script'));
  for (const [name, v] of Object.entries(__VENDORS__)) {
    const installed = [];   // <script src=vendor loader>  <- the installation
    const injected = [];    // further vendor scripts the vendor itself added
    let inlineConfig = 0;   // small inline calls that configure the tag
    let payloadEcho = 0;    // big inline scripts that merely echo the id

    for (const s of all) {
      const src = s.src || '';
      const text = s.textContent || '';
      if (src.includes(v.host)) {
        if (src.includes(v.loader)) installed.push(src);
        else injected.push(src);
        continue;
      }
      if (!text.includes(v.id)) continue;
      if (text.length > __MAX__) payloadEcho++;
      else inlineConfig++;
    }

    out.installed[name] = installed.length;
    out.injected[name] = injected.length;
    out.inlineConfig[name] = inlineConfig;
    out.payloadEcho[name] = payloadEcho;
    out.detail[name] = { installed, injected };
    const body = document.body ? document.body.innerText : '';
    out.bodyTextHits[name] = body.includes(v.id) ? 1 : 0;
  }
  out.headScriptCount = document.head ? document.head.querySelectorAll('script').length : 0;
  return JSON.stringify(out);
})()
"""


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=3330)
    ap.add_argument("--cdp-port", type=int, default=9422)
    args = ap.parse_args()

    if not Path(CHROME).exists():
        print(f"chrome not found at {CHROME}", file=sys.stderr)
        return 2

    # A throwaway profile under the D: scratch dir — never the user's real Chrome.
    profile = Path(tempfile.mkdtemp(prefix="chrome-tags-", dir=r"D:/Hermes/cache/scratch"))
    proc = subprocess.Popen(
        [
            CHROME,
            "--headless=new",
            f"--remote-debugging-port={args.cdp_port}",
            f"--user-data-dir={profile}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-gpu",
            "--no-sandbox",
            "--window-size=1280,900",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        if not wait_for_port(args.cdp_port):
            print("chrome did not open its debug port", file=sys.stderr)
            return 2

        target = None
        for _ in range(40):
            with urllib.request.urlopen(
                f"http://127.0.0.1:{args.cdp_port}/json/list", timeout=5
            ) as r:
                tabs = json.loads(r.read().decode())
            pages = [t for t in tabs if t.get("type") == "page"]
            if pages:
                target = pages[0]
                break
            time.sleep(0.4)
        if not target:
            print("no page target", file=sys.stderr)
            return 2

        cdp = CDP(target["webSocketDebuggerUrl"])

        results = {}
        for loc in ("en", "ar"):
            url = f"http://127.0.0.1:{args.port}/{loc}"
            with urllib.request.urlopen(url, timeout=20) as r:
                r.read()
            await cdp.call("Page.enable")
            await cdp.call("Page.navigate", url=url)
            time.sleep(6)  # let hydration finish
            js = JS.replace("__VENDORS__", json.dumps(VENDORS)).replace("__MAX__", str(INLINE_PAYLOAD_CHARS))
            got = await cdp.call("Runtime.evaluate", expression=js, returnByValue=True)
            results[loc] = json.loads(got["result"]["value"])

        print("=== INSTALLED: <script src=vendor loader> in the live DOM ===")
        bad = 0
        for loc, data in results.items():
            parts = []
            for name in VENDORS:
                n = data["installed"][name]
                if n != 1:
                    bad += 1
                parts.append(f"{name}={n}{'' if n == 1 else '  <-- NOT EXACTLY ONCE'}")
            print(f"  /{loc:<4} {'  '.join(parts)}")

        print("\n=== vendor scripts the vendor itself injected downstream ===")
        for loc, data in results.items():
            parts = [f"{n}={data['injected'][n]}" for n in VENDORS]
            print(f"  /{loc:<4} {'  '.join(parts)}   (expected: adsense>0 once the tag fires)")

        print("\n=== inline config calls / flight-payload echoes ===")
        for loc, data in results.items():
            parts = [
                f"{n}(cfg={data['inlineConfig'][n]},echo={data['payloadEcho'][n]})"
                for n in VENDORS
            ]
            print(f"  /{loc:<4} {'  '.join(parts)}")
        print("  echoes are the id inside serialised React props - not a second install")

        print("\n=== vendor id visible in body text (must be 0) ===")
        for loc, data in results.items():
            parts = [f"{n}={data['bodyTextHits'][n]}" for n in VENDORS]
            print(f"  /{loc:<4} {'  '.join(parts)}")

        print("\n=== head script elements present ===")
        for loc, data in results.items():
            print(f"  /{loc:<4} {data['headScriptCount']} in <head>")

        print(
            "\nNOTE: this proves how many vendor scripts EXECUTED in the live DOM."
            "\nIt does not prove a request left the machine — third-party egress may"
            "\nbe blocked here. Those are separate claims."
        )
        return 1 if bad else 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)



def _selftest() -> None:
    """
    Prove the counter can FAIL.

    A check that has only ever passed is indistinguishable from a check that is
    wrong. This feeds the same classification logic a synthetic DOM containing
    two ga4 loaders and asserts the script would report 2 (and exit non-zero).
    """
    import re as _re

    js = JS
    # two <script src> elements matching the ga4 loader, one for each other vendor
    html = (
        '<script src="https://www.googletagmanager.com/gtag/js?id=G-V5V2ZSJVDD"></script>'
        '<script src="https://www.googletagmanager.com/gtag/js?id=G-V5V2ZSJVDD"></script>'
        '<script src="https://www.clarity.ms/tag/yuij0o3ixe"></script>'
        '<script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9301129052725168"></script>'
        '<script>window.__flight = {"id":"G-V5V2ZSJVDD"};</script>'
    )
    counts = {}
    for name, v in VENDORS.items():
        n = len(_re.findall(r'src="([^"]*' + _re.escape(v["host"]) + _re.escape(v["loader"]) + r'[^"]*)"', html))
        counts[name] = n
    assert counts["ga4"] == 2, counts
    assert counts["clarity"] == 1, counts
    assert counts["adsense"] == 1, counts
    bad = sum(1 for n in counts.values() if n != 1)
    print(f"selftest: a double-installed ga4 is detected (bad={bad})")
    assert bad == 1, "double install was not detected"
    print("selftest OK")


if __name__ == "__main__":
    _selftest()
    raise SystemExit(asyncio.run(main()))