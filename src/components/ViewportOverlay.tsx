"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

export default function ViewportOverlay({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Lock background scroll while overlay is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
