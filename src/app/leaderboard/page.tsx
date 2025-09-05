'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { ScoreRow } from '@/lib/types';
import DashboardFab from '@/components/DashboardFab';

const SHOW_TOP_IMAGES = false;

const shortId = (id: string) => id.length > 12 ? id.slice(0, 8) + '…' : id;
const label = (img: { id: string; title?: string | null }) => img.title?.trim() || shortId(img.id);

type TabType = 'fastest' | 'mostGames' | 'topPlayers' | 'topImages';



// Helper to format relative time
const formatRelativeTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('fastest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [topImages, setTopImages] = useState<any[]>([]);


  const fetchFastestScores = async () => {
    const { data, error } = await supabase
      .from('leaderboard_fastest_per_image')
      .select('image_id,time_ms,player_name,guest_id,achieved_at,title,location,public_url')
      .order('time_ms', { ascending: true });
    if (error) throw error;
    
    // Transform the data to match ScoreRow type expected by the UI
    return (data ?? []).map(item => ({
      id: `${item.image_id}-${item.guest_id}`, // Create a unique id for the row
      image_id: item.image_id,
      ms: item.time_ms, // Map time_ms to ms for compatibility
      created_at: item.achieved_at,
      player_name: item.player_name,
      guest_id: item.guest_id,
      image: {
        id: item.image_id,
        public_url: item.public_url,
        title: item.title,
        location: item.location
      }
    })) as ScoreRow[];
  };

  const fetchMostGames = async () => {
    const { data: rows, error } = await supabase
      .from('player_ratings')
      .select('guest_id, player_name, rating, games_played, updated_at')
      .order('games_played', { ascending: false })
      .order('rating', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const ids = Array.from(new Set(rows.map(r => r.guest_id).filter(Boolean)));
    let nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: names } = await supabase
        .from('player_name')
        .select('guest_id,name')
        .in('guest_id', ids);
      for (const n of names ?? []) nameMap.set(n.guest_id, n.name);
    }
    const withNames = rows.map(r => ({ ...r, name: nameMap.get(r.guest_id) || 'Anonymous' }));
    return withNames;
  };

  const fetchTopPlayers = async () => {
    const { data: rows, error } = await supabase
      .from('player_ratings')
      .select('guest_id, player_name, rating, games_played, updated_at')
      .order('rating', { ascending: false })
      .order('games_played', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const ids = Array.from(new Set(rows.map(r => r.guest_id).filter(Boolean)));
    let nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: names } = await supabase
        .from('player_name')
        .select('guest_id,name')
        .in('guest_id', ids);
      for (const n of names ?? []) nameMap.set(n.guest_id, n.name);
    }
    const withNames = rows.map(r => ({ ...r, name: nameMap.get(r.guest_id) || 'Anonymous' }));
    return withNames;
  };

  const fetchTopImages = async () => {
    const { data, error } = await supabase
      .from('image_like_counts')
      .select('image_id, likes')
      .order('likes', { ascending: false })
      .limit(100);
    if (error) throw error;
    
    console.debug({ tag: 'topImages.fetch', rows: data?.length ?? 0 });
    
    if (!data || data.length === 0) return [];
    
    // Fetch image metadata for those IDs
    const ids = data.map(d => d.image_id);
    const { data: imgs, error: imgError } = await supabase
      .from('images')
      .select('id, title, public_url, location')
      .in('id', ids);
    
    if (imgError) throw imgError;
    
    // Merge by id
    return data.map(item => {
      const img = imgs?.find(i => i.id === item.image_id);
      return {
        ...item,
        image: img || { id: item.image_id, title: null, public_url: '', location: null }
      };
    });
  };

  const loadData = async (tab: TabType) => {
    try {
      setLoading(true);
      setError('');
      
      if (tab === 'fastest') {
        const data = await fetchFastestScores();
        setRows(data);
        setPlayers([]);
        setTopImages([]);
      } else if (tab === 'mostGames') {
        const data = await fetchMostGames();
        setRows([]);
        setPlayers(data);
        setTopImages([]);
      } else if (tab === 'topPlayers') {
        const data = await fetchTopPlayers();
        setRows([]);
        setPlayers(data);
        setTopImages([]);
      } else if (tab === 'topImages') {
        const data = await fetchTopImages();
        setRows([]);
        setPlayers([]);
        setTopImages(data);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const formatMs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
  const formatDurationMs = (durationMs?: number | null) => {
    if (durationMs == null) return '—';
    return `${(durationMs / 1000).toFixed(2)}s`;
  };

  return (
    <>
    <div className="relative min-h-[80vh] py-8">
      {/* gradient layer behind leaderboard content */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="mx-auto h-[900px] w-[1200px] max-w-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 30%, rgba(37,99,235,0.40), rgba(147,51,234,0.30), rgba(249,115,22,0.25) 80%)",
          }}
        />
      </div>

      <h1 className="text-3xl md:text-4xl font-semibold text-white mb-6">Leaderboard</h1>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="inline-flex items-center rounded-full bg-white/10 p-1 backdrop-blur">
          {[
            { key: 'fastest', label: 'Fastest Times' },
            { key: 'mostGames', label: 'Most Games' },
            { key: 'topPlayers', label: 'Top Players' },
            ...(SHOW_TOP_IMAGES ? [{ key: 'topImages', label: 'Top Images' }] : []),
          ].map(t => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabChange(t.key as TabType)}
                className={
                  "px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-[0.95rem] rounded-full transition " +
                  (active
                    ? "bg-white text-black shadow"
                    : "text-white/80 hover:text-white hover:bg-white/20")
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className="text-white/60">Loading leaderboard…</div>}
      {error && (
        <div className="bg-red-500/20 border border-red-400/30 text-red-400 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && players.length === 0 && (
        <div className="text-center py-8 text-white/60">
          {activeTab === 'mostGames' ? 'No players yet.' : 
           activeTab === 'topPlayers' ? 'No players yet.' : 'No scores yet.'}
        </div>
      )}

      {!loading && !error && (rows.length > 0 || players.length > 0) && (
        <div className="rounded-2xl bg-black/70 border border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            {activeTab === 'fastest' && (
              <table className="table-auto w-full text-sm">
                <thead className="bg-white/5 md:sticky md:top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-white/90 min-w-[200px]">Image</th>
                    <th className="px-4 py-3 text-left font-semibold text-white/90 min-w-[120px] whitespace-nowrap">Player</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/90 min-w-[80px] whitespace-nowrap">Time</th>
                    <th className="px-4 py-3 text-left font-semibold text-white/90 min-w-[140px] whitespace-nowrap">When</th>
                    <th className="px-4 py-3 text-center font-semibold text-white/90 min-w-[80px] whitespace-nowrap">Play</th>
                  </tr>
                </thead>
                <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className="border-t border-white/10 even:bg-white/[0.02] hover:bg-white/[0.04] transition">
                    <td className="px-4 py-3">
                      {r.image?.public_url ? (
                        <div className="flex items-center gap-3">
                          <Link href={`/leaderboard/${r.image_id}`}>
                            <img
                              src={r.image.public_url}
                              alt="thumb"
                              className="h-14 w-20 object-cover rounded-md hover:opacity-80 cursor-pointer"
                            />
                          </Link>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white whitespace-normal break-words">{label(r.image)}</div>
                            {r.image.location?.trim() && (
                              <div className="text-xs text-white/60 whitespace-normal break-words">{r.image.location.trim()}</div>
                            )}
                            <Link href={`/leaderboard/${r.image_id}`} className="text-xs text-white/60 hover:text-white whitespace-nowrap">Scores</Link>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-14 bg-white/5 border border-white/20 rounded-md flex items-center justify-center text-xs text-white/40">
                            (no image)
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                      {r.player_name || "Anonymous"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/90 tabular-nums font-medium whitespace-nowrap">{formatMs(r.ms)}</td>
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.image_id ? (
                        <Link
                          href={`/play-db/${r.image_id}`}
                          className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium bg-white/10 text-white/90 hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 transition shadow-sm hover:shadow backdrop-blur"
                        >
                          Play
                        </Link>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {activeTab === 'mostGames' && (
            <table className="table-auto w-full text-sm">
              <thead className="bg-white/5 md:sticky md:top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-white/90 min-w-[150px]">Player</th>
                  <th className="px-4 py-3 text-right font-semibold text-white/90 min-w-[80px] whitespace-nowrap">Games</th>
                  <th className="px-4 py-3 text-right font-semibold text-white/90 min-w-[80px] whitespace-nowrap">Elo</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, idx) => (
                  <tr key={player.guest_id} className="border-t border-white/10 even:bg-white/[0.02] hover:bg-white/[0.04] transition">
                    <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                      {player.name || "Guest"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/90 tabular-nums font-medium whitespace-nowrap">{player.games_played}</td>
                    <td className="px-4 py-3 text-right text-white/60 tabular-nums whitespace-nowrap">{player.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {activeTab === 'topPlayers' && (
            <table className="table-auto w-full text-sm">
              <thead className="bg-white/5 md:sticky md:top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-white/90 min-w-[150px]">Player</th>
                  <th className="px-4 py-3 text-right font-semibold text-white/90 min-w-[80px] whitespace-nowrap">Rating</th>
                  <th className="px-4 py-3 text-right font-semibold text-white/90 min-w-[80px] whitespace-nowrap">Games</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, idx) => (
                  <tr key={player.guest_id} className="border-t border-white/10 even:bg-white/[0.02] hover:bg-white/[0.04] transition">
                    <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                      {player.name || "Guest"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/90 tabular-nums font-medium whitespace-nowrap">{player.rating}</td>
                    <td className="px-4 py-3 text-right text-white/60 tabular-nums whitespace-nowrap">{player.games_played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {SHOW_TOP_IMAGES && activeTab === 'topImages' && (
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 md:sticky md:top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-white/90">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-white/90">Image</th>
                  <th className="px-4 py-3 text-left font-semibold text-white/90">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-white/90">Likes</th>
                </tr>
              </thead>
              <tbody>
                {topImages.map((item, idx) => (
                  <tr key={item.image_id} className="border-t border-white/10 even:bg-white/[0.02] hover:bg-white/[0.04] transition">
                    <td className="px-4 py-3 text-white/90 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/play-db/${item.image_id}`}
                        className="block h-14 w-20 bg-white/5 rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                      >
                        {item.image.public_url && (
                          <img 
                            src={item.image.public_url} 
                            alt="Thumbnail"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/play-db/${item.image_id}`}
                        className="text-white hover:text-white/80 hover:underline"
                      >
                        {label(item.image)}
                      </Link>
                      {item.image.location?.trim() && (
                        <div className="text-xs text-white/60 mt-1">
                          {item.image.location.trim()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-red-400">
                      <div className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        {item.likes}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>
      )}
    </div>
    <DashboardFab href="/dashboard" label="Dashboard" />
    </>
  );
}