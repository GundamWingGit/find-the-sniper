import 'server-only';

const ADMIN_IDS = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/** True if userId is in ADMIN_USER_IDS (comma-separated) */
export function isAdminId(userId?: string | null): boolean {
  if (!userId) return false;
  return ADMIN_IDS.includes(userId);
}