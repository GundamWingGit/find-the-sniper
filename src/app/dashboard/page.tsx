"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { useUser } from "@clerk/nextjs";
import LevelChip from "@/components/LevelChip";
import LevelUpToast from "@/components/LevelUpToast";
import { levelForXp } from "@/lib/levels";

type ImageRow = {
  id: string;
  public_url: string;
  title: string | null;
  description: string | null;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  streak: number;
};

export default function Dashboard() {
  const { user } = useUser();
  const router = useRouter();
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [pLoading, setPLoading] = useState(true);

  // Level-up toast state
  const [toast, setToast] = useState<{ from: number; to: number; gained: number } | null>(null);

  const currentLevel = useMemo(() => levelForXp(Number(profile?.xp || 0)), [profile?.xp]);

  // Teaser crop side: 'right' or 'left'
  const TEASER_SIDE: 'right' | 'left' = 'right';

  // --- drag-to-scroll state/refs ---
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const lastDxRef = useRef(0);
  const justDraggedAtRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  // Load latest images (unchanged)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("images")
        .select("id, public_url, title, description")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) setErr(error.message);
      else setImages(data || []);
      setLoading(false);
    })();
  }, []);

  // Initial profile fetch
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) {
        setProfile(null);
        setPLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, xp, streak")
        .eq("user_id", user.id)
        .single();

      if (!active) return;
      if (error) {
        console.warn("Profile load failed:", error.message);
        setProfile(null);
      } else {
        setProfile(data as ProfileRow);
      }
      setPLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Realtime: listen for profile updates for this user and update state + toast on level-up
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-level-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newRow = payload.new as ProfileRow;
          setProfile((prev) => {
            const prevXp = Number(prev?.xp ?? 0);
            const newXp = Number(newRow.xp ?? 0);

            const prevLevel = levelForXp(prevXp);
            const nextLevel = levelForXp(newXp);

            if (nextLevel > prevLevel) {
              setToast({ from: prevLevel, to: nextLevel, gained: newXp - prevXp });
            }
            return { ...newRow };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // --- Pointer-driven drag that works when starting on links/images ---
  const DRAG_THRESHOLD = 10;
  const CLICK_SUPPRESS_MS = 150;

  const startDrag = (clientX: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    draggingRef.current = true;
    setDragging(true);
    startXRef.current = clientX;
    scrollStartRef.current = scroller.scrollLeft;
    lastDxRef.current = 0;

    window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
    window.addEventListener("pointerup", onWindowPointerUp, { passive: true });
    window.addEventListener("pointercancel", onWindowPointerUp, { passive: true });
  };

  const onWindowPointerMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const dx = e.clientX - startXRef.current;
    lastDxRef.current = dx;
    scroller.scrollLeft = scrollStartRef.current - dx;
  };

  const onWindowPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);

    if (Math.abs(lastDxRef.current) > DRAG_THRESHOLD) {
      justDraggedAtRef.current = Date.now();
    }

    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerUp);
  };

  const handlePointerDownAnywhere = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    startDrag(e.clientX);
  };

  const maybeCancelClick = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - justDraggedAtRef.current < CLICK_SUPPRESS_MS) {
      e.preventDefault();
      e.stopPropagation();
      justDraggedAtRef.current = 0;
    }
  };

  function goToPlay(img: ImageRow) {
    // Using the same href as the carousel cards
    router.push(`/play-db/${img.id}`);
  }

  function handlePlayRandom() {
    if (!images || images.length === 0) return;
    const idx = Math.floor(Math.random() * images.length);
    const img = images[idx];
    if (img) goToPlay(img);
  }

  return (
    <main className="mx-auto max-w-screen-md px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400">
            Swipe/drag the teaser cards to pick a photo. Click to play.
          </p>
        </div>

        {/* Level chip */}
        {!pLoading && profile ? (
          <LevelChip
            xp={Number(profile.xp || 0)}
            name={profile.display_name ?? user?.fullName ?? "Player"}
            avatarUrl={profile.avatar_url ?? user?.imageUrl ?? undefined}
            size={72}
          />
        ) : !pLoading ? (
          <div className="text-xs text-gray-400">Sign in to track your level</div>
        ) : null}
      </header>

      {/* Carousel with drag-to-scroll */}
      <section className="relative">
        <div
          ref={scrollerRef}
          onPointerDown={handlePointerDownAnywhere}
          className={`flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 overscroll-x-contain ${
            dragging ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
          style={{
            scrollPadding: "0 16px",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
          }}
        >
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="snap-center shrink-0 w-72 sm:w-80 rounded-2xl bg-gray-200/20 animate-pulse"
                style={{ aspectRatio: "3 / 4" }}
              />
            ))}

          {!loading && images.length === 0 && (
            <div className="text-sm text-gray-400">No images yet.</div>
          )}

          {images.map((img) => {
            const href = `/play-db/${img.id}`;
            return (
              <Link
                key={img.id}
                href={href}
                onPointerDown={handlePointerDownAnywhere}
                onClickCapture={maybeCancelClick}
                onDragStart={(e) => e.preventDefault()}
                className="snap-center shrink-0 w-72 sm:w-80 rounded-2xl relative bg-white/50 shadow"
                draggable={false}
              >
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{ aspectRatio: "3 / 4" }}
                >
                  <img
                    src={img.public_url}
                    alt={img.title ?? "Find the Sniper image"}
                    className="h-full w-full object-cover select-none pointer-events-none"
                    style={{
                      transform: "scale(1.8)",
                      transformOrigin: TEASER_SIDE === "right" ? "100% 50%" : "0% 50%",
                      objectPosition: TEASER_SIDE === "right" ? "100% 50%" : "0% 50%",
                    }}
                    loading="lazy"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white drop-shadow">
                    <div className="text-sm font-medium truncate">
                      {img.title || "Untitled"}
                    </div>
                    <div className="text-xs opacity-90">Click to play</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {err && <p className="mt-3 text-sm text-red-400">Error loading images: {err}</p>}

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          <Link
            href="/feed"
            className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 px-4 py-2 text-sm font-medium text-white shadow-sm transition"
          >
            Feed
          </Link>

          <button
            type="button"
            onClick={handlePlayRandom}
            disabled={loading || images.length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
            aria-disabled={loading || images.length === 0}
            title={loading ? "Loading images..." : images.length === 0 ? "No images yet" : "Play a random image"}
          >
            Randomizer
          </button>

          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 px-4 py-2 text-sm font-medium text-white shadow-sm transition"
          >
            Upload
          </Link>

          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 px-4 py-2 text-sm font-medium text-white shadow-sm transition"
          >
            Leaderboard
          </Link>
        </div>
      </section>

      {/* Level up toast */}
      {toast ? (
        <LevelUpToast
          from={toast.from}
          to={toast.to}
          gained={toast.gained}
          onClose={() => setToast(null)}
        />
      ) : null}
    </main>
  );
}