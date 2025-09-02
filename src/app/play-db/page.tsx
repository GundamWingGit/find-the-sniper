'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { getOrCreateGuestId } from '@/lib/guest';

type ImageRow = {
  id: string;
  title?: string | null;
  location?: string | null;
};

export default function PlayDbPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');

        const guestId = getOrCreateGuestId();

        // Get images this guest has already completed
        const { data: completedScores, error: scoresError } = await supabase
          .from('scores')
          .select('image_id')
          .eq('guest_id', guestId);

        if (scoresError) throw scoresError;

        const completedImageIds = (completedScores || []).map(score => score.image_id);

        // Get all targets to find playable images
        const { data: targets, error: targetsError } = await supabase
          .from('targets')
          .select('image_id');

        if (targetsError) throw targetsError;

        const playableImageIds = (targets || []).map(t => t.image_id);

        if (playableImageIds.length === 0) {
          // No playable images exist
          setLoading(false);
          return;
        }

        // Get image details for playable images
        const { data: playableImages, error: imagesError } = await supabase
          .from('images')
          .select('id, title, location')
          .in('id', playableImageIds);

        if (imagesError) throw imagesError;

        // Filter out completed images
        const unseenImages = (playableImages || []).filter(
          img => !completedImageIds.includes(img.id)
        );

        if (unseenImages.length === 0) {
          // All images completed - show completion message
          setLoading(false);
          return;
        }

        // Pick a random unseen image
        const randomImage = unseenImages[Math.floor(Math.random() * unseenImages.length)];
        
        // Navigate to that image's play page
        router.push(`/play-db/${randomImage.id}`);

      } catch (err: any) {
        setError(err?.message ?? 'Failed to find a game');
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="text-lg text-gray-300 mb-4">Finding you a game...</div>
          <div className="text-sm text-gray-400">Looking for images you haven't completed yet</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-center">
          <div className="text-lg font-medium mb-2">Something went wrong</div>
          <div className="text-sm mb-4">{error}</div>
          <Link href="/feed" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  // All images completed
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center">
        <div className="p-8 rounded-lg bg-green-50 border border-green-200">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-green-800 mb-2">
            All caught up!
          </h2>
          <p className="text-green-700 mb-6">
            You've completed all available images. Great job!
          </p>
          <Link
            href="/feed"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          >
            Back to Feed
          </Link>
        </div>
      </div>
    </div>
  );
}
