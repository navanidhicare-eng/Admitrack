import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, getAuthToken } from '@/lib/auth';
import { getCachedGeo } from '@/lib/geoCache';

export const dynamic = 'force-dynamic';

const schoolsProgressCache = new Map<string, { timestamp: number; payload: any }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function GET(req: Request) {
  try {
    const token = await getAuthToken(req, 'auth_token');

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token) as { role: string; employeeId?: string; collegeId?: string } | null;
    
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const mandalId = searchParams.get('mandalId');
    const districtId = searchParams.get('districtId');
    const grade = searchParams.get('grade');

    if (!mandalId && !districtId) {
      return NextResponse.json({ error: 'Mandal ID or District ID is required' }, { status: 400 });
    }

    const cacheKey = `${payload.collegeId || 'global'}_${mandalId || ''}_${districtId || ''}_${grade || ''}_${payload.employeeId || ''}`;
    const cached = schoolsProgressCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload, { status: 200 });
    }

    // 1. Fetch geo hierarchy from memory cache (0ms) and user permissions in parallel
    const [geo, currentUser, reportingStaff] = await Promise.all([
      getCachedGeo(payload.collegeId || null),
      payload.role === 'EMPLOYEE' && payload.employeeId
        ? prisma.user.findUnique({
            where: { employeeId: payload.employeeId },
            select: { assignedSchools: true, collegeId: true },
          })
        : null,
      payload.role === 'AGM' && payload.employeeId
        ? prisma.user.findMany({
            where: { assignedAgms: { has: payload.employeeId } },
            select: { assignedSchools: true },
          })
        : null,
    ]);

    let reportTitleLocation = '';
    let targetMandalIds: string[] = [];

    if (mandalId) {
      const mandal = geo.mandals.find(m => m.id === mandalId);
      if (!mandal) {
        return NextResponse.json({ error: 'Mandal not found' }, { status: 404 });
      }
      targetMandalIds = [mandal.id];
      reportTitleLocation = `${mandal.value} Mandal`;
    } else if (districtId) {
      const district = geo.districts.find(d => d.id === districtId);
      if (!district) {
        return NextResponse.json({ error: 'District not found' }, { status: 404 });
      }
      reportTitleLocation = `${district.value} District`;
      targetMandalIds = geo.mandals.filter(m => m.parentId === districtId).map(m => m.id);
    }

    // Fast O(1) village lookup from RAM
    const targetMandalSet = new Set(targetMandalIds);
    const villages = geo.villages.filter(v => v.parentId && targetMandalSet.has(v.parentId));
    const villageIds = villages.map(v => v.id);
    const villageMap = new Map<string, string>();
    villages.forEach(v => villageMap.set(v.id, v.value));
    const validParentIds = [...villageIds, ...targetMandalIds];

    // Determine school ownership / assignment based on user role
    let userAssignedSchools: string[] | null = null;
    if (payload.role === 'EMPLOYEE') {
      userAssignedSchools = currentUser?.assignedSchools || [];
    } else if (payload.role === 'AGM') {
      const agmSchools = Array.from(new Set((reportingStaff || []).flatMap(s => s.assignedSchools || [])));
      if (agmSchools.length > 0) {
        userAssignedSchools = agmSchools;
      }
    }

    const effectiveCollegeId = payload.collegeId || currentUser?.collegeId;

    // Fetch schools under these villages/mandals
    const schoolsWhere: any = {
      type: 'SCHOOL',
      parentId: { in: validParentIds },
    };
    if (grade) {
      schoolsWhere.grade = grade;
    }
    if (effectiveCollegeId) {
      schoolsWhere.OR = [{ collegeId: null }, { collegeId: effectiveCollegeId }];
    }
    // Strict assignment isolation: Field employee MUST only see schools assigned to them!
    if (userAssignedSchools !== null) {
      schoolsWhere.id = { in: userAssignedSchools.length > 0 ? userAssignedSchools : ['__none__'] };
    }

    // Student count query conditions
    const studentWhereClause: any = {};
    if (payload.role !== 'ADMIN' && payload.role !== 'TELECALLER' && payload.employeeId) {
      studentWhereClause.employeeId = payload.employeeId;
    }
    if (effectiveCollegeId) {
      studentWhereClause.OR = [
        { collegeId: effectiveCollegeId },
        { employee: { collegeId: effectiveCollegeId } },
      ];
    }

    // Run school fetch and student grouping in parallel
    const [schools, studentCounts] = await Promise.all([
      prisma.configValue.findMany({
        where: schoolsWhere,
        select: { id: true, value: true, parentId: true, strength: true, grade: true },
      }),
      prisma.student.groupBy({
        by: ['schoolName'],
        where: Object.keys(studentWhereClause).length > 0 ? studentWhereClause : undefined,
        _count: {
          id: true,
        },
      }),
    ]);

    const countsMap: Record<string, number> = {};
    studentCounts.forEach(curr => {
      if (curr.schoolName) {
        countsMap[curr.schoolName.trim().toLowerCase()] = curr._count.id;
      }
    });

    const reportData = schools.map(school => {
      const schoolKey = school.value ? school.value.trim().toLowerCase() : '';
      const collected = countsMap[schoolKey] || 0;
      const target = school.strength || 0;
      const villageName = school.parentId ? villageMap.get(school.parentId) || 'Unknown' : 'Unknown';

      let percentage = 0;
      if (target > 0) {
        percentage = Math.min(100, Math.round((collected / target) * 100));
      } else if (collected > 0) {
        percentage = 100;
      }

      const displayName = school.value && school.value.trim() ? school.value.trim() : 'Unknown School';

      return {
        id: school.id,
        name: displayName,
        schoolName: displayName,
        grade: school.grade || 'N/A',
        target,
        collected,
        remaining: Math.max(0, target - collected),
        percentage,
        villageName,
        village: villageName,
      };
    });

    reportData.sort((a, b) => b.collected - a.collected);

    const responsePayload = {
      reportTitleLocation,
      report: reportData,
    };
    schoolsProgressCache.set(cacheKey, { timestamp: Date.now(), payload: responsePayload });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    console.error('Error generating schools progress report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
