import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getCollegeUser } from '@/lib/collegeCache';
import { getCachedGeo } from '@/lib/geoCache';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session || session.role !== 'COLLEGE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCollegeUser(session.employeeId);
    if (!currentUser || !currentUser.collegeId || !currentUser.college) {
      return NextResponse.json({ error: 'College not found' }, { status: 404 });
    }

    const { id } = await params;
    const collegeId = currentUser.collegeId;

    // Concurrently fetch Geo, member, AGMs, college schools, and field staff in 1 parallel round-trip
    const [geo, member, agmsList, schoolsRaw, fieldEmployees] = await Promise.all([
      getCachedGeo(collegeId),
      prisma.user.findFirst({
        where: {
          id,
          collegeId,
        },
        select: {
          id: true,
          employeeId: true,
          name: true,
          role: true,
          isActive: true,
          assignedAgms: true,
          assignedMandals: true,
          assignedSchools: true,
          academicYear: true,
          admissionTarget: true,
          dailyDoorstepTarget: true,
          monthlyDoorstepTarget: true,
          createdAt: true,
          _count: {
            select: {
              students: true,
              visitsCreated: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          collegeId,
          role: 'AGM',
          isActive: true,
        },
        select: {
          id: true,
          employeeId: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.configValue.findMany({
        where: { type: 'SCHOOL', collegeId },
        select: { id: true, value: true, parentId: true, strength: true, grade: true },
        orderBy: { value: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          collegeId,
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

    if (!member) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const { districts: districtsRaw, mandals: mandalsRaw, villages: villagesRaw } = geo;

    const districts = districtsRaw.map(d => ({
      id: d.id,
      name: d.value,
    }));

    const mandalMap = new Map<string, { id: string; name: string; districtId: string | null }>();
    mandalsRaw.forEach(m => mandalMap.set(m.id, { id: m.id, name: m.value, districtId: m.parentId }));

    const villageMap = new Map<string, { id: string; name: string; mandalId: string | null }>();
    villagesRaw.forEach(v => {
      villageMap.set(v.id, {
        id: v.id,
        name: v.value,
        mandalId: v.parentId,
      });
    });

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
        districtId: mandal ? mandal.districtId : null,
        villageName,
        strength: s.strength || 0,
        grade: s.grade || '',
      };
    });

    const mandals = mandalsRaw.map(m => ({
      id: m.id,
      name: m.value,
      districtId: m.parentId,
    }));

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

    const validCollegeSchoolSet = new Set(schools.map(s => s.id));
    const sanitizedMember = {
      ...member,
      assignedSchools: (member.assignedSchools || []).filter(sId => validCollegeSchoolSet.has(sId)),
    };

    return NextResponse.json({
      member: sanitizedMember,
      agms: agmsList,
      districts,
      mandals,
      schools,
      schoolAssignments,
    });
  } catch (error) {
    console.error('Error fetching member details:', error);
    return NextResponse.json({ error: 'Failed to fetch member details' }, { status: 500 });
  }
}
