'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import SetTargetButton from '@/components/SetTargetButton';

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
    <div className="py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Community Feed</h1>

        {/* Sort control */}
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort:</span>
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setSort('new')}
              className={`px-3 py-1 rounded-md text-sm ${sort==='new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              aria-pressed={sort==='new'}
            >
              Most Recent
            </button>
            <button
              onClick={() => setSort('mostLiked')}
              className={`px-3 py-1 rounded-md text-sm ${sort==='mostLiked' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              aria-pressed={sort==='mostLiked'}
            >
              Most Liked
            </button>
            <button
              onClick={() => setSort('hot')}
              className={`px-3 py-1 rounded-md text-sm ${sort==='hot' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              aria-pressed={sort==='hot'}
            >
              Hot
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-gray-600">Loading images…</div>
        )}

        {!loading && images.length === 0 && (
          <div className="text-gray-600">No images yet. <Link href="/upload" className="text-blue-600 underline">Upload one</Link> to get started.</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map(img => {
            const playable = withTarget.has(img.id);
            const likes = likeMap.get(img.id) ?? 0;
            const src = resolveImageSrc(img);
            return (
              <div key={img.id} className="relative bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center">
                  {src ? (
                    <img
                      src={src}
                      alt={img.title ?? ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-48 w-full bg-white/10 flex items-center justify-center text-white/50 text-xs">
                      No preview
                    </div>
                  )}
                </div>

                {/* like badge (non-interactive) */}
                <div className="absolute bottom-2 right-2 rounded-full bg-black/60 text-white text-xs px-2 py-1 flex items-center gap-1">
                  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
                    <path d="M12.1 8.64l-.1.1-.11-.1C10.14 6.84 7.1 7.5 6.5 9.86c-.46 1.9.78 3.6 2.2 4.9 1.3 1.2 2.8 2.2 3.4 2.6.6-.4 2.1-1.4 3.4-2.6 1.42-1.3 2.66-3 2.2-4.9-.6-2.36-3.64-3.02-5.6-1.22z" fill="currentColor"/>
                  </svg>
                  <span>{likes}</span>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <div className="font-medium text-gray-900">{label(img)}</div>
                    {img.location?.trim() && (
                      <div className="text-sm text-gray-500 mt-1">{img.location.trim()}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/play-db/${img.id}`}
                      className={`px-3 py-2 rounded text-white text-sm ${
                        playable
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                      aria-disabled={!playable}
                      onClick={(e) => { if (!playable) e.preventDefault(); }}
                    >
                      Play
                    </Link>
                    <SetTargetButton imageId={img.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}