import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  
  // Exclude API routes from middleware redirect (let them handle their own auth)
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const isPublicPage = request.nextUrl.pathname === '/' || 
                       request.nextUrl.pathname === '/terms-and-conditions' ||
                       request.nextUrl.pathname.startsWith('/pamphlet') ||
                       request.nextUrl.pathname.startsWith('/brochure') ||
                       request.nextUrl.pathname.startsWith('/scannn');

  if (!token && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};
