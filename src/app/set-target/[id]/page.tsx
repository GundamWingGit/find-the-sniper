'use client';

import { useState, useEffect, MouseEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type PageState = 'loading' | 'ready' | 'saving' | 'saved' | 'error';

interface ImageData {
  id: string;
  public_url: string;
  width: number | null;
  height: number | null;
}

interface TargetPosition {
  cx: number;
  cy: number;
  displayX: number;
  displayY: number;
}

export default function SetTargetPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState<string>('');
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [target, setTarget] = useState<TargetPosition | null>(null);
  const [radius, setRadius] = useState<number>(50);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadImage();
  }, [id]);

  const loadImage = async () => {
    try {
      setState('loading');
      setError('');

      const { data, error: fetchError } = await supabase
        .from('images')
        .select('id, public_url, width, height')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      setImageData(data);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
      setState('error');
    }
  };

  const handleImageClick = (e: MouseEvent<HTMLImageElement>) => {
    if (!imageData || !imageElement) return;

    const rect = imageElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const renderedW = rect.width;
    const renderedH = rect.height;
    const naturalW = imageData.width ?? imageElement.naturalWidth ?? renderedW;
    const naturalH = imageData.height ?? imageElement.naturalHeight ?? renderedH;

    // Compute natural pixel coordinates
    const cx = Math.round((clickX * naturalW / renderedW) * 10) / 10;
    const cy = Math.round((clickY * naturalH / renderedH) * 10) / 10;

    setTarget({
      cx,
      cy,
      displayX: clickX,
      displayY: clickY,
    });
  };

  async function saveTarget({ imageId, cx, cy, radius }:{
    imageId: string; cx: number; cy: number; radius?: number;
  }) {
    const res = await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId, cx, cy, radius }),
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      throw new Error(msg?.error || 'save_failed');
    }
  }

  const handleSaveTarget = async () => {
    if (!target || !imageData) return;

    setState('saving');
    setError('');

    try {
      // Calculate natural radius
      const renderedW = imageElement?.getBoundingClientRect().width ?? imageData.width ?? 1;
      const naturalW = imageData.width ?? imageElement?.naturalWidth ?? renderedW;
      const naturalRadius = Math.round((radius * naturalW / renderedW) * 10) / 10;

      await saveTarget({
        imageId: id,
        cx: target.cx,
        cy: target.cy,
        radius: naturalRadius,
      });

      setState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save target');
      setState('error');
    }
  };

  const getNaturalRadius = () => {
    if (!imageData || !imageElement) return radius;
    const renderedW = imageElement.getBoundingClientRect().width;
    const naturalW = imageData.width ?? imageElement.naturalWidth ?? renderedW;
    return Math.round((radius * naturalW / renderedW) * 10) / 10;
  };

  if (state === 'loading') {
    return (
      <div className="py-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-lg text-gray-600">Loading image...</div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-600 mb-4">{error}</div>
            <Link
              href="/upload"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Back to Upload
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh] py-8">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="mx-auto h-[900px] w-[1200px] max-w-full blur-3xl opacity-70"
          style={{
            background: "radial-gradient(60% 60% at 50% 30%, rgba(37,99,235,0.40), rgba(147,51,234,0.30), rgba(249,115,22,0.25) 80%)",
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl md:text-4xl font-semibold text-white">
            Set Target Location
          </h1>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition shadow-sm hover:shadow backdrop-blur"
          >
            ← Back to Upload
          </Link>
        </div>

        {state === 'saved' ? (
          <div className="mx-auto max-w-md rounded-2xl bg-black/70 border border-white/10 shadow-xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h2 className="text-xl font-semibold text-green-400 mb-2">
              Target Saved!
            </h2>
            <p className="text-white/70 mb-4">
              Target ID: {targetId}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/upload"
                className="flex-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition shadow-sm hover:shadow backdrop-blur"
              >
                Upload Another
              </Link>
              <button
                onClick={() => {
                  setTarget(null);
                  setTargetId(null);
                  setState('ready');
                }}
                className="flex-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition shadow-sm hover:shadow backdrop-blur"
              >
                Set Another Target
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl bg-black/40 border border-white/10 shadow-xl p-4">
              <p className="text-white/80 text-sm">
                Click on the image to set the target location where players should find the sniper.
              </p>
            </div>

            <div className="relative inline-block rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              <img
                ref={setImageElement}
                src={imageData?.public_url}
                alt="Set target location"
                className="max-w-full h-auto block cursor-crosshair"
                onClick={handleImageClick}
              />
              
              {target && (
                <div
                  className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    left: `${target.displayX}px`,
                    top: `${target.displayY}px`,
                    width: `${radius * 2}px`,
                    height: `${radius * 2}px`,
                  }}
                >
                  <div className="absolute inset-0 rounded-full border-2 border-red-600"></div>
                </div>
              )}
            </div>

            {target && (
              <div className="rounded-2xl bg-black/40 border border-white/10 shadow-xl p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Target Radius: {radius}px (display)
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="120"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-full accent-white/70"
                  />
                </div>

                <div className="text-xs text-white/60 bg-black/20 border border-white/10 p-3 rounded-xl">
                  Debug: cx={target.cx}, cy={target.cy}, radius={getNaturalRadius()} (natural px)
                </div>

                <button
                  onClick={handleSaveTarget}
                  disabled={state === 'saving'}
                  className="w-full inline-flex items-center justify-center rounded-full px-4 py-3 text-base font-semibold bg-white/10 text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm hover:shadow backdrop-blur"
                >
                  {state === 'saving' ? 'Saving Target...' : 'Save Target'}
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-red-500/10 border border-red-400/30 shadow-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
