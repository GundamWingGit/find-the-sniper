'use client';

import { useState } from 'react';
import supabase from '@/lib/supabase';

interface LikeButtonProps {
  imageId: string;
  guestId: string | null;
  initialLiked?: boolean;
  initialCount?: number;
  className?: string;
  onChanged?: (liked: boolean, count: number) => void;
}

export default function LikeButton({ 
  imageId, 
  guestId, 
  initialLiked = false, 
  initialCount = 0, 
  className = '',
  onChanged
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  console.debug({ tag: 'like.state', liked: initialLiked, count: initialCount });

  const handleClick = async () => {
    if (!guestId || isLoading) return;

    setIsLoading(true);
    
    // Optimistic update
    const newLiked = !liked;
    const newCount = newLiked ? count + 1 : count - 1;
    setLiked(newLiked);
    setCount(newCount);

    try {
      if (newLiked) {
        // Insert like
        const { error } = await supabase
          .from('image_likes')
          .insert({ image_id: imageId, guest_id: guestId });
        
        if (error) throw error;
      } else {
        // Remove like
        const { error } = await supabase
          .from('image_likes')
          .delete()
          .eq('image_id', imageId)
          .eq('guest_id', guestId);
        
        if (error) throw error;
      }
      
      // Call onChanged callback after successful update
      onChanged?.(newLiked, newCount);
    } catch (error) {
      console.error('Like operation failed:', error);
      // Revert optimistic update
      setLiked(liked);
      setCount(count);
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = !guestId || isLoading;
  const title = !guestId ? "Sign in soon to like" : (liked ? "Unlike" : "Like");

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={title}
      aria-pressed={liked}
      aria-label={`${liked ? 'Unlike' : 'Like'} this image (${count} likes)`}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
        disabled 
          ? 'text-gray-400 cursor-not-allowed' 
          : liked
          ? 'text-red-500 hover:text-red-600'
          : 'text-gray-500 hover:text-red-500'
      } ${className}`}
    >
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill={liked ? "currentColor" : "none"} 
        stroke="currentColor" 
        strokeWidth="2"
        className="transition-colors"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span>{count}</span>
    </button>
  );
}
