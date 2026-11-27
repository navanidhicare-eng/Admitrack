import { prisma } from './prisma';

interface GeoData {
  timestamp: number;
  districts: Array<{ id: string; value: string }>;
  mandals: Array<{ id: string; value: string; parentId: string | null }>;
  villages: Array<{ id: string; value: string; parentId: string | null }>;
}

const geoCacheMap = new Map<string, GeoData>();
const GEO_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

export async function getCachedGeo(collegeId?: string | null) {
  const cacheKey = collegeId || '__global__';
  const now = Date.now();
  const cached = geoCacheMap.get(cacheKey);

  if (cached && now - cached.timestamp < GEO_TTL_MS) {
    return {
      districts: cached.districts,
      mandals: cached.mandals,
      villages: cached.villages,
    };
  }

  const whereCondition = (type: string) => {
    if (collegeId) {
      return {
        type,
        OR: [{ collegeId: null }, { collegeId }],
      };
    }
    return { type };
  };

  try {
    const [districts, mandals, villages] = await Promise.all([
      prisma.configValue.findMany({
        where: whereCondition('DISTRICT'),
        select: { id: true, value: true },
        orderBy: { value: 'asc' },
      }),
      prisma.configValue.findMany({
        where: whereCondition('MANDAL'),
        select: { id: true, value: true, parentId: true },
        orderBy: { value: 'asc' },
      }),
      prisma.configValue.findMany({
        where: whereCondition('VILLAGE'),
        select: { id: true, value: true, parentId: true },
      }),
    ]);

    const data: GeoData = { timestamp: now, districts, mandals, villages };
    geoCacheMap.set(cacheKey, data);
    return { districts, mandals, villages };
  } catch (error) {
    if (cached) {
      return {
        districts: cached.districts,
        mandals: cached.mandals,
        villages: cached.villages,
      };
    }
    throw error;
  }
}

export function invalidateGeoCache(collegeId?: string | null) {
  if (collegeId) {
    geoCacheMap.delete(collegeId);
  } else {
    geoCacheMap.clear();
  }
}
