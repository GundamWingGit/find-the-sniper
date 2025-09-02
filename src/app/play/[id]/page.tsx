'use client';

import { useRef, useState, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Timer, { TimerRef } from '../../../components/Timer';
import { getOrCreateLocalGuestId } from '@/lib/identity';

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
  
  const guestId = getOrCreateLocalGuestId();

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
          <h2 className="text-2xl font-bold text-blue-600 mb-2">
            Congratulations!
          </h2>
          <p className="text-gray-700 mb-4">
            {completionMessage}
          </p>
          <button
            onClick={() => router.push('/feed')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Browse Feed
          </button>
        </div>
      );
    }

    return (
      <div className="text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-2xl font-bold text-green-600 mb-2">
          You found it!
        </h2>
        <p className="text-gray-700 mb-4">
          You found the sniper in{' '}
          <span className="font-bold">
            {(winTime / 1000).toFixed(2)}s
          </span>
          !
        </p>
        <div className="space-y-2">
          <button
            onClick={resetGame}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Play Again
          </button>
          <button
            onClick={goToNextLevel}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Next Level
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto w-full max-w-[680px] md:max-w-[860px] space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Play Level {id}
          </h1>
          <p className="text-gray-600 mb-4">
            Find the hidden sniper in this image. Click when you spot them!
          </p>
          <Timer ref={timerRef} onStop={handleTimerStop} />
        </div>
      
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
        <div className="text-center text-sm text-gray-600">
          Level {id}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push(`/play/${Math.max(1, parseInt(id) - 1)}`)}
            disabled={parseInt(id) <= 1}
            className={`w-full sm:w-auto px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              parseInt(id) <= 1
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
            }`}
          >
            Previous Level
          </button>
          <button
            onClick={resetGame}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Reset Game
          </button>
        </div>

        {/* Results overlay */}
        {showResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div 
              className="w-full max-w-[560px] rounded-2xl bg-white/95 dark:bg-neutral-900/95 shadow-xl p-4 sm:p-6"
              aria-modal="true"
              role="dialog"
            >
              <ResultPanel />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
