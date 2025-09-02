'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { ScoreRow } from '@/lib/types';

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
      .from('scores')
      .select('id, image_id, ms, created_at, player_name, guest_id, image:images(id, public_url, title, location)')
      .order('ms', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) throw error;
    // Transform the data to match ScoreRow type (image relation returns array, we need single object)
    return (data ?? []).map(item => ({
      ...item,
      image: Array.isArray(item.image) ? item.image[0] || null : item.image
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
    <div className="py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Leaderboard</h1>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange('fastest')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'fastest'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Fastest Times
            </button>
            <button
              onClick={() => handleTabChange('mostGames')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'mostGames'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Most Games
            </button>
            <button
              onClick={() => handleTabChange('topPlayers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'topPlayers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Top Players
            </button>
            <button
              onClick={() => handleTabChange('topImages')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'topImages'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Top Images
            </button>

          </nav>
        </div>
      </div>

      {loading && <div className="text-gray-600">Loading leaderboard…</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && players.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {activeTab === 'mostGames' ? 'No players yet.' : 
           activeTab === 'topPlayers' ? 'No players yet.' : 'No scores yet.'}
        </div>
      )}

      {!loading && !error && (rows.length > 0 || players.length > 0) && (
        <div className="overflow-x-auto">
          {activeTab === 'fastest' && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Image</th>
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Play</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r, idx) => (
                  <tr key={r.id} className="align-middle">
                    <td className="py-2 pr-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 pr-3">
                      {r.image?.public_url ? (
                        <div className="flex items-center gap-3">
                          <Link href={`/leaderboard/${r.image_id}`}>
                            <img
                              src={r.image.public_url}
                              alt="thumb"
                              width={80}
                              height={60}
                              className="rounded border border-gray-200 object-cover hover:opacity-80 cursor-pointer"
                              style={{ width: 80, height: 60 }}
                            />
                          </Link>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{label(r.image)}</div>
                            {r.image.location?.trim() && (
                              <div className="text-xs text-gray-500">{r.image.location.trim()}</div>
                            )}
                            <Link href={`/leaderboard/${r.image_id}`} className="text-blue-400 underline text-xs">Scores</Link>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-15 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
                            (no image)
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {r.player_name || "Anonymous"}
                    </td>
                    <td className="py-2 pr-3 font-medium">{formatMs(r.ms)}</td>
                    <td className="py-2 pr-3 text-gray-500">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">
                      {r.image_id ? (
                        <Link
                          href={`/play-db/${r.image_id}`}
                          className="inline-block bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                        >
                          Play
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {activeTab === 'mostGames' && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Games</th>
                  <th className="py-2 pr-3">Elo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {players.map((player, idx) => (
                  <tr key={player.guest_id} className="align-middle">
                    <td className="py-2 pr-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 pr-3">
                      {player.name || "Guest"}
                    </td>
                    <td className="py-2 pr-3 font-medium">{player.games_played}</td>
                    <td className="py-2 pr-3 text-gray-500">{player.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {activeTab === 'topPlayers' && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Rating</th>
                  <th className="py-2 pr-3">Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {players.map((player, idx) => (
                  <tr key={player.guest_id} className="align-middle">
                    <td className="py-2 pr-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 pr-3">
                      {player.name || "Guest"}
                    </td>
                    <td className="py-2 pr-3 font-medium">{player.rating}</td>
                    <td className="py-2 pr-3 text-gray-500">{player.games_played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {activeTab === 'topImages' && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Image</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Likes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topImages.map((item, idx) => (
                  <tr key={item.image_id} className="align-middle hover:bg-gray-50">
                    <td className="py-2 pr-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 pr-3">
                      <Link 
                        href={`/play-db/${item.image_id}`}
                        className="block w-16 h-12 bg-gray-100 rounded overflow-hidden hover:opacity-80 transition-opacity"
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
                    <td className="py-2 pr-3">
                      <Link 
                        href={`/play-db/${item.image_id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {label(item.image)}
                      </Link>
                      {item.image.location?.trim() && (
                        <div className="text-xs text-gray-500 mt-1">
                          {item.image.location.trim()}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-medium text-red-500">
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
      )}
    </div>
  );
}