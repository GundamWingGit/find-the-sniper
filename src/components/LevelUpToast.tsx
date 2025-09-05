"use client";

import { useEffect } from "react";

type Props = {
  from: number;
  to: number;
  gained?: number;
  onClose: () => void;
  durationMs?: number;
};

export default function LevelUpToast({ from, to, gained = 0, onClose, durationMs = 3000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="rounded-xl bg-emerald-600/90 text-white shadow-lg px-4 py-3 backdrop-blur">
        <div className="text-sm font-semibold">Level Up!</div>
        <div className="text-xs opacity-90">
          Lv. {from} → <span className="font-semibold">Lv. {to}</span>
          {gained ? <span> &nbsp;(+{gained} XP)</span> : null}
        </div>
      </div>
    </div>
  );
}
