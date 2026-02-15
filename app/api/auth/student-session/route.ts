import { NextRequest, NextResponse } from 'next/server';

function decodeToken(token: string, secret: string): any | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const crypto = require('crypto');
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null; // Expired
    return payload;
  } catch (e) { return null; }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('student_session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const secret = process.env.STUDENT_AUTH_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'edutrack-secret-key';
  const payload = decodeToken(token, secret);

  if (!payload) {
    const response = NextResponse.json({ error: 'Session expired. Please login again.' }, { status: 401 });
    response.cookies.delete('student_session');
    return response;
  }

  return NextResponse.json({ session: payload });
}

// Logout
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('student_session');
  return response;
}
