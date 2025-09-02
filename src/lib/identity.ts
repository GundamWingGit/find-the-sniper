'use client';

/**
 * Returns a stable "guest_id" in localStorage for anonymous play.
 * Safe for SSR: if window/localStorage is unavailable, returns ''.
 */
export function getOrCreateLocalGuestId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem('guest_id');
    if (!id) {
      // Use crypto.randomUUID() for uniqueness
      id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem('guest_id', id);
    }
    return id;
  } catch {
    return '';
  }
}

/**
 * Upserts a profile row for the Clerk user and uniquely adds the guestId to guest_ids.
 * - supabase: the existing client used in the Play page
 * - clerkUserId: string like "user_xxx"
 * - guestId: the local guest id from getOrCreateLocalGuestId()
 */
export async function linkGuestToProfile(
  supabase: any,
  clerkUserId: string,
  guestId: string
) {
  if (!clerkUserId || !guestId) return;

  // Read existing guest_ids (if any)
  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('guest_ids')
    .eq('user_id', clerkUserId)
    .maybeSingle();

  if (readErr) {
    console.warn('profiles read error', readErr);
  }

  // Merge uniquely
  const merged = Array.from(new Set([...(existing?.guest_ids ?? []), guestId]));

  // Upsert by primary key (user_id)
  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert({
      user_id: clerkUserId,
      guest_ids: merged,
      updated_at: new Date().toISOString(),
    });

  if (upsertErr) {
    console.warn('profiles upsert error', upsertErr);
  }
}