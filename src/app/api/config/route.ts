import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken, getAuthToken } from '@/lib/auth';
import { getAllConfigsCached, invalidateConfigCache } from '@/lib/cache';
import { invalidateGeoCache } from '@/lib/geoCache';

export const dynamic = 'force-dynamic';

// GET config values (Tenant-aware & Employee school-isolated: Field staff only get their assigned schools)
export async function GET(req: Request) {
  try {
    const token = await getAuthToken(req, 'auth_token');
    let collegeId: string | null = null;
    let userAssignedSchools: string[] | null = null;

    if (token) {
      const payload = verifyToken(token) as { role: string; employeeId: string; collegeId?: string } | null;
      if (payload && payload.role !== 'ADMIN') {
        if (payload.role === 'EMPLOYEE' && payload.employeeId) {
          const user = await prisma.user.findUnique({
            where: { employeeId: payload.employeeId },
            select: { collegeId: true, assignedSchools: true },
          });
          collegeId = user?.collegeId || payload.collegeId || null;
          userAssignedSchools = user?.assignedSchools || [];
        } else if (payload.collegeId) {
          collegeId = payload.collegeId;
        } else if (payload.employeeId) {
          const user = await prisma.user.findUnique({
            where: { employeeId: payload.employeeId },
            select: { collegeId: true },
          });
          collegeId = user?.collegeId || null;
        }
      }
    }

    const configs = await getAllConfigsCached(collegeId);

    // Filter schools strictly by employee assignment
    let finalConfigs = configs;
    if (userAssignedSchools !== null) {
      finalConfigs = configs.filter(c => c.type !== 'SCHOOL' || userAssignedSchools!.includes(c.id));
    }
    
    return NextResponse.json(
      { configs: finalConfigs }, 
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        }
      }
    );
  } catch (error) {
    console.error('Error fetching configs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST new config value (Admin or College Admin)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token) as { role: string; employeeId: string; collegeId?: string } | null;
    
    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'COLLEGE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let targetCollegeId: string | null = null;
    if (payload.role === 'COLLEGE') {
      if (payload.collegeId) {
        targetCollegeId = payload.collegeId;
      } else {
        const user = await prisma.user.findUnique({
          where: { employeeId: payload.employeeId },
          select: { collegeId: true },
        });
        targetCollegeId = user?.collegeId || null;
      }

      if (!targetCollegeId) {
        return NextResponse.json({ error: 'College not found for current user' }, { status: 404 });
      }
    }

    const data = await req.json();
    const { type, value, parentId, strength, grade, headmasterName, headmasterPhone, keyPersonName, keyPersonPhone } = data;

    if (!type || !value) {
      return NextResponse.json({ error: 'Type and Value are required' }, { status: 400 });
    }

    let parsedStrength = 0;
    if (strength !== undefined && strength !== null && strength !== '') {
      const num = parseInt(strength, 10);
      parsedStrength = isNaN(num) ? 0 : num;
    }

    const config = await prisma.configValue.create({
      data: {
        type,
        value: String(value).trim(),
        parentId: parentId || null,
        strength: parsedStrength,
        grade: grade || null,
        headmasterName: headmasterName || null,
        headmasterPhone: headmasterPhone || null,
        keyPersonName: keyPersonName || null,
        keyPersonPhone: keyPersonPhone || null,
        collegeId: targetCollegeId,
      }
    });

    // Invalidate static and geo caches for this college
    invalidateConfigCache(targetCollegeId);
    invalidateGeoCache(targetCollegeId);

    return NextResponse.json({ message: 'Config added', config }, { status: 201 });
  } catch (error) {
    console.error('Error adding config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
