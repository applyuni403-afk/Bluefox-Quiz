import { getIronSession, type SessionOptions, type CookieStore } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isAdmin?: boolean;
}

const DEFAULT_SECRET = 'bluefox_quiz_secure_session_secret_at_least_32_chars_long';

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || DEFAULT_SECRET,
  cookieName: 'bluefox_admin_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore as unknown as CookieStore,
    sessionOptions
  );
  return session;
}

export async function checkIsAdmin(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session.isAdmin);
}

export async function assertAdmin(): Promise<void> {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin PIN login required');
  }
}

export async function loginAdmin(pin: string): Promise<boolean> {
  const validPin = process.env.ADMIN_PIN || 'bluefox2026';
  if (pin.trim() !== validPin.trim()) {
    return false;
  }
  const session = await getSession();
  session.isAdmin = true;
  await session.save();
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
