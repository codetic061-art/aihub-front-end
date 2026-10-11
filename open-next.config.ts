// open-next.config.ts — Cloudflare adapter configuration.
//
// WHY THIS CONFIG (do not simplify back to the bare default):
//
// The site is FULLY PRERENDERED at build time — 195 static pages, 0 dynamic
// routes. By default OpenNext still routes every HTML request through the
// Next.js Node server function. On the Cloudflare Workers FREE plan that
// server function exceeds the per-request CPU limit, so HTML and /api routes
// intermittently fail with error 1102 ("Worker exceeded resource limits"),
// while static assets (CSS/JS/txt) serve fine because they bypass the server.
//
// staticAssetsIncrementalCache + enableCacheInterception tells OpenNext to
// serve prerendered pages directly from the static-asset cache WITHOUT loading
// the Node server. This is the documented configuration for a fully-static
// site on Workers and removes the CPU bottleneck entirely. It needs no R2,
// Durable Object, or D1 bindings — the cache IS the static asset layer.
//
// If a request ever misses the cache, it falls back to the NextServer as usual,
// so this only makes the common (fully-cached) path fast and cheap.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  // Serve prerendered SSG pages straight from the cache, skipping NextServer.
  // This is what keeps HTML routes under the Workers CPU limit.
  enableCacheInterception: true,
});
