'use client';

import Link from 'next/link';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = () => setOpen(false);

  const links = [
    { href: '/', label: 'Home' },
    { href: '/play-db', label: 'Play' },
    { href: '/feed', label: 'Feed' },
    { href: '/upload', label: 'Upload' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ];

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 backdrop-blur px-3 md:px-4 py-2 shadow-[0_0_40px_rgba(99,102,241,0.20)]">
          <div className="font-semibold tracking-tight text-white">Find the Sniper</div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => {
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
            <div className="ml-2">
              {isSignedIn ? <UserButton /> : <SignInButton />}
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
              {links.map(l => {
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