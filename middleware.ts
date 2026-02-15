import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  // Public routes - no auth needed
  const publicPaths = ['/login', '/student-login', '/api/auth/student-login', '/api/auth/student-session'];
  if (publicPaths.some(p => path.startsWith(p))) return res;

  // Student/Parent routes AND their API - check custom cookie
  if (path.startsWith('/student/') || path.startsWith('/parent/') || path.startsWith('/api/student/')) {
    const studentToken = req.cookies.get('student_session')?.value;
    if (!studentToken) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/student-login';
      return NextResponse.redirect(redirectUrl);
    }
    return res;
  }

  // Admin/Faculty routes - check Supabase session
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
