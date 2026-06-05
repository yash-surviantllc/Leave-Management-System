import { deleteCachedByPrefix } from "./cache";

const dashboardSummaryCachePrefix = "dashboard:summary:";

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getDashboardCacheKey(input: {
  userId: string;
  roles: string[];
  permissions: string[];
  date: Date;
}): string {
  const accessKey = [...input.roles, ...input.permissions].sort().join(",");

  return `${dashboardSummaryCachePrefix}${input.userId}:${getDateKey(input.date)}:${accessKey}`;
}

export function clearDashboardSummaryCacheForUser(userId: string): Promise<void> {
  return deleteCachedByPrefix(`${dashboardSummaryCachePrefix}${userId}:`);
}
