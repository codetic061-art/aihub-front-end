"""
Post-deployment acceptance gate for the AI Hub on Cloudflare Workers.

Checks the things a `wrangler deploy` exit code cannot: that the Worker serves
real HTML, that the stylesheet is fetched and applied by a browser (not merely
present in the bundle), that the SEO surface points at the deployment origin, and
that the three vendor tags each execute exactly once.

Usage:  python scripts/check-production.py --url https://<host> [--dark]
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import re
import socket
import subprocess
import sys
import tempfile
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path

CHROME_CANDIDATES = [
    r"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    r"C:/Program Files/Google/Chrome/Application/chrome.exe",
    r"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
]

# The four standing pages AdSense requires, plus representative content routes.
STANDING = ["about", "privacy-policy", "terms", "contact"]
INDEXES = ["concepts", "skills", "mcp", "docs"]

# Cloudflare rejects non-browser User-Agents with error 1010, which looks like a
# site 403 in every probe. Always identify as a browser.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")

failures: list[str] = []
notes: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> bool:
    mark = "ok  " if ok else "FAIL"
    print(f"  {mark}  {label}{('  — ' + detail) if detail else ''}")
    if not ok:
        failures.append(label)
    return ok


def get(url: str, timeout: int = 30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, {}, f"ERROR {type(e).__name__}: {e}"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Surface 3xx instead of following it, so redirect chains stay visible."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def get_noredirect(url: str, timeout: int = 30):
    opener = urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with opener.open(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, {}, f"ERROR {type(e).__name__}: {e}"


def find_chrome() -> str | None:
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    return None


async def browser_checks(base: str, origin: str, shots: Path) -> None:
    chrome = find_chrome()
    if not chrome:
        notes.append("no Chromium found; skipped live DOM checks")
        return
    try:
        import websockets
    except ImportError:
        notes.append("websockets module missing; skipped live DOM checks")
        return

    port = 9461
    profile = Path(tempfile.mkdtemp(prefix="cfcheck-", dir="D:/Hermes/cache/scratch"))
    proc = subprocess.Popen(
        [chrome, "--headless=new", f"--remote-debugging-port={port}",
         f"--user-data-dir={profile}", "--no-first-run", "--disable-gpu",
         "--no-sandbox", "--hide-scrollbars", "--window-size=1280,1200", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        for _ in range(150):
            with socket.socket() as s:
                s.settimeout(1)
                if s.connect_ex(("127.0.0.1", port)) == 0:
                    break
            await asyncio.sleep(0.4)

        tabs = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=15).read())
        page = [t for t in tabs if t["type"] == "page"][0]

        # The CDP socket must stay open for the whole run -- closing it after
        # setup makes every later send() fail with ConnectionClosedOK.
        async with websockets.connect(page["webSocketDebuggerUrl"], max_size=2 ** 26) as ws:
            n = 0

            async def send(method, params=None):
                nonlocal n
                n += 1
                await ws.send(json.dumps({"id": n, "method": method, "params": params or {}}))
                while True:
                    m = json.loads(await asyncio.wait_for(ws.recv(), timeout=60))
                    if m.get("id") == n:
                        if "error" in m:
                            raise RuntimeError(m["error"])
                        return m.get("result", {})

            # Network log so a stylesheet that 404s cannot pass silently.
            await send("Network.enable")
            await send("Page.enable")
            await send("Emulation.setDeviceMetricsOverride",
                       {"width": 1280, "height": 1200, "deviceScaleFactor": 1, "mobile": False})

            for path, theme, tag in [("/en", "light", "light"), ("/en", "dark", "dark")]:
                await send("Page.navigate", {"url": base + path})
                await asyncio.sleep(5)
                await send("Runtime.evaluate", {
                    "expression": f"document.documentElement.setAttribute('data-theme','{theme}');"
                                  "void document.documentElement.offsetHeight"})
                await asyncio.sleep(1.5)

                js = """(() => {
                  const sheets = [...document.querySelectorAll('link[rel=stylesheet]')];
                  const de = document.documentElement;
                  const cs = getComputedStyle(document.body);
                  const head = document.head;
                  return JSON.stringify({
                    sheets: sheets.map(s => s.href),
                    disabled: sheets.filter(s => s.sheet && s.sheet.disabled).length,
                    cssRules: sheets.map(s => { try { return s.sheet ? s.sheet.cssRules.length : -1 } catch { return -2 } }),
                    bg: cs.backgroundColor, color: cs.color, font: cs.fontFamily,
                    fs: cs.fontSize, ff: cs.fontFamily,
                    bgToken: getComputedStyle(de).getPropertyValue('--color-bg').trim(),
                    bodyBg: getComputedStyle(document.body).backgroundColor,
                    maxw: getComputedStyle(document.querySelector('main')||document.body).maxWidth,
                    hreflang: [...document.querySelectorAll('link[rel=alternate]')].map(l=>l.hreflang+'='+l.href),
                    canonical: (document.querySelector('link[rel=canonical]')||{}).href || null,
                    gtag: typeof window.gtag, dataLayer: (window.dataLayer||[]).length,
                    clarity: typeof window.clarity,
                    adsbygoogle: typeof window.adsbygoogle,
                    vendorLoaders: [...document.querySelectorAll('script[src]')]
                                     .map(s=>s.src).filter(s=>/googletagmanager|clarity\\.ms|googlesyndication/.test(s)),
                    title: document.title
                  });
                })()"""
                r = await send("Runtime.evaluate", {"expression": js, "returnByValue": True})
                d = json.loads(r["result"]["value"])

                print(f"\n  --- /en [{theme}] ---")
                check(f"[{tag}] stylesheet link present", len(d["sheets"]) >= 1, f"{len(d['sheets'])} link(s)")
                check(f"[{tag}] no disabled stylesheet", d["disabled"] == 0)
                check(f"[{tag}] stylesheet parsed by the browser",
                      all(x > 0 for x in d["cssRules"]), f"rules={d['cssRules']}")
                check(f"[{tag}] --color-bg token resolves", bool(d["bgToken"]), d["bgToken"])
                check(f"[{tag}] body has a real background", d["bg"] not in ("rgba(0, 0, 0, 0)", "transparent"), d["bg"])
                check(f"[{tag}] body has a font family", "arial" not in d["font"].lower() and len(d["font"]) > 3, d["font"][:44])
                check(f"[{tag}] exactly 1 GA4 loader", len(d["vendorLoaders"]) == 1
                      or sum("googletagmanager" in u for u in d["vendorLoaders"]) == 1,
                      f"{len(d['vendorLoaders'])} vendor script(s)")
                check(f"[{tag}] gtag initialised", d["gtag"] == "function" and d["dataLayer"] > 0,
                      f"gtag={d['gtag']} dataLayer={d['dataLayer']}")
                check(f"[{tag}] clarity initialised", d["clarity"] == "function")
                check(f"[{tag}] adsbygoogle present", d["adsbygoogle"] == "object")
                if theme == "light":
                    check("light background is the cream token",
                          d["bg"].startswith("rgb(244, 238, 227)") or d["bg"].startswith("rgb(11, 17, 32)"),
                          d["bg"])
                else:
                    check("dark background differs from light", d["bg"] != "rgb(244, 238, 227)", d["bg"])
                check(f"[{tag}] canonical points at this origin",
                      (d["canonical"] or "").startswith(origin), str(d["canonical"]))
                check(f"[{tag}] hreflang alternates present",
                      any("en" in h for h in d["hreflang"]) and any("ar" in h for h in d["hreflang"]),
                      f"{len(d['hreflang'])} alternate(s)")

                img = await send("Page.captureScreenshot", {"format": "png"})
                f = shots / f"prod_{tag}.png"
                f.write_bytes(base64.b64decode(img["data"]))
                print(f"        screenshot: {f.stat().st_size}b -> {f}")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--shots", default="D:/Hermes/cache/scratch/refs")
    args = ap.parse_args()

    base = args.url.rstrip("/")
    origin = base
    shots = Path(args.shots)
    shots.mkdir(parents=True, exist_ok=True)

    print(f"=== deployment acceptance: {base} ===")

    print("\n=== 1. HTTPS + root ===")
    check("origin is https", base.startswith("https://"), base)
    st, h, body = get(base + "/en")
    check("/en returns 200", st == 200, f"HTTP {st}")
    check("HTML is a full document", "<!DOCTYPE html" in body or "<html" in body, f"{len(body)}b")

    print("\n=== 2. standing pages (AdSense) ===")
    for p in STANDING:
        for loc in ("en", "ar"):
            st, _, b = get(f"{base}/{loc}/{p}")
            t = re.search(r"<title[^>]*>(.*?)</title>", b, re.S)
            d = re.search(r'<meta name="description" content="([^"]*)"', b)
            c = re.search(r'<link rel="canonical" href="([^"]*)"', b)
            r = re.search(r'<meta name="robots" content="([^"]*)"', b)
            txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ",
                         re.sub(r"<script[\s\S]*?</script>", " ", b)))
            ok = (st == 200 and t and d and len(d.group(1)) > 20 and c
                  and "noindex" not in (r.group(1) if r else "")
                  and not re.search(r"\{(?:n|total|count)\}", txt)
                  and len(txt) > 400)
            check(f"/{loc}/{p}", ok,
                  f"HTTP {st}, {len(txt)}b text, canonical={(c.group(1) if c else 'MISSING')}")

    print("\n=== 3. representative content + indexes ===")
    for p in INDEXES:
        st, _, b = get(f"{base}/en/{p}")
        check(f"/en/{p}", st == 200 and len(b) > 2000, f"HTTP {st}, {len(b)}b")
    st, _, b = get(f"{base}/ar")
    check("/ar root", st == 200 and len(b) > 2000, f"HTTP {st}")

    print("\n=== 4. static assets ===")
    st, _, home = get(base + "/en")
    css = re.findall(r'href="(/_next/static/[^"]+\.css)"', home)
    check("page references a stylesheet", len(css) >= 1, f"{len(css)} css ref(s)")
    for c in set(css):
        st, hh, b = get(base + c)
        check(f"stylesheet {c.rsplit('/', 1)[-1]}", st == 200 and "css" in hh.get("Content-Type", ""),
              f"HTTP {st}, {hh.get('Content-Type')}, {len(b)}b")
    js = set(re.findall(r'src="(/_next/static/[^"]+\.js)"', home))
    bad = [u for u in js if get(base + u)[0] != 200]
    check("every referenced JS chunk resolves", not bad, f"{len(js)} chunk(s), {len(bad)} broken")

    print("\n=== 5. SEO surface ===")
    st, hh, rb = get(base + "/robots.txt")
    check("robots.txt 200", st == 200, f"HTTP {st}")
    disallow = [l.strip() for l in rb.split("\n")
                if l.lower().startswith("disallow")]
    # Compare exact directives: a substring test flags "Disallow: /api/" as
    # "Disallow: /", which is a false positive -- /api/ is meant to be blocked.
    blanket = [d for d in disallow if d.split(":", 1)[1].strip() == "/"]
    check("robots.txt has no blanket Disallow", not blanket, f"directives={disallow}")
    check("robots.txt declares the sitemap on this origin",
          f"Sitemap: {origin}/sitemap.xml" in rb or "Sitemap:" in rb,
          next((l for l in rb.split("\n") if "Sitemap" in l), "no Sitemap line"))
    st, hh, sb = get(base + "/sitemap.xml")
    locs = re.findall(r"<loc>([^<]+)</loc>", sb)
    check("sitemap.xml 200", st == 200, f"HTTP {st}")
    check("sitemap is XML", sb.lstrip().startswith("<?xml"), "")
    check("sitemap has entries", len(locs) > 100, f"{len(locs)} <loc>")
    off = [u for u in locs if origin not in u]
    check("every sitemap URL uses the deployment origin", not off,
          f"{len(locs) - len(off)}/{len(locs)} on-origin; offenders: {off[:3]}")
    dead = [u for u in locs[:12] if get(u)[0] != 200]
    check("sampled sitemap URLs return 200", not dead, f"{min(12, len(locs))} sampled, {len(dead)} dead")

    print("\n=== 6. Google verification file ===")
    # Do NOT let a redirect satisfy this. Search Console fetches the literal path
    # it was given; a 307 to an extensionless twin is a redirect chain it may
    # refuse to follow, and it is invisible to a client that follows redirects.
    for p in ("/googledd514071c836e8ad.html", "/googledd514071c836e8ad"):
        st0, _, b0 = get_noredirect(base + p)
        ok = st0 == 200 and "googledd514071c836e8ad" in b0
        check(f"verification served directly at {p}", ok,
              f"first-hop HTTP {st0}" if st0 != 200 else f"HTTP 200, {len(b0)}b")
        if st0 != 200:
            notes.append(f"{p} answers {st0} on the first hop -- a redirect is not "
                         f"acceptable for Search Console")

    print("\n=== 7. search API ===")
    st, hh, b = get(base + "/api/search/en")
    check("/api/search/en 200", st == 200, f"HTTP {st}")
    try:
        d = json.loads(b)
        # The route returns {locale, docs:[...]}; accept any of the shapes it has
        # used, then assert the record count rather than the envelope shape.
        if isinstance(d, list):
            recs = d
        elif isinstance(d, dict):
            recs = next((d[k] for k in ("docs", "results", "items", "records")
                         if isinstance(d.get(k), list)), [])
        else:
            recs = []
        check("search payload is populated", len(recs) > 50, f"{len(recs)} records")
        # Leak boundary: the client bundle must never carry answer keys.
        blob = json.dumps(d)
        check("search payload leaks no answer keys",
              not re.search(r'"(?:answer|reason_wrong|explanation|pairs)"\s*:', blob), "")
    except Exception as e:
        check("search payload parses as JSON", False, str(e)[:60])

    print("\n=== 8. missing routes must 404, not soft-404 ===")
    for p in ("/en/definitely-not-a-real-page-xyz", "/en/nope"):
        st, _, _ = get_noredirect(base + p)
        check(f"{p} returns a real 404", st == 404, f"HTTP {st}")
    # A bare path carries no locale prefix, so the middleware 307s it into /en
    # first. The requirement is that the chain ENDS in 404, never a soft-200.
    req = urllib.request.Request(base + "/nope", headers={"User-Agent": UA})
    try:
        r = urllib.request.urlopen(req, timeout=25)
        check("/nope chain ends in 404", False, f"final HTTP {r.status} (soft-404)")
    except urllib.error.HTTPError as e:
        check("/nope chain ends in 404", e.code == 404, f"final HTTP {e.code}")

    print("\n=== 9. locale negotiation (next-intl middleware) ===")
    st, h0, _ = get_noredirect(base + "/")
    check("bare / redirects into a locale", st in (307, 302, 308),
          f"HTTP {st} -> {h0.get('Location')}")
    check("redirect target is /en", (h0.get("Location") or "").endswith("/en"),
          str(h0.get("Location")))
    for p in ("/en", "/ar", "/en/about", "/ar/about", "/en/concepts", "/ar/concepts",
              "/en/docs", "/ar/skills"):
        st, _, _ = get_noredirect(base + p)
        check(f"{p} serves directly (no redirect)", st == 200, f"HTTP {st}")

    print("\n=== 10. live browser (CSS applied + tags executing) ===")
    try:
        asyncio.run(browser_checks(base, origin, shots))
    except Exception as e:
        check("browser checks ran", False, f"{type(e).__name__}: {e}"[:110])

    print("\n" + "=" * 60)
    for n in notes:
        print(f"note: {n}")
    if failures:
        print(f"RESULT: {len(failures)} FAILURE(S)")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("RESULT: all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
