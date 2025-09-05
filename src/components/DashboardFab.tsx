"use client";

import Link from "next/link";
import { useMemo } from "react";

type Props = {
  href?: string;    // default: /dashboard
  label?: string;   // default: "Dashboard"
};

export default function DashboardFab({ href = "/dashboard", label = "Dashboard" }: Props) {
  // conservative z-index to float above content but below modals
  const style = useMemo(
    () => ({
      right: "calc(env(safe-area-inset-right, 0px) + 16px)",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
    }),
    []
  );

  return (
    <div className="fixed z-40" style={style}>
      <Link
        href={href}
        aria-label={label}
        title={label}
        className="group inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-white shadow-lg
                   hover:bg-emerald-500 active:scale-[0.98] transition
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
      >
        {/* Simple glyph */}
        <span className="inline-block h-2 w-2 rounded-full bg-white/90" aria-hidden="true" />
        <span className="text-sm font-semibold">{label}</span>
      </Link>
    </div>
  );
}
