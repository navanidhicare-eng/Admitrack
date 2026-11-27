import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, getAuthToken } from '@/lib/auth';
import { getCachedGeo } from '@/lib/geoCache';

export const dynamic = 'force-dynamic';

// In-memory cache for fast summary responses
const summaryCache = new Map<string, { timestamp: number; payload: any }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function GET(req: Request) {
  try {
    const token = await getAuthToken(req, 'auth_token');

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token) as { role: string; employeeId?: string; collegeId?: string; id?: string } | null;
    
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const mandalId = searchParams.get('mandalId');
    const districtId = searchParams.get('districtId');

    const cacheKey = `${payload.collegeId || 'global'}_${mandalId || ''}_${districtId || ''}_${payload.employeeId || ''}`;
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload, { status: 200 });
    }

    let targetCollegeId = payload.collegeId;
    let userAssignedSchools: string[] | null = null;
    let userAssignedMandals: string[] = [];

    if (payload.employeeId || payload.id) {
      const currentUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(payload.employeeId ? [{ employeeId: payload.employeeId }] : []),
            ...(payload.id ? [{ id: payload.id }] : []),
          ],
        },
        select: { id: true, collegeId: true, assignedSchools: true, assignedMandals: true, role: true },
      });
      if (currentUser) {
        if (!targetCollegeId) targetCollegeId = currentUser.collegeId || undefined;
        if (payload.role === 'EMPLOYEE' || currentUser.role === 'EMPLOYEE') {
          userAssignedSchools = currentUser.assignedSchools || [];
          userAssignedMandals = currentUser.assignedMandals || [];
        }
      }
    }

    if (payload.role === 'AGM' && payload.employeeId) {
      const reportingStaff = await prisma.user.findMany({
        where: { assignedAgms: { has: payload.employeeId } },
        select: { assignedSchools: true, assignedMandals: true },
      });
      const agmSchools = Array.from(new Set(reportingStaff.flatMap(s => s.assignedSchools || [])));
      const agmMandals = Array.from(new Set(reportingStaff.flatMap(s => s.assignedMandals || [])));
      if (agmSchools.length > 0) userAssignedSchools = agmSchools;
      if (agmMandals.length > 0) userAssignedMandals = agmMandals;
    }

    const collegeFilter = targetCollegeId
      ? { OR: [{ collegeId: null }, { collegeId: targetCollegeId }] }
      : {};

    const studentFilter: any = {};
    if (payload.role === 'EMPLOYEE' && payload.employeeId) {
      studentFilter.employeeId = payload.employeeId;
    } else if (targetCollegeId) {
      studentFilter.OR = [
        { collegeId: targetCollegeId },
        { employee: { collegeId: targetCollegeId } },
      ];
    }

    const schoolsWhere: any = { type: 'SCHOOL', ...collegeFilter };
    if (userAssignedSchools !== null) {
      schoolsWhere.id = { in: userAssignedSchools.length > 0 ? userAssignedSchools : ['__none__'] };
    }

    // 1. Fetch cached Geo hierarchy (0ms RAM), schools, and student counts concurrently in parallel
    const [geo, allSchools, studentCounts] = await Promise.all([
      getCachedGeo(targetCollegeId || null),
      prisma.configValue.findMany({
        where: schoolsWhere,
        select: { id: true, value: true, parentId: true, strength: true, grade: true },
      }),
      prisma.student.groupBy({
        by: ['schoolName'],
        where: Object.keys(studentFilter).length > 0 ? studentFilter : undefined,
        _count: {
          id: true,
        },
      }),
    ]);

    let mandals = geo.mandals.map(m => ({ id: m.id, value: m.value, parentId: m.parentId }));
    if (mandalId) {
      mandals = mandals.filter(m => m.id === mandalId);
    } else if (districtId) {
      mandals = mandals.filter(m => m.parentId === districtId);
    }

    const allVillages = geo.villages.map(v => ({ id: v.id, parentId: v.parentId }));

    if (!mandals || mandals.length === 0) {
      const emptyPayload = { summaries: [] };
      summaryCache.set(cacheKey, { timestamp: Date.now(), payload: emptyPayload });
      return NextResponse.json(emptyPayload, { status: 200 });
    }

    // Fast O(1) Map indexing
    const villageToMandalMap = new Map<string, string>();
    allVillages.forEach(v => {
      if (v.parentId) villageToMandalMap.set(v.id, v.parentId);
    });

    const schoolsByMandalMap = new Map<string, Array<any>>();
    allSchools.forEach(s => {
      let mId: string | null = null;
      if (s.parentId) {
        mId = villageToMandalMap.get(s.parentId) || (mandals.some(m => m.id === s.parentId) ? s.parentId : null);
      }
      if (mId) {
        let list = schoolsByMandalMap.get(mId);
        if (!list) {
          list = [];
          schoolsByMandalMap.set(mId, list);
        }
        list.push(s);
      }
    });

    const countsMap: Record<string, number> = {};
    studentCounts.forEach(curr => {
      if (curr.schoolName) {
        countsMap[curr.schoolName.trim().toLowerCase()] = curr._count.id;
      }
    });

    // For Field Employees, only show mandals relevant to their assigned schools / mandals
    let targetMandals = mandals;
    if (payload.role === 'EMPLOYEE') {
      const filtered = mandals.filter(m => schoolsByMandalMap.has(m.id) || userAssignedMandals.includes(m.id));
      if (filtered.length > 0) {
        targetMandals = filtered;
      }
    }

    // Process each Mandal in O(1) lookup time
    const summaries = targetMandals.map(mandal => {
      const schoolsInMandal = schoolsByMandalMap.get(mandal.id) || [];
      const totalSchools = schoolsInMandal.length;
      const gradeCounts: Record<string, number> = {};
      let totalTarget = 0;
      let totalCollected = 0;

      schoolsInMandal.forEach(school => {
        const g = school.grade || 'N/A';
        gradeCounts[g] = (gradeCounts[g] || 0) + 1;

        const target = school.strength || 0;
        const schoolKey = school.value ? school.value.trim().toLowerCase() : '';
        const collected = countsMap[schoolKey] || 0;

        totalTarget += target;
        totalCollected += collected;
      });

      let percentage = 0;
      if (totalTarget > 0) {
        percentage = Math.min(100, Math.round((totalCollected / totalTarget) * 100));
      } else if (totalCollected > 0) {
        percentage = 100;
      }

      const remaining = Math.max(0, totalTarget - totalCollected);

      return {
        mandalId: mandal.id,
        mandalName: mandal.value,
        totalSchools,
        gradeCounts,
        totalTarget,
        totalCollected,
        remaining,
        percentage,
      };
    });

    // Sort by name
    summaries.sort((a, b) => a.mandalName.localeCompare(b.mandalName));

    const responsePayload = { summaries };
    summaryCache.set(cacheKey, { timestamp: Date.now(), payload: responsePayload });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    console.error('Error generating mandal summaries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
