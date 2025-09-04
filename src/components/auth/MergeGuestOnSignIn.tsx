"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { getGuest, signOutGuest } from "@/lib/guest";
import { linkGuestToProfile } from "@/lib/identity";
import supabase from "@/lib/supabase";

export default function MergeGuestOnSignIn() {
  const { user } = useUser();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !user) return;

    const guest = getGuest();
    if (!guest?.id) return;

    ran.current = true;

    // Use the existing linkGuestToProfile function
    linkGuestToProfile(supabase, user.id, guest.id)
      .then(() => {
        console.debug('Guest merged to profile successfully');
      })
      .catch((error) => {
        console.warn('Failed to merge guest to profile:', error);
      })
      .finally(() => {
        // Clear guest data after successful merge
        try {
          signOutGuest(); // This removes the fts_guest_v1 key
          localStorage.removeItem('fts_guest_id_v1'); // Clear legacy key too
        } catch (error) {
          console.warn('Failed to clear guest data:', error);
        }
      });
  }, [user]);

  return null;
}
