import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const USER_ROUTES = ['/dashboard', '/my-classes', '/learn', '/bonuses', '/certificates', '/transactions', '/affiliate', '/account', '/webinars', '/community', '/member-map'];
const ADMIN_ROUTES = ['/admin'];
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const ref = searchParams.get('ref');
  const isUserRoute = USER_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
  const isAdminRoute = ADMIN_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
  const isAuthRoute = AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  const sessionCookie = request.cookies.get('session');
  const roleCookie = request.cookies.get('role');

  // Redirect unauthenticated users away from protected routes
  if ((isUserRoute || isAdminRoute) && !sessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(loginUrl);
    if (ref) {
      redirectResponse.cookies.set({
        name: 'affiliate_code',
        value: ref,
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: false,
      });
    }
    return redirectResponse;
  }

  // Redirect non-admins away from admin routes
  if (isAdminRoute && sessionCookie) {
    const role = roleCookie?.value;
    if (role !== 'admin' && role !== 'super_admin') {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      dashboardUrl.searchParams.delete('redirect');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Redirect logged-in users away from auth pages
  if (isAuthRoute && sessionCookie) {
    const role = roleCookie?.value;
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  // Set affiliate cookie if ?ref= present
  const response = NextResponse.next();
  if (ref) {
    response.cookies.set({
      name: 'affiliate_code',
      value: ref,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
