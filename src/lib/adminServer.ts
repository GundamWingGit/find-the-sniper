import 'server-only';

/** Reads comma-separated IDs from env (server-side only) */
function getAdminIds(): string[] {
  const raw =
    process.env.ADMIN_USER_IDS ??
    process.env.NEXT_PUBLIC_ADMIN_USER_IDS ??
    '';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function isAdminId(userId?: string | null): boolean {
  if (!userId) return false;
  const admins = getAdminIds();
  return admins.includes(userId);
}
