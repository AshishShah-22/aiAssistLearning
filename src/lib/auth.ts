import { cookies } from 'next/headers';
import { db } from './db';
import crypto from 'crypto';

// Hash password with scrypt (built-in Node.js, no deps)
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString('hex') === key);
    });
  });
}

// Get current user from session cookie
export async function getCurrentUser(): Promise<{ id: string; name: string | null; email: string; avatar: string | null } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;

  try {
    const payload = Buffer.from(token, 'base64').toString('utf-8');
    const [id, email, , timestamp] = payload.split('|||');
    const ts = parseInt(timestamp, 10);
    // Session valid for 30 days
    if (Date.now() - ts > 30 * 24 * 60 * 60 * 1000) return null;

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, avatar: true },
    });
    return user;
  } catch {
    return null;
  }
}

// Create session token (base64 encoded payload)
export function createSessionToken(user: { id: string; email: string; name?: string | null }): string {
  const payload = `${user.id}|||${user.email}|||${user.name || ''}|||${Date.now()}`;
  return Buffer.from(payload).toString('base64');
}

// Cookie options constant
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};