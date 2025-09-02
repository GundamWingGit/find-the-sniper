'use client';

import { useUser } from '@clerk/nextjs';

export function useIsAdmin(): boolean {
  const { user } = useUser();
  const currentUserId = user?.id ?? '';
  const envList = process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? process.env.ADMIN_USER_IDS ?? '';
  const adminIds = envList.split(',').map(s => s.trim()).filter(Boolean);
  const isAdmin = adminIds.includes(currentUserId);
  if (typeof window !== 'undefined') console.debug('admin check', { currentUserId, adminIds, isAdmin });
  return isAdmin;
}