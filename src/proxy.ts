import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  /**
   * Run on every path EXCEPT Next internals, the API surface and any file with
   * an extension (a request for /favicon.ico or /logo.svg must not be treated as
   * a locale-prefixed route). The locale matcher from next-intl is the accurate
   * version of this list.
   */
  matcher: '/((?!api|_next|_vercel|favicon\\.ico|.*\\..*).*)',
};