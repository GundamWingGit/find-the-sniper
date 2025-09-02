'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import supabase from '@/lib/supabase';

type ScoreRow = {
  id: string;
  ms: number;
  created_at: string;
  player_name: string | null;
};

type ImageRow = {
  id: string;
  public_url: string;
  title?: string | null;
  location?: string | null;
};

const shortId = (id: string) => id.length > 12 ? id.slice(0, 8) + '…' : id;
const label = (img: ImageRow) => img.title?.trim() || shortId(img.id);

export default function LeaderboardByImagePage() {
  const params = useParams();
  const imageId = (params.id as string) ?? '';

  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [image, setImage] = useState<ImageRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!imageId) return;

    (async () => {
      setLoading(true);

      const [{ data: img }, { data: rows }] = await Promise.all([
        supabase.from('images')
          .select('id, public_url, title, location')
          .eq('id', imageId)
          .maybeSingle(),
        supabase.from('scores')
          .select('id, ms, created_at, player_name')
          .eq('image_id', imageId)
          .order('ms', { ascending: true })
          .limit(20),
      ]);

      if (img) setImage(img as ImageRow);
      setScores((rows || []) as ScoreRow[]);
      setLoading(false);
    })();
  }, [imageId]);

  if (loading) {
    return <div className="py-8 text-center text-gray-400">Loading…</div>;
  }

  if (!image) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-500 mb-4">Image not found.</p>
        <Link href="/leaderboard" className="text-blue-600 underline">← Back to Leaderboard</Link>
      </div>
    );
  }

  return (
    <div className="py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-100">Leaderboard</h1>
        <div className="flex gap-3">
          <Link href="/leaderboard" className="text-blue-400 underline">All images</Link>
          <Link href={`/play-db/${image.id}`} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Play this image</Link>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative w-28 h-20 rounded overflow-hidden border border-gray-700">
          <Image src={image.public_url} alt="Image" fill className="object-cover" />
        </div>
        <div className="text-gray-300">
          <div className="text-lg font-medium text-gray-100">{label(image)}</div>
          {image.location?.trim() && (
            <div className="text-sm text-gray-400 mt-1">{image.location.trim()}</div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900/60 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">When</th>
            </tr>
          </thead>
          <tbody>
            {scores.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No scores yet. Be the first!
                </td>
              </tr>
            )}
            {scores.map((row, idx) => (
              <tr key={row.id} className="border-t border-gray-800">
                <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                <td className="px-4 py-3 text-gray-200">{row.player_name || 'Anonymous'}</td>
                <td className="px-4 py-3 text-gray-100 font-medium">{(row.ms / 1000).toFixed(2)}s</td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(row.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
