'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import SetTargetButton from '@/components/SetTargetButton';
import FeedGuard from '@/components/FeedGuard';

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
  const [sort, setSort] = useState<SortMode>('new');
  const [images, setImages] = useState<FeedImage[]>([]);
  const [likeMap, setLikeMap] = useState<Map<string, number>>(new Map());
  const [withTarget, setWithTarget] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

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

        {/* Sort control */}
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

        {loading && (
          <div className="text-white/60">Loading images…</div>
        )}

        {!loading && images.length === 0 && (
          <div className="text-white/60">No images yet. <Link href="/upload" className="text-blue-400 underline hover:text-blue-300 transition">Upload one</Link> to get started.</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map(img => {
            const playable = withTarget.has(img.id);
            const likes = likeMap.get(img.id) ?? 0;
            const src = resolveImageSrc(img);
            return (
              <div key={img.id} className="rounded-2xl bg-black/70 shadow-xl p-4 relative overflow-hidden" style={{backgroundImage: 'radial-gradient(circle at top left, rgba(29,78,216,0.4), rgba(147,51,234,0.3), rgba(249,115,22,0.2))'}}>
                <div className="relative z-10">
                <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center relative overflow-hidden rounded-lg">
                  {playable ? (
                    <Link
                      href={`/play-db/${img.id}`}
                      className="w-full h-full block cursor-pointer"
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={img.title ?? ''}
                          className="w-full h-full object-cover blur-sm hover:blur-none transition-all duration-200"
                          loading="lazy"
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
                          className="w-full h-full object-cover blur-sm opacity-50 cursor-not-allowed"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-white/10 flex items-center justify-center text-white/50 text-xs opacity-50">
                          No preview
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* like badge (non-interactive) */}
                <div className="absolute bottom-2 right-2 rounded-full bg-black/60 text-white text-xs px-2 py-1 flex items-center gap-1">
                                      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
                    <path d="M12.1 8.64l-.1.1-.11-.1C10.14 6.84 7.1 7.5 6.5 9.86c-.46 1.9.78 3.6 2.2 4.9 1.3 1.2 2.8 2.2 3.4 2.6.6-.4 2.1-1.4 3.4-2.6 1.42-1.3 2.66-3 2.2-4.9-.6-2.36-3.64-3.02-5.6-1.22z" fill="currentColor"/>
                  </svg>
                  <span>{likes}</span>
                </div>

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
    </FeedGuard>
  );
}