'use client';

// Legacy guest ID function (keep for backward compatibility)
const OLD_KEY = 'fts_guest_id_v1';

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(OLD_KEY);
  if (!id) {
    // lightweight id (good enough for anon tracking)
    id = 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(OLD_KEY, id);
  }
  return id;
}

// New guest identity system
export type GuestIdentity = {
  id: string;          // guest_id UUID
  name: string;        // display name
  createdAt: string;   // ISO
};

const KEY = 'fts_guest_v1';

export function getGuest(): GuestIdentity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GuestIdentity;
    if (!g?.id || !g?.name) return null;
    return g;
  } catch {
    return null;
  }
}

export function saveGuest(name: string): GuestIdentity {
  const id = crypto.randomUUID();
  const g: GuestIdentity = { id, name: name.trim(), createdAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(g));
  return g;
}

export function updateGuestName(name: string) {
  const g = getGuest();
  if (!g) return saveGuest(name);
  const updated = { ...g, name: name.trim() };
  localStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}

export function signOutGuest(): void {
  localStorage.removeItem(KEY);
  // Dispatch storage event to notify other components
  window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
}
