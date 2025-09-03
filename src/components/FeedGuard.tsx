'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getGuest } from '@/lib/guest';

export default function FeedGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return; // Wait for Clerk to load

    const hasGuest = !!getGuest();
    
    // If user is not signed in with Clerk AND has no guest identity, redirect to home
    if (!isSignedIn && !hasGuest) {
      router.push('/');
      return;
    }

    setIsChecking(false);
  }, [isSignedIn, isLoaded, router]);

  // Show loading while checking authentication status
  if (isChecking || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
