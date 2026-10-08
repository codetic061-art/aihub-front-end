import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl reads the routing module to generate middleware and locale handling.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Pre-render every content route at build time.
   *
   * The single most important performance decision in the project: the 170+ URLs
   * become static HTML rather than server-rendered per request.
   * `generateStaticParams` in each route family enumerates the real records, so
   * adding content adds pages without touching a template.
   */

  /**
   * The content tree is read at build time from `../content` (see
   * src/lib/content.ts) and is not bundled into this app, so nothing in it is
   * resolvable through next/image. Illustration art is inline SVG built from
   * tokens; there are no remote images to allow.
   */
  images: {
    remotePatterns: [],
  },

  experimental: {
    // Tree-shake the icon set: lucide ships ~1500 icons and only a handful ship.
    optimizePackageImports: ['lucide-react'],
  },
};

export default withNextIntl(nextConfig);
import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
