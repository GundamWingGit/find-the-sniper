"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import supabase from "@/lib/supabase";
// If you created a shared href helper, import and use it:
// import { buildPlayHref } from "@/lib/routes";

type ImageRow = {
  id: string;
  public_url: string;
  title: string | null;
  description: string | null;
};

export default function Dashboard() {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Teaser crop side: 'right' or 'left'
  const TEASER_SIDE: 'right' | 'left' = 'right'; // change to 'left' if you prefer

  // --- drag-to-scroll state/refs ---
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const lastDxRef = useRef(0);
  const justDraggedAtRef = useRef(0); // timestamp to suppress immediate click
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("images")
        .select("id, public_url, title, description")
        .order("created_at", { ascending: false })
        .limit(30);
      if (!mounted) return;
      if (error) setErr(error.message);
      else setImages(data || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // --- Pointer-driven drag that works when starting on links/images ---
  const DRAG_THRESHOLD = 10; // px
  const CLICK_SUPPRESS_MS = 150; // suppress click right after a real drag

  const startDrag = (clientX: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    draggingRef.current = true;
    setDragging(true);
    startXRef.current = clientX;
    scrollStartRef.current = scroller.scrollLeft;
    lastDxRef.current = 0;

    // Attach window listeners so we keep receiving events even if pointer leaves
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

    // If the user moved far enough, mark a recent drag so click is suppressed once
    if (Math.abs(lastDxRef.current) > DRAG_THRESHOLD) {
      justDraggedAtRef.current = Date.now();
    }

    // Clean up listeners
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerUp);
  };

  // Hooked on the scroller (blank gaps) and on each card (so drag can start on the image)
  const handlePointerDownAnywhere = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // left click only
    // Do not preventDefault; we want clicks to still work if no drag occurs.
    startDrag(e.clientX);
  };

  // Cancel link nav only if a real drag happened immediately prior
  const maybeCancelClick = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - justDraggedAtRef.current < CLICK_SUPPRESS_MS) {
      e.preventDefault();
      e.stopPropagation();
      // Reset so future clicks work
      justDraggedAtRef.current = 0;
    }
  };

  return (
    <main className="mx-auto max-w-screen-md px-4 py-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Swipe/drag the teaser cards to pick a photo. Click to play.
        </p>
      </header>

      <section className="relative">
        <div
          ref={scrollerRef}
          onPointerDown={handlePointerDownAnywhere} // drag works in the gaps
          className={`flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 overscroll-x-contain ${
            dragging ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
          style={{
            scrollPadding: "0 16px",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x", // keep native horizontal panning for touch
          }}
        >
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="snap-center shrink-0 w-72 sm:w-80 rounded-2xl bg-gray-200/70 animate-pulse"
                style={{ aspectRatio: "3 / 4" }}
              />
            ))}

          {!loading && images.length === 0 && (
            <div className="text-sm text-gray-500">No images yet.</div>
          )}

          {images.map((img) => {
            const href = `/play-db/${img.id}`; // or buildPlayHref(img) if you extracted it
            return (
              <Link
                key={img.id}
                href={href}
                onPointerDown={handlePointerDownAnywhere} // drag can start on the card/image
                onClickCapture={maybeCancelClick} // suppress click only if a real drag just happened
                onDragStart={(e) => e.preventDefault()} // avoid ghost image drag
                className="snap-center shrink-0 w-72 sm:w-80 rounded-2xl relative bg-white/50 shadow"
                draggable={false}
              >
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{ aspectRatio: "3 / 4" }}
                >
                  {/* Teaser crop: clear, zoomed-in, far-right slice */}
                  <img
                    src={img.public_url}
                    alt={img.title ?? "Find the Sniper image"}
                    className="h-full w-full object-cover select-none pointer-events-none"
                    style={{
                      transform: "scale(1.8)", // adjust 1.6–2.2 to taste
                      transformOrigin: TEASER_SIDE === "right" ? "100% 50%" : "0% 50%",
                      objectPosition: TEASER_SIDE === "right" ? "100% 50%" : "0% 50%",
                    }}
                    loading="lazy"
                    draggable={false}
                  />
                  {/* Keep a subtle gradient for text readability */}
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

        {err && (
          <p className="mt-3 text-sm text-red-600">
            Error loading images: {err}
          </p>
        )}
      </section>
    </main>
  );
}