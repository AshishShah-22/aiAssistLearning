import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createSessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if email is already taken
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await db.user.create({
      data: {
        name: name || null,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
      select: { id: true, name: true, email: true, avatar: true },
    });

    // Migrate orphaned notebooks (notebooks belonging to dummy user) to this new user
    // This handles the case where notebooks were created before auth existed
    const DUMMY_USER_ID = 'user-1';
    if (user.id !== DUMMY_USER_ID) {
      await db.notebook.updateMany({
        where: { userId: DUMMY_USER_ID },
        data: { userId: user.id },
      });
      // Also migrate study sessions from dummy user
      await db.studySession.updateMany({
        where: { userId: DUMMY_USER_ID },
        data: { userId: user.id },
      });
      // Also migrate quiz attempts from dummy user
      await db.quizAttempt.updateMany({
        where: { userId: DUMMY_USER_ID },
        data: { userId: user.id },
      });
    }

    // Create session token
    const token = createSessionToken(user);

    // Return response with session cookie
    const response = NextResponse.json(
      { user },
      { status: 201 }
    );
    response.cookies.set('session', token, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}