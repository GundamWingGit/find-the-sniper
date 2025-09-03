'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { saveGuest } from '@/lib/guest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function GuestNameModal({
  open,
  onClose,
  onRegistered, // (guest) => void
}: {
  open: boolean;
  onClose: () => void;
  onRegistered?: (g: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  if (!open) return null;

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const n = name.trim().slice(0, 40);
    if (!n) return;
    setSubmitting(true);

    try {
      // 1) Save locally (authoritative for guest identity)
      const g = saveGuest(n);

      // 2) Try to upsert in public.player_name (ignore conflict)
      try {
        const { error } = await supabase
          .from('player_name')
          .insert([{ guest_id: g.id, name: g.name }]);
        // ignore duplicate key etc
      } catch {}

      // 3) Notify UI
      onRegistered?.(g);

      // 4) Force other tabs/components to notice new guest
      window.dispatchEvent(new StorageEvent('storage', { key: 'fts_guest_v1' }));

      // 5) Close + refresh + redirect to welcome
      onClose();
      router.refresh();
      router.push('/welcome');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleContinue}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-black/70 p-6 shadow-xl"
      >
        <h2 className="mb-2 text-xl font-semibold text-white">Continue as Guest</h2>
        <p className="mb-4 text-sm text-white/70">Enter a name to show on leaderboards & scores.</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Alex Rivera"
          maxLength={40}
          disabled={submitting}
          className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white placeholder:text-white/40 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-full bg-white/10 px-4 py-2 font-semibold text-white/90 hover:bg-white/20 hover:text-white transition disabled:opacity-50"
          >
            {submitting ? 'Continuing…' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full bg-white/5 px-4 py-2 font-semibold text-white/70 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
