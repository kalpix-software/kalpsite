import { NextResponse, type NextRequest } from 'next/server';
import { LINK_HOSTS } from '@/lib/apps';

// Host isolation for app-link subdomains (e.g. plazy.kalpixsoftware.com).
//
// These subdomains share this Vercel project with the main site, but should
// ONLY serve invite links (/i/*) and the association files (/.well-known/*) —
// NOT the marketing pages. For any other path on a link host we bounce to the
// main site, so plazy.kalpixsoftware.com never exposes the rest of kalpsite.
//
// Normal hosts (www / root) are unaffected — middleware returns early.
//
// To let a link host instead mirror the full site, delete this file.
const MAIN_SITE = 'https://www.kalpixsoftware.com';

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  if (!LINK_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const path = req.nextUrl.pathname;
  if (path.startsWith('/i/') || path.startsWith('/.well-known/')) {
    return NextResponse.next();
  }

  return NextResponse.redirect(MAIN_SITE);
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ['/((?!_next/|favicon.ico).*)'],
};
