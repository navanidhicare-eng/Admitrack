import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getJwtSecret } from '@/core/config/env';

export function signToken(payload: object) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

export async function getAuthToken(req?: Request, cookieName: string = 'auth_token'): Promise<string | null> {
  // 1. Check Authorization header: Bearer <token>
  if (req) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.substring(7).trim();
    }
  }

  // 2. Fallback to httpOnly cookies for Next.js web application
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieName)?.value;
    if (token) return token;
  } catch {}

  return null;
}

