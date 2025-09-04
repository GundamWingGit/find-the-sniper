"use client";

import { useEffect, useState } from "react";

// Using the actual guest key from the project's guest system
const GUEST_KEY = "fts_guest_v1";

export function useGuestSession() {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(GUEST_KEY) : null;
      if (raw) {
        const guest = JSON.parse(raw);
        setGuestId(guest?.id || null);
      } else {
        setGuestId(null);
      }
    } catch {
      setGuestId(null);
    }
  }, []);

  return { mounted, guestId, isGuest: Boolean(guestId) };
}
