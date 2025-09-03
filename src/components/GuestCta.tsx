'use client';

import { useState } from 'react';
import GuestNameModal from '@/components/GuestNameModal';

type Props = { className?: string; children?: React.ReactNode };

export default function GuestCta({ className = '', children = 'Continue as guest' }: Props) {
  const [guestOpen, setGuestOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setGuestOpen(true)}
        className={className}
      >
        {children}
      </button>
      
      <GuestNameModal
        open={guestOpen}
        onClose={() => setGuestOpen(false)}
        onRegistered={() => {
          // Optional: soft toast or refresh
        }}
      />
    </>
  );
}
