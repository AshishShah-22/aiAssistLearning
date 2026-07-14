# Task 1-3: Backend Auth System

## Agent: Backend Auth Agent

## What was done
Implemented a complete session-based authentication system for the AI Study Platform.

## Files Created/Modified

### Modified
- `prisma/schema.prisma` — Added `password String` field to User model
- `src/lib/db.ts` — Added password field to dummy user creation

### Created
- `src/lib/auth.ts` — Auth utilities (hash/verify password, session management, cookie config)
- `src/lib/with-auth.ts` — Auth middleware wrapper for API routes
- `src/app/api/auth/register/route.ts` — POST register with validation + notebook migration
- `src/app/api/auth/login/route.ts` — POST login with password verification
- `src/app/api/auth/session/route.ts` — GET current user / DELETE logout
- `src/app/api/auth/me/route.ts` — GET current user or 401

## Key Decisions
- Used Node.js built-in `crypto.scrypt` for password hashing (no extra deps)
- Session tokens are base64-encoded payloads (sufficient for this app, not production-security-grade)
- Dummy user (`user-1`) gets a sentinel password `__dummy_no_login__` and cannot log in
- On first real user registration, all existing data (notebooks, study sessions, quiz attempts) is migrated from dummy user to the new user
- Login errors are generic ("Invalid email or password") to prevent user enumeration

## Validation
- ✅ ESLint: 0 errors
- ✅ All 4 auth endpoints compile and serve
- ✅ Database schema synced with `db:push`