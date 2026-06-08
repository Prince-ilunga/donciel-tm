import { SignJWT, jwtVerify } from 'jose';
import { hash, compare } from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'donciel-tm-secret-key-2024-dev-only'
);

const COOKIE_NAME = 'donciel-tm-token';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      email: payload.email as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function comparePassword(
  password: string,
  hashed: string
): Promise<boolean> {
  return compare(password, hashed);
}

export function setAuthCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
}

export function clearAuthCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getAuthUser(): Promise<{
  user: TokenPayload & { status: string; name: string | null; language: string };
  error?: never;
} | {
  user?: never;
  error: string;
}> {
  const payload = await getCurrentUser();
  if (!payload) {
    return { error: 'Non autorisé' };
  }

  const user = await db.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, role: true, status: true, name: true, language: true },
  });

  if (!user || user.status !== 'approved') {
    return { error: 'Compte non approuvé ou inexistant' };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      name: user.name,
      language: user.language,
    },
  };
}

export function isAdmin(user: TokenPayload): boolean {
  return user.role === 'admin';
}

export const ADMIN_EMAIL = 'doncielkabwe@gmail.com';
