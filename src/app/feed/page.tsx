'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import SetTargetButton from '@/components/SetTargetButton';
import FeedGuard from '@/components/FeedGuard';
import DashboardFab from '@/components/DashboardFab';
import { useUser } from '@clerk/nextjs';

type FeedImage = { 
  id: string; 
  title?: string | null; 
  public_url?: string | null; 
  url?: string | null; 
  thumb_url?: string | null; 
  created_at?: string;
  location?: string | null;
};



type SortMode = 'new' | 'mostLiked' | 'hot';

const shortId = (id: string) => id.length > 12 ? id.slice(0, 8) + '…' : id;
const label = (img: FeedImage) => img.title?.trim() || shortId(img.id);

function hoursSince(ts?: string | null) {
  if (!ts) return 0;
  const ms = Date.now() - new Date(ts).getTime();
  return Math.max(0, ms / 36e5); // ms -> hours
}

// Decay formula: higher = hotter. Tunable exponents if needed
function hotScore(likes: number, createdAt?: string | null) {
  const h = hoursSince(createdAt);
  return (likes + 1) / Math.pow(h + 2, 1.5);
}

function resolveImageSrc(img: any): string | undefined {
  // preferred explicit thumb first
  if (img?.thumb_url) return String(img.thumb_url);
  // legacy fields you might have:
  if (img?.url) return String(img.url);
  if (img?.public_url) return String(img.public_url);
  // common storage path fallbacks (adjust bucket name if needed)
  const path = img?.path ?? img?.storage_path ?? img?.file_path;
  if (path && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${path}`;
  }
  return undefined;
}

export default function FeedPage() {
  const { user } = useUser();
  const [sort, setSort] = useState<SortMode>('new');
  const [images, setImages] = useState<FeedImage[]>([]);
  const [likeMap, setLikeMap] = useState<Map<string, number>>(new Map());
  const [withTarget, setWithTarget] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  
  // Interactive likes state
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  
  // Search UI
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  async function loadFeed(mode: SortMode) {
    setLoading(true);
    try {
      // Helper: try multiple ordering columns, return first success
      async function loadRecentImages(limit = 60) {
        const cols = [
          { col: 'created_at', desc: true },
          { col: 'updated_at', desc: true },
          { col: 'id',        desc: true },
        ];
        for (const opt of cols) {
          const { data, error } = await supabase
            .from('images')
            .select('*')
            .order(opt.col, { ascending: !opt.desc })
            .limit(limit);
          if (error) {
            console.warn('feed recent query error', opt.col, error.message);
            continue;
          }
          if (data && data.length) {
            console.debug('feed recent ok via', opt.col, 'rows', data.length);
            return data;
          }
        }
        // final fallback without order (should still return rows)
        const { data, error } = await supabase
          .from('images')
          .select('*')
          .limit(60);
        if (error) console.error('feed final fallback error', error.message);
        console.debug('feed final fallback rows', data?.length ?? 0);
        return data ?? [];
      }

      if (mode === 'hot') {
        // Strategy: fetch recent images (e.g., last 300) and their like counts,
        // compute hotScore in JS, sort, and slice to 60.
        // Use resilient recent loader already in the file (loadRecentImages).

        // Load more for ranking fairness
        const imgs = await loadRecentImages(300);

        const ids = imgs.map(i => i.id);
        let map = new Map<string, number>();
        if (ids.length) {
          const { data: counts, error: cErr } = await supabase
            .from('image_like_counts')
            .select('image_id, likes')
            .in('image_id', ids);
          if (cErr) console.warn('feed hot like counts error', cErr.message);
          map = new Map((counts ?? []).map(c => [String(c.image_id), Number(c.likes)]));
        }

        // Compute heat and order
        const ranked = imgs
          .map(i => ({ img: i, likes: map.get(i.id) ?? 0, heat: hotScore(map.get(i.id) ?? 0, i.created_at) }))
          .sort((a, b) => b.heat - a.heat)
          .slice(0, 60)
          .map(r => r.img);

        // Fetch targets
        let targetSet = new Set<string>();
        if (ids.length) {
          const { data: tgs, error: tErr } = await supabase
            .from('targets')
            .select('image_id')
            .in('image_id', ids);
          if (tErr) console.warn('feed targets error', tErr.message);
          targetSet = new Set<string>((tgs ?? []).map(t => String(t.image_id)));
        }

        setImages(ranked);
        setLikeMap(map);
        setWithTarget(targetSet);
        console.debug('feed hot done', { pool: imgs.length, shown: ranked.length });
        return;
      }

      if (mode === 'new') {
        const imgs = await loadRecentImages(60);

        // build like counts map
        const ids = imgs.map(i => i.id);
        let map = new Map<string, number>();
        if (ids.length) {
          const { data: counts, error: cErr } = await supabase
            .from('image_like_counts')
            .select('image_id, likes')
            .in('image_id', ids);
          if (cErr) console.warn('feed like counts error', cErr.message);
          map = new Map((counts ?? []).map(c => [String(c.image_id), Number(c.likes)]));
        }

        // Fetch targets
        let targetSet = new Set<string>();
        if (ids.length) {
          const { data: tgs, error: tErr } = await supabase
            .from('targets')
            .select('image_id')
            .in('image_id', ids);
          if (tErr) console.warn('feed targets error', tErr.message);
          targetSet = new Set<string>((tgs ?? []).map(t => String(t.image_id)));
        }

        setImages(imgs);
        setLikeMap(map);
        setWithTarget(targetSet);
        console.debug('feed new done', { imgs: imgs.length, likes: map.size });
        return;
      }

      // mode === 'mostLiked'
      const { data: counts, error: cErr } = await supabase
        .from('image_like_counts')
        .select('image_id, likes')
        .order('likes', { ascending: false })
        .limit(60);

      if (cErr) {
        console.warn('feed mostLiked counts error', cErr.message);
      }

      if (!counts || counts.length === 0) {
        console.debug('feed mostLiked empty, fallback to recent');
        const imgs = await loadRecentImages(60);
        const ids = imgs.map(i => i.id);
        let map = new Map<string, number>();
        if (ids.length) {
          const { data: c2 } = await supabase
            .from('image_like_counts')
            .select('image_id, likes')
            .in('image_id', ids);
          map = new Map((c2 ?? []).map(c => [String(c.image_id), Number(c.likes)]));
        }
        
        // Fetch targets
        let targetSet = new Set<string>();
        if (ids.length) {
          const { data: tgs } = await supabase
            .from('targets')
            .select('image_id')
            .in('image_id', ids);
          targetSet = new Set<string>((tgs ?? []).map(t => String(t.image_id)));
        }
        
        setImages(imgs);
        setLikeMap(map);
        setWithTarget(targetSet);
        return;
      }

      const ids = counts.map(c => c.image_id);
      const { data: imgs, error: iErr } = await supabase
        .from('images')
        .select('*')
        .in('id', ids);
      if (iErr) {
        console.error('feed mostLiked images error', iErr.message);
        setImages([]);
        setLikeMap(new Map());
        return;
      }

      // preserve like order
      const byId = new Map((imgs ?? []).map(i => [i.id, i]));
      const ordered = counts.map(c => byId.get(c.image_id)).filter(Boolean) as FeedImage[];

      // Fetch targets
      let targetSet = new Set<string>();
      if (ids.length) {
        const { data: tgs } = await supabase
          .from('targets')
          .select('image_id')
          .in('image_id', ids);
        targetSet = new Set<string>((tgs ?? []).map(t => String(t.image_id)));
      }

      setImages(ordered);
      setLikeMap(new Map(counts.map(c => [String(c.image_id), Number(c.likes)])));
      setWithTarget(targetSet);
      console.debug('feed mostLiked done', { rows: ordered.length });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFeed(sort); }, [sort]);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Run search RPC when debounced query changes
  useEffect(() => {
    let active = true;
    (async () => {
      setSearchError(null);

      // Empty query => clear results and stop (show normal feed)
      if (!qDebounced) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      const { data, error } = await supabase.rpc("search_images", {
        p_query: qDebounced,
        p_limit: 24,
        p_offset: 0,
      });

      if (!active) return;
      if (error) {
        setSearchError(error.message);
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
      }
      setSearchLoading(false);
    })();
    return () => { active = false; };
  }, [qDebounced]);

  // Pick which list to render (search vs normal feed)
  const displayedImages = qDebounced ? searchResults : images;

  // Fetch individual likes for interactive hearts
  useEffect(() => {
    (async () => {
      const list = displayedImages || [];
      if (!list.length) {
        setLikesCount({});
        setLikedByMe({});
        return;
      }
      const ids = list.map((i: any) => i.id);

      const { data, error } = await supabase
        .from("image_likes")
        .select("image_id, guest_id")
        .in("image_id", ids);

      if (error) {
        console.warn("Feed likes load failed:", error.message);
        return;
      }

      const counts: Record<string, number> = {};
      const mine: Record<string, boolean> = {};
      for (const row of data || []) {
        counts[row.image_id] = (counts[row.image_id] || 0) + 1;
        if (user?.id && row.guest_id === user.id) {
          mine[row.image_id] = true;
        }
      }
      setLikesCount(counts);
      setLikedByMe(mine);
    })();
  }, [displayedImages, user?.id]);

  // Realtime likes updates
  useEffect(() => {
    if (!displayedImages?.length) return;
    const imageIds = new Set(displayedImages.map((i: any) => i.id));

    const ch = supabase
      .channel("feed-likes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "image_likes" },
        (payload) => {
          const row = (payload.new || payload.old) as { image_id: string; guest_id: string };
          if (!row?.image_id || !imageIds.has(row.image_id)) return;

          setLikesCount((c) => {
            const next = { ...c };
            if (payload.eventType === "INSERT") next[row.image_id] = (next[row.image_id] || 0) + 1;
            if (payload.eventType === "DELETE") next[row.image_id] = Math.max(0, (next[row.image_id] || 0) - 1);
            return next;
          });

          if (user?.id && row.guest_id === user.id) {
            setLikedByMe((m) => {
              const next = { ...m };
              if (payload.eventType === "INSERT") next[row.image_id] = true;
              if (payload.eventType === "DELETE") next[row.image_id] = false;
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [displayedImages, user?.id]);

  async function toggleLike(imageId: string) {
    if (!user?.id) {
      console.log("Sign in to like images");
      return;
    }
    const meLiked = !!likedByMe[imageId];

    // optimistic
    setLikedByMe((m) => ({ ...m, [imageId]: !meLiked }));
    setLikesCount((c) => ({ ...c, [imageId]: Math.max(0, (c[imageId] || 0) + (meLiked ? -1 : 1)) }));

    if (meLiked) {
      const { error } = await supabase
        .from("image_likes")
        .delete()
        .match({ image_id: imageId, guest_id: user.id });

      if (error) {
        // rollback
        setLikedByMe((m) => ({ ...m, [imageId]: true }));
        setLikesCount((c) => ({ ...c, [imageId]: (c[imageId] || 0) + 1 }));
        console.error("Unlike failed:", error.message);
      }
    } else {
      const { error } = await supabase
        .from("image_likes")
        .insert({ image_id: imageId, guest_id: user.id });

      if (error) {
        // rollback
        setLikedByMe((m) => ({ ...m, [imageId]: false }));
        setLikesCount((c) => ({ ...c, [imageId]: Math.max(0, (c[imageId] || 0) - 1) }));
        console.error("Like failed:", error.message);
      }
    }
  }

  return (
    <FeedGuard>
      <div className="relative min-h-[80vh] py-8">
        {/* Gradient Background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="mx-auto h-[900px] w-[1200px] max-w-full blur-3xl opacity-70"
               style={{
                 background: "radial-gradient(60% 60% at 50% 30%, rgba(37,99,235,0.40), rgba(147,51,234,0.30), rgba(249,115,22,0.25) 80%)"
               }}
          />
        </div>

      <div className="max-w-5xl mx-auto">
        <h1 className="text-white text-3xl md:text-4xl font-semibold mb-6">Community Feed</h1>

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative max-w-2xl mx-auto">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search images…"
              className="w-full rounded-full bg-white/10 backdrop-blur px-12 py-3 text-white placeholder-white/60 outline-none border border-white/20 focus:border-white/40 focus:bg-white/15 transition-all"
              aria-label="Search images"
            />
            {/* magnifier icon */}
            <svg 
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {/* clear button */}
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Clear search"
                title="Clear search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status line */}
          {qDebounced && (
            <div className="mt-3 text-center text-sm text-white/70">
              {searchLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70"></div>
                  Searching…
                </div>
              ) : searchError ? (
                <div className="text-red-400">Error: {searchError}</div>
              ) : (
                <div>
                  {displayedImages?.length ?? 0} result{(displayedImages?.length ?? 0) !== 1 ? 's' : ''} for <span className="text-white/90 font-medium">"{qDebounced}"</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sort control - hide when searching */}
        {!qDebounced && (
          <div className="mb-6">
            <div className="mt-2 inline-flex items-center rounded-full bg-white/10 p-1 backdrop-blur">
              {[
                { key: "new", label: "Most Recent" },
                { key: "mostLiked", label: "Most Liked" },
                { key: "hot", label: "Hot" },
              ].map(opt => {
                const active = sort === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setSort(opt.key as typeof sort)}
                    className={
                      "px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-[0.95rem] rounded-full transition " +
                      (active
                        ? "bg-white text-black shadow"
                        : "text-white/80 hover:text-white hover:bg-white/20")
                    }
                    type="button"
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(loading || searchLoading) && (
          <div className="text-white/60">
            {qDebounced ? "Searching…" : "Loading images…"}
          </div>
        )}

        {!loading && !searchLoading && displayedImages.length === 0 && (
          <div className="text-white/60">
            {qDebounced ? `No results found for "${qDebounced}"` : 
             <>No images yet. <Link href="/upload" className="text-blue-400 underline hover:text-blue-300 transition">Upload one</Link> to get started.</>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(displayedImages || []).map((img: any) => {
            const playable = withTarget.has(img.id);
            const likes = likeMap.get(img.id) ?? 0;
            const src = resolveImageSrc(img);
            return (
              <div key={img.id} className="rounded-2xl bg-black/70 shadow-xl p-4 relative overflow-hidden" style={{backgroundImage: 'radial-gradient(circle at top left, rgba(29,78,216,0.4), rgba(147,51,234,0.3), rgba(249,115,22,0.2))'}}>
                <div className="relative z-10">
                <div className="aspect-[4/3] bg-black/20 flex items-center justify-center relative overflow-hidden rounded-lg">
                  {playable ? (
                    <Link
                      href={`/play-db/${img.id}`}
                      className="w-full h-full block cursor-pointer"
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={img.title ?? ''}
                          className="w-full h-full object-cover select-none"
                          loading="lazy"
                          style={{ objectPosition: "left center", transform: "scale(1.35)" }}
                        />
                      ) : (
                        <div className="h-full w-full bg-white/10 flex items-center justify-center text-white/50 text-xs">
                          No preview
                        </div>
                      )}
                    </Link>
                  ) : (
                    <>
                      {src ? (
                        <img
                          src={src}
                          alt={img.title ?? ''}
                          className="w-full h-full object-cover select-none opacity-50 cursor-not-allowed"
                          loading="lazy"
                          style={{ objectPosition: "left center", transform: "scale(1.35)" }}
                        />
                      ) : (
                        <div className="h-full w-full bg-white/10 flex items-center justify-center text-white/50 text-xs opacity-50">
                          No preview
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Interactive like button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault(); // don't trigger the card/Play navigation
                    e.stopPropagation();
                    toggleLike(img.id);
                  }}
                  className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 hover:bg-black/70 px-2.5 py-1 text-xs text-white backdrop-blur-sm transition"
                  title={likedByMe[img.id] ? "Unlike" : "Like"}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill={likedByMe[img.id] ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 21s-6.716-4.571-9.333-7.187C.05 11.197.202 7.86 2.343 5.719A4.5 4.5 0 0 1 8.1 5.9L12 9.8l3.9-3.9a4.5 4.5 0 0 1 5.757-.18c2.141 2.141 2.293 5.478-.324 8.094C18.716 16.429 12 21 12 21z" />
                  </svg>
                  <span>{likesCount[img.id] ?? likes}</span>
                </button>

                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-white">{label(img)}</div>
                    {img.location?.trim() && (
                      <div className="text-sm text-gray-300 mt-1">{img.location.trim()}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/play-db/${img.id}`}
                      className={playable ? 
                        "inline-flex items-center justify-center rounded-full px-3 md:px-4 py-1.5 md:py-2 text-sm font-medium bg-white/10 text-white/90 hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 transition shadow-sm hover:shadow backdrop-blur" :
                        "inline-flex items-center justify-center rounded-full px-3 md:px-4 py-1.5 md:py-2 text-sm font-medium bg-gray-600 cursor-not-allowed opacity-50 text-white"
                      }
                      aria-disabled={!playable}
                      onClick={(e) => { if (!playable) e.preventDefault(); }}
                    >
                      Play
                    </Link>
                    <SetTargetButton imageId={img.id} />
                  </div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    <DashboardFab label="Dashboard" href="/dashboard" />
    </FeedGuard>
  );
}