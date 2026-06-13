import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie, isSecureRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: 'Déconnexion réussie' });
  response.headers.set('Set-Cookie', clearAuthCookie(isSecureRequest(request)));
  return response;
}
