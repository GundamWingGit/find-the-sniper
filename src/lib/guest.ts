// Simple per-browser identity until we add real auth
const KEY = 'fts_guest_id_v1';

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(KEY);
  if (!id) {
    // lightweight id (good enough for anon tracking)
    id = 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}
