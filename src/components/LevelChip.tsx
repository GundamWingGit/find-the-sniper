"use client";

import { levelProgress } from "@/lib/levels";
import Image from "next/image";
import { useMemo } from "react";

type Props = {
  xp: number;
  name?: string | null;
  avatarUrl?: string | null;
  size?: number; // px
  snipes?: number; // NEW
};

export default function LevelChip({ xp, name, avatarUrl, size = 72, snipes }: Props) {
  const { level, currentLevelXp, nextLevelXp, progress } = useMemo(
    () => levelProgress(Number(xp || 0)),
    [xp]
  );
  const pct = Math.max(0, Math.min(1, progress));
  const deg = Math.round(pct * 360);
  const innerPad = 4; // ring thickness
  const inner = size - innerPad * 2;

  const cur = Number(xp || 0) - currentLevelXp;
  const need = nextLevelXp - currentLevelXp;

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(rgb(34 197 94) ${deg}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
        aria-label={`Level ${level} progress ${Math.round(pct * 100)}%`}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            padding: innerPad,
            WebkitMask:
              "radial-gradient(circle at center, transparent calc(50% - 9999px), black 0)",
          }}
        />
        <div
          className="absolute rounded-full overflow-hidden bg-gray-800"
          style={{
            width: inner,
            height: inner,
            left: innerPad,
            top: innerPad,
          }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Avatar"
              fill
              sizes={`${inner}px`}
              className="object-cover"
              onError={(e) => {
                // Hide the image and show fallback
                (e.currentTarget as any).style.display = "none";
              }}
              onLoadingComplete={(result) => {
                if (result.naturalWidth === 0) {
                  // Image failed to load properly
                  (result as any).style.display = "none";
                }
              }}
            />
          ) : null}
          
          {/* Fallback avatar (always present, hidden when image loads successfully) */}
          <div className="w-full h-full grid place-items-center text-xs text-white/70 bg-gray-700">
            {avatarUrl ? "?" : "No Avatar"}
          </div>
        </div>
        <span className="absolute -bottom-1 -right-1 text-[10px] rounded-full bg-black/70 px-2 py-0.5 text-white shadow">
          Lv. {level}
        </span>
      </div>

      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{name ?? "Player"}</div>
        <div className="text-xs text-white/60">
          {typeof snipes === "number" ? (
            <>snipes: {snipes}</>
          ) : (
            <>
              {cur} / {need} XP
            </>
          )}
        </div>
        <div className="mt-1 h-1.5 w-40 max-w-full rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-emerald-500"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
