export default function middleware(request: Request) {
  const url = new URL(request.url);
  let pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (pathname.startsWith('//')) {
    pathname = '/' + pathname.replace(/^\/+/, '');
  }

  const isProtectedPage = pathname === '/' ||
                         pathname === '/index.html' ||
                         pathname === '/hub' ||
                         pathname === '/ntqa' ||
                         pathname === '/ntqa.html';

  if (isProtectedPage) {
    const cookieHeader = request.headers.get('cookie') || '';
    const hasSessionCookie = cookieHeader.split(';').some(c => c.trim().startsWith('runningly-session='));

    if (!hasSessionCookie) {
      const loginUrl = new URL('/api/auth/login', request.url);
      let target = pathname + (url.search || '');
      if (target.startsWith('//')) {
        target = '/' + target.replace(/^\/+/, '');
      }
      loginUrl.searchParams.set('next', target);
      return Response.redirect(loginUrl, 302);
    }
  }
}

export const config = {
  matcher: [
    '/',
    '/index.html',
    '/hub',
    '/hub/',
    '/ntqa',
    '/ntqa/',
    '/ntqa.html',
  ],
};
