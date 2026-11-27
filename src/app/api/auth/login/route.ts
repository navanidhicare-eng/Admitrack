import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { checkAuthRateLimit, getClientIp } from '@/core/security/rate-limiter';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const ipLimit = checkAuthRateLimit(`login:ip:${ip}`, 10, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const { employeeId, password } = await req.json();

    if (!employeeId || !password) {
      return NextResponse.json({ error: 'Employee ID and Password are required.' }, { status: 400 });
    }

    const cleanId = employeeId.trim();
    const cleanPassword = password.trim();

    const idLimit = checkAuthRateLimit(
      `login:id:${cleanId.toLowerCase()}`,
      5,
      60_000
    );
    if (!idLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts for this account. Please wait a minute.' },
        {
          status: 429,
          headers: { 'Retry-After': String(idLimit.retryAfterSeconds) },
        }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        employeeId: {
          equals: cleanId,
          mode: 'insensitive',
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.password);

    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: 'Account is disabled. Please contact Admin.' }, { status: 403 });
    }

    const token = signToken({
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      collegeId: user.collegeId || null,
    });

    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return NextResponse.json(
      { message: 'Login successful', token, user: { name: user.name, role: user.role, employeeId: user.employeeId } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
