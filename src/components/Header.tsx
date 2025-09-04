'use client';

import Link from 'next/link';
import { 
  UserButton, 
  SignedIn, 
  SignedOut, 
  useClerk
} from '@clerk/nextjs';
import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import GuestNameModal from '@/components/GuestNameModal';
import { getGuest, signOutGuest } from '@/lib/guest';
import { useGuestSession } from '@/hooks/useGuestSession';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const [hasGuest, setHasGuest] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const pathname = usePathname();
  
  const { mounted, isGuest } = useGuestSession();
  const { openSignIn, openSignUp, signOut } = useClerk();

  useEffect(() => {
    const guest = getGuest();
    setHasGuest(!!guest);
    setGuestName(guest?.name || null);
    
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'fts_guest_v1') {
        const updatedGuest = getGuest();
        setHasGuest(!!updatedGuest);
        setGuestName(updatedGuest?.name || null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const canViewFeed = hasGuest; // For signed-in users, SignedIn component handles this

  const close = () => setOpen(false);

  const handleGuestSignOut = () => {
    signOutGuest();
    setGuestDropdownOpen(false);
    // State will be updated automatically by the storage event listener
  };

  const rawLinks = [
    { href: '/', label: 'Home' },
    { href: '/play-db', label: 'Play' },
    ...(canViewFeed ? [{ href: '/feed', label: 'Feed' }] : []),
    { href: '/upload', label: 'Upload' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ];

  // De-duplicate by href to prevent duplicate React keys
  const allLinks = useMemo(() => {
    const seen = new Set<string>();
    const unique: typeof rawLinks = [];
    for (const link of rawLinks) {
      if (seen.has(link.href)) continue;
      seen.add(link.href);
      unique.push(link);
    }
    return unique;
  }, [rawLinks]);

  // For signed-in users, always include feed
  const signedInLinks = useMemo(() => {
    const seen = new Set<string>();
    const unique: typeof rawLinks = [];
    const withFeed = [
      { href: '/', label: 'Home' },
      { href: '/play-db', label: 'Play' },
      { href: '/feed', label: 'Feed' },
      { href: '/upload', label: 'Upload' },
      { href: '/leaderboard', label: 'Leaderboard' },
    ];
    for (const link of withFeed) {
      if (seen.has(link.href)) continue;
      seen.add(link.href);
      unique.push(link);
    }
    return unique;
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 backdrop-blur px-3 md:px-4 py-2 shadow-[0_0_40px_rgba(99,102,241,0.20)]">
          <div className="font-semibold tracking-tight text-white">Find the Sniper</div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <SignedIn>
              {signedInLinks.map((link) => {
                const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      "px-3 py-1.5 rounded-full text-sm transition " +
                      (active
                        ? "bg-white text-black shadow"
                        : "text-white/80 hover:text-white hover:bg-white/10")
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </SignedIn>
            
            <SignedOut>
              {allLinks.map((link) => {
                const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      "px-3 py-1.5 rounded-full text-sm transition " +
                      (active
                        ? "bg-white text-black shadow"
                        : "text-white/80 hover:text-white hover:bg-white/10")
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </SignedOut>

            <div className="ml-2">
              <SignedIn>
                <div className="flex items-center gap-2">
                  <UserButton />
                  <button 
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/20 hover:text-white transition backdrop-blur"
                    onClick={() => signOut({ redirectUrl: "/" })}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              </SignedIn>

              <SignedOut>
                <div className="flex items-center gap-2">
                  {hasGuest && guestName && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setGuestDropdownOpen(!guestDropdownOpen)}
                        className="rounded-full bg-green-500/20 text-green-300 px-3 py-1.5 text-sm font-medium border border-green-400/30 hover:bg-green-500/30 transition"
                      >
                        Guest: {guestName} ▼
                      </button>
                      
                      {guestDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setGuestDropdownOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-white/20 bg-black/80 backdrop-blur shadow-xl p-2">
                            <button
                              type="button"
                              onClick={handleGuestSignOut}
                              className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/10 transition"
                            >
                              Sign out
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {mounted && isGuest ? (
                    <button 
                      className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/20 hover:text-white transition backdrop-blur"
                      onClick={() => openSignUp({ 
                        afterSignUpUrl: "/welcome", 
                        signInUrl: "/sign-in" 
                      })}
                      type="button"
                    >
                      Create account
                    </button>
                  ) : (
                    <button 
                      className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/20 hover:text-white transition backdrop-blur"
                      onClick={() => openSignIn({ 
                        afterSignInUrl: "/welcome", 
                        signUpUrl: "/sign-up" 
                      })}
                      type="button"
                    >
                      Sign in
                    </button>
                  )}
                  
                  {!hasGuest && (
                    <button
                      type="button"
                      onClick={() => setGuestOpen(true)}
                      className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/20 hover:text-white transition backdrop-blur"
                    >
                      Continue as guest
                    </button>
                  )}
                </div>
              </SignedOut>
            </div>
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 hover:bg-white/10 text-white"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {/* simple hamburger icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile overlay + panel */}
      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={close}
          />
          {/* panel */}
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            className="absolute right-4 top-16 z-50 w-56 rounded-2xl border border-white/20 bg-black/80 backdrop-blur shadow-xl p-2 md:hidden"
          >
            <nav className="flex flex-col">
              <SignedIn>
                {signedInLinks.map(l => {
                  const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={close}
                      className={
                        "rounded-full px-3 py-2 text-sm text-left transition " +
                        (active
                          ? "bg-white text-black shadow"
                          : "text-white/80 hover:text-white hover:bg-white/10")
                      }
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </SignedIn>
              
              <SignedOut>
                {allLinks.map(l => {
                  const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={close}
                      className={
                        "rounded-full px-3 py-2 text-sm text-left transition " +
                        (active
                          ? "bg-white text-black shadow"
                          : "text-white/80 hover:text-white hover:bg-white/10")
                      }
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </SignedOut>
              
              <div className="px-3 py-2 space-y-2">
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                  <button 
                    className="w-full rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/20 hover:text-white transition backdrop-blur"
                    onClick={() => signOut({ redirectUrl: "/" })}
                    type="button"
                  >
                    Sign out
                  </button>
                </SignedIn>

                <SignedOut>
                  {hasGuest && guestName && (
                    <>
                      <div className="w-full rounded-full bg-green-500/20 text-green-300 px-4 py-2 text-sm font-medium border border-green-400/30 text-center">
                        Guest: {guestName}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleGuestSignOut();
                          setOpen(false);
                        }}
                        className="w-full rounded-full bg-red-500/20 text-red-300 px-4 py-2 text-sm font-medium border border-red-400/30 hover:bg-red-500/30 hover:text-red-200 transition"
                      >
                        Sign out
                      </button>
                    </>
                  )}
                  
                  {mounted && isGuest ? (
                    <button
                      onClick={() => {
                        openSignUp({ 
                          afterSignUpUrl: "/welcome", 
                          signInUrl: "/sign-in" 
                        });
                        setOpen(false);
                      }}
                      className="w-full rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/20 hover:text-white transition backdrop-blur"
                      type="button"
                    >
                      Create account
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        openSignIn({ 
                          afterSignInUrl: "/welcome", 
                          signUpUrl: "/sign-up" 
                        });
                        setOpen(false);
                      }}
                      className="w-full rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/20 hover:text-white transition backdrop-blur"
                      type="button"
                    >
                      Sign in
                    </button>
                  )}
                  
                  {!hasGuest && (
                    <button
                      type="button"
                      onClick={() => {
                        setGuestOpen(true);
                        setOpen(false);
                      }}
                      className="w-full rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/20 hover:text-white transition backdrop-blur"
                    >
                      Continue as guest
                    </button>
                  )}
                </SignedOut>
              </div>
            </nav>
          </div>
        </>
      )}
      
      <GuestNameModal
        open={guestOpen}
        onClose={() => setGuestOpen(false)}
        onRegistered={(guest) => {
          setHasGuest(true);
          setGuestName(guest.name);
        }}
      />
    </header>
  );
}