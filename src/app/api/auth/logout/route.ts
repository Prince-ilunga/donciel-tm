import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ message: 'Déconnexion réussie' });
  response.headers.set('Set-Cookie', clearAuthCookie());
  return response;
}
