import { prisma } from './prisma';

interface CachedCollegeUser {
  timestamp: number;
  user: any;
}

const collegeUserCache = new Map<string, CachedCollegeUser>();
const USER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getCollegeUser(employeeId: string) {
  const now = Date.now();
  const cached = collegeUserCache.get(employeeId);
  if (cached && now - cached.timestamp < USER_CACHE_TTL_MS) {
    return cached.user;
  }

  const user = await prisma.user.findUnique({
    where: { employeeId },
    include: { college: true },
  });

  if (user) {
    collegeUserCache.set(employeeId, { timestamp: now, user });
  }

  return user;
}

export function invalidateCollegeUser(employeeId: string) {
  collegeUserCache.delete(employeeId);
}
