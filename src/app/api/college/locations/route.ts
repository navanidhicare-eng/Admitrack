import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getCollegeUser } from '@/lib/collegeCache';
import { getCachedGeo } from '@/lib/geoCache';

export const dynamic = 'force-dynamic';

const locationsCache = new Map<string, { timestamp: number; data: any }>();
const LOCATIONS_CACHE_TTL_MS = 30 * 1000; // 30 seconds

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || session.role !== 'COLLEGE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCollegeUser(session.employeeId);
    if (!currentUser || !currentUser.collegeId || !currentUser.college) {
      return NextResponse.json({ error: 'College not found' }, { status: 404 });
    }

    const collegeId = currentUser.collegeId;

    // Check cache
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
    if (!forceRefresh) {
      const cached = locationsCache.get(collegeId);
      if (cached && Date.now() - cached.timestamp < LOCATIONS_CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
      }
    }

    // 1. Fetch cached Geo and college-specific data concurrently
    const [geo, schoolsRaw, fieldEmployees] = await Promise.all([
      getCachedGeo(collegeId),
      prisma.configValue.findMany({
        where: { type: 'SCHOOL', collegeId: collegeId },
        select: { id: true, value: true, parentId: true, strength: true, grade: true },
        orderBy: { value: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          collegeId: collegeId,
          role: 'EMPLOYEE',
        },
        select: {
          id: true,
          name: true,
          employeeId: true,
          isActive: true,
          assignedMandals: true,
          assignedSchools: true,
        },
      }),
    ]);

    const { mandals: mandalsRaw, villages: villagesRaw } = geo;

    const mandalMap = new Map<string, { id: string; name: string }>();
    mandalsRaw.forEach(m => mandalMap.set(m.id, { id: m.id, name: m.value }));

    const villageMap = new Map<string, { id: string; name: string; mandalId: string | null }>();
    villagesRaw.forEach(v => {
      villageMap.set(v.id, {
        id: v.id,
        name: v.value,
        mandalId: v.parentId,
      });
    });

    // 2. Build enriched schools list with mapped Mandal and Village
    const schools = schoolsRaw.map(s => {
      let mandalId: string | null = null;
      let villageName = '';

      if (s.parentId) {
        const v = villageMap.get(s.parentId);
        if (v) {
          villageName = v.name;
          mandalId = v.mandalId;
        } else if (mandalMap.has(s.parentId)) {
          mandalId = s.parentId;
        }
      }

      const mandal = mandalId ? mandalMap.get(mandalId) : null;

      return {
        id: s.id,
        name: s.value,
        mandalId: mandalId,
        mandalName: mandal ? mandal.name : 'Other / General',
        villageName,
        strength: s.strength || 0,
        grade: s.grade || '',
      };
    });

    const mandals = mandalsRaw.map(m => ({
      id: m.id,
      name: m.value,
    }));

    // schoolAssignments: { [schoolId]: { employeeId, employeeName, isActive } }
    const schoolAssignments: Record<string, { employeeId: string; employeeName: string; isActive: boolean }> = {};

    fieldEmployees.forEach(emp => {
      emp.assignedSchools.forEach(schId => {
        schoolAssignments[schId] = {
          employeeId: emp.id,
          employeeName: emp.name,
          isActive: emp.isActive,
        };
      });
    });

    const responsePayload = {
      mandals,
      schools,
      schoolAssignments,
    };

    locationsCache.set(collegeId, { timestamp: Date.now(), data: responsePayload });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error fetching college locations and assignments:', error);
    return NextResponse.json({ error: 'Failed to load locations' }, { status: 500 });
  }
}
