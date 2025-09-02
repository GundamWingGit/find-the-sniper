'use client';

import Link from 'next/link';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import { useState } from 'react';

export default function Header() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const links = [
    { href: '/', label: 'Home' },
    { href: '/play-db', label: 'Play' },
    { href: '/feed', label: 'Feed' },
    { href: '/upload', label: 'Upload' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ];

  return (
    <header className="sticky top-0 z-30 w-full bg-background/70 backdrop-blur border-b">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          Find the Sniper
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <Link key={l.href} href={l.href} className="text-sm opacity-80 hover:opacity-100">
              {l.label}
            </Link>
          ))}
          {isSignedIn ? <UserButton /> : <SignInButton />}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
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

      {/* Mobile overlay + panel */}
      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={close}
          />
          {/* panel */}
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            className="absolute right-4 top-14 z-50 w-56 rounded-xl border bg-background shadow-lg p-2 md:hidden"
          >
            <nav className="flex flex-col">
              {links.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-muted text-left"
                >
                  {l.label}
                </Link>
              ))}
              <div className="px-3 py-2">
                {isSignedIn ? <UserButton afterSignOutUrl="/" /> : <SignInButton />}
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}