'use client';

import { useRef, useState, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Timer, { TimerRef } from '../../../components/Timer';
import { getOrCreateLocalGuestId } from '@/lib/identity';
import { getGuest, getOrCreateGuestId } from '@/lib/guest';

interface PlayPageProps {
  params: Promise<{ id: string }>;
}

interface ClickDot {
  x: number;
  y: number;
}

export default function PlayPage({ params }: PlayPageProps) {
  const router = useRouter();
  const [id, setId] = useState<string>('');
  const [gameWon, setGameWon] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [winTime, setWinTime] = useState<number>(0);
  const [clickDots, setClickDots] = useState<ClickDot[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string>('');
  const timerRef = useRef<TimerRef>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const guestId = (() => {
    const guest = getGuest();
    return guest?.id ?? getOrCreateGuestId();
  })();

  const demoImages = ["/images/demo.jpeg", "/images/demo2.jpeg", "/images/demo3.jpeg"];

  // Get the id from params (Next.js 15 async params)
  useState(() => {
    params.then(({ id: paramId }) => setId(paramId));
  });

  // Pick image based on level ID
  const currentImageSrc = id ? demoImages[(parseInt(id) - 1) % demoImages.length] : demoImages[0];

  const handleImageLoad = () => {
    setImageLoaded(true);
    timerRef.current?.start();
  };

  const handleImageClick = (event: MouseEvent<HTMLImageElement>) => {
    if (gameWon || !imageLoaded) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Add click dot
    setClickDots(prev => [...prev, { x, y }]);

    // Check if click is near center (within ~50px)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

    if (distance <= 50) {
      // Player found the sniper!
      timerRef.current?.stop();
      setGameWon(true);
      setShowResult(true);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleTimerStop = (ms: number) => {
    setWinTime(ms);
  };

  const resetGame = () => {
    setGameWon(false);
    setShowResult(false);
    setWinTime(0);
    setClickDots([]);
    setCompletionMessage('');
    timerRef.current?.resetAndStart();
  };

  const goToNextLevel = async () => {
    try {
      const res = await fetch("/api/next-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          current_image_id: id, 
          guest_id: guestId 
        }),
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        console.warn('next image API failed', json?.details || json?.error || `HTTP ${res.status}`);
        const nextId = parseInt(id) + 1; // fallback to old behavior
        router.push(`/play/${nextId}`);
        return;
      }
      
      const nextId = json.next_image_id;
      if (nextId) {
        router.push(`/play/${nextId}`);
      } else {
        // No unplayed images - show completion message
        setCompletionMessage("You've completed them all! Come back later for more or upload your own.");
      }
    } catch (e: any) {
      console.warn('next image exception', e);
      const nextId = parseInt(id) + 1; // fallback to old behavior
      router.push(`/play/${nextId}`);
    }
  };

  // Results panel component
  function ResultPanel() {
    if (completionMessage) {
      return (
        <div className="text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-green-400 mb-2">
            Congratulations!
          </h2>
          <p className="text-sm text-white/70 mb-4">
            {completionMessage}
          </p>
          <button
            onClick={() => router.push('/feed')}
            className="w-full inline-flex items-center justify-center rounded-full px-4 py-3 text-base font-semibold bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition shadow-sm hover:shadow backdrop-blur"
          >
            Browse Feed
          </button>
        </div>
      );
    }

    return (
      <div className="text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-xl font-semibold text-green-400 mb-2">
          You found it!
        </h2>
        <p className="text-sm text-white/70 mb-1">
          Time: {(winTime / 1000).toFixed(2)}s
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={resetGame}
            className="rounded-full bg-white/10 text-white/90 py-2 px-4 hover:bg-white/20 hover:text-white transition backdrop-blur"
          >
            Play Again
          </button>
          <button
            onClick={goToNextLevel}
            className="rounded-full bg-white/10 text-white/90 py-2 px-4 hover:bg-white/20 hover:text-white transition backdrop-blur"
          >
            Next Level
          </button>
          <Link
            href="/feed"
            className="text-center rounded-full bg-white/10 text-white/90 py-2 px-4 hover:bg-white/20 hover:text-white transition backdrop-blur"
          >
            Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="mx-auto h-[900px] w-[1200px] max-w-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 30%, rgba(37,99,235,0.40), rgba(147,51,234,0.30), rgba(249,115,22,0.25) 80%)",
          }}
        />
      </div>

      <main className="min-h-screen p-4">
        <div className="mx-auto w-full max-w-[680px] md:max-w-[860px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h1 className="text-2xl md:text-3xl font-semibold text-white">
              Find the Sniper
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Timer ref={timerRef} onStop={handleTimerStop} />
            </div>
          </div>
          
          <p className="text-white/80 mb-4">
            Find the hidden sniper in this image. Click when you spot them!
          </p>
      
        <div className="w-full overflow-hidden rounded-xl bg-neutral-900">
          <div className="relative w-full">
            <Image
              ref={imageRef}
              src={currentImageSrc}
              alt="Find the sniper in this image"
              width={800}
              height={600}
              className={`w-full h-auto block object-contain cursor-crosshair ${
                showResult ? 'opacity-20 pointer-events-none select-none' : ''
              }`}
              onLoad={handleImageLoad}
              onClick={handleImageClick}
              priority
            />
          
            {/* Click dots */}
            {clickDots.map((dot, index) => (
              <div
                key={index}
                className="absolute w-3 h-3 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${dot.x}px`,
                  top: `${dot.y}px`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Level caption */}
        <div className="text-center text-sm text-white/60">
          Level {id}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push(`/play/${Math.max(1, parseInt(id) - 1)}`)}
            disabled={parseInt(id) <= 1}
            className={`w-full sm:w-auto px-4 py-2 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/30 ${
              parseInt(id) <= 1
                ? 'bg-white/5 text-white/40 cursor-not-allowed'
                : 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
            }`}
          >
            Previous Level
          </button>
          <button
            onClick={resetGame}
            className="w-full sm:w-auto px-4 py-2 bg-white/10 text-white/90 rounded-full hover:bg-white/20 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            Reset Game
          </button>
        </div>

        {/* Results overlay */}
        {showResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div 
              className="w-full max-w-md rounded-2xl bg-black/70 border border-white/10 shadow-xl p-6"
              aria-modal="true"
              role="dialog"
            >
              <ResultPanel />
            </div>
          </div>
        )}
      </div>
    </main>
    </div>
  );
}
