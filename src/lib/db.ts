import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Ensure the dummy user exists for development
const DUMMY_USER_ID = 'user-1';
let _userEnsured = false;

export async function ensureUser() {
  if (_userEnsured) return;
  try {
    await db.user.upsert({
      where: { id: DUMMY_USER_ID },
      update: {},
      create: {
        id: DUMMY_USER_ID,
        name: 'Demo User',
        email: 'demo@studyai.app',
        password: '__dummy_no_login__',
      },
    });
    _userEnsured = true;
  } catch {
    // Ignore - user might already exist
    _userEnsured = true;
  }
}

// Auto-ensure on module load
ensureUser();