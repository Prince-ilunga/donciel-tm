import { SignJWT, jwtVerify } from 'jose';
import { hash, compare } from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDemoAccount } from '@/lib/demo-data';

// SECURITY: JWT_SECRET must be set in environment variables.
// Never fall back to a hardcoded secret — anyone could forge tokens.
const JWT_SECRET = new TextEncoder().encode(
  (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET manquant ou trop court (32+ caractères requis). ' +
        'Ajoutez-le dans les variables d\'environnement (Vercel → Settings → Environment Variables).'
      );
    }
    return secret;
  })()
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

export function setAuthCookie(token: string, secure = false): string {
  const sameSite = secure ? 'None' : 'Lax';
  const secureFlag = secure ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=${sameSite}${secureFlag}; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
}

export function clearAuthCookie(secure = false): string {
  const sameSite = secure ? 'None' : 'Lax';
  const secureFlag = secure ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly; SameSite=${sameSite}${secureFlag}; Path=/; Max-Age=0`;
}

/** Check if the request came through HTTPS (via Caddy gateway) */
export function isSecureRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get('X-Forwarded-Proto');
  return forwarded === 'https';
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

// ─── Compte démo public : lecture seule ─────────────────────
/**
 * À appeler au début de chaque route de mutation (POST/PUT/DELETE).
 * Retourne une Response 403 si l'utilisateur est le compte démo,
 * sinon null (continuer normalement).
 */
export function demoReadonlyGuard(email?: string | null): NextResponse | null {
  if (isDemoAccount(email)) {
    return NextResponse.json(
      {
        error:
          'Mode démo : ce compte est en lecture seule. Crée un compte gratuit pour enregistrer tes propres trades !',
        demo: true,
      },
      { status: 403 }
    );
  }
  return null;
}

export const ADMIN_EMAIL = 'doncielkabwe@gmail.com';
