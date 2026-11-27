import { prisma } from '@/lib/prisma';

interface CachedConfigData {
  timestamp: number;
  configs: any[];
}

const configCacheMap = new Map<string, CachedConfigData>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Returns ConfigValue records from memory cache if fresh,
 * filtered by collegeId (including null system configs).
 */
export async function getAllConfigsCached(collegeId?: string | null) {
  const cacheKey = collegeId || '__global__';
  const now = Date.now();
  const cached = configCacheMap.get(cacheKey);

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.configs;
  }

  try {
    const where: any = {};
    if (collegeId) {
      where.OR = [
        { collegeId: null },
        { collegeId: collegeId },
      ];
    }

    const configs = await prisma.configValue.findMany({
      where,
      orderBy: { value: 'asc' },
    });

    configCacheMap.set(cacheKey, { timestamp: now, configs });
    return configs;
  } catch (error) {
    console.error('Error fetching configs from database:', error);
    if (cached) return cached.configs;
    throw error;
  }
}

/**
 * Returns a dictionary mapping config ID -> value string.
 */
export async function getConfigMapCached(collegeId?: string | null): Promise<Record<string, string>> {
  const configs = await getAllConfigsCached(collegeId);
  const map: Record<string, string> = {};
  for (let i = 0; i < configs.length; i++) {
    map[configs[i].id] = configs[i].value;
  }
  return map;
}

/**
 * Returns configs filtered by type from cache.
 */
export async function getConfigsByTypeCached(type: string, collegeId?: string | null) {
  const configs = await getAllConfigsCached(collegeId);
  return configs.filter(c => c.type === type);
}

/**
 * Invalidates the in-memory config cache for a college or globally.
 */
export function invalidateConfigCache(collegeId?: string | null) {
  if (collegeId) {
    configCacheMap.delete(collegeId);
    configCacheMap.delete('__global__');
  } else {
    configCacheMap.clear();
  }
}
