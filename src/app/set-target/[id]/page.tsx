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
    <div className="py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Set Target Location
          </h1>
          <Link
            href="/upload"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            ← Back to Upload
          </Link>
        </div>

        {state === 'saved' ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h2 className="text-xl font-semibold text-green-600 mb-2">
              Target Saved!
            </h2>
            <p className="text-green-700 mb-4">
              Target ID: {targetId}
            </p>
            <div className="space-x-4">
              <Link
                href="/upload"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Upload Another
              </Link>
              <button
                onClick={() => {
                  setTarget(null);
                  setTargetId(null);
                  setState('ready');
                }}
                className="inline-block bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Set Another Target
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-700 text-sm">
                Click on the image to set the target location where players should find the sniper.
              </p>
            </div>

            <div className="relative inline-block">
              <img
                ref={setImageElement}
                src={imageData?.public_url}
                alt="Set target location"
                className="max-w-full h-auto rounded-lg border border-gray-200 cursor-crosshair"
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Radius: {radius}px (display)
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="120"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  Debug: cx={target.cx}, cy={target.cy}, radius={getNaturalRadius()} (natural px)
                </div>

                <button
                  onClick={handleSaveTarget}
                  disabled={state === 'saving'}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  {state === 'saving' ? 'Saving Target...' : 'Save Target'}
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
