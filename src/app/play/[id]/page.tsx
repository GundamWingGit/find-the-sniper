'use client';

import { useRef, useState, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Timer, { TimerRef } from '../../../components/Timer';

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
  const timerRef = useRef<TimerRef>(null);
  const imageRef = useRef<HTMLImageElement>(null);

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
    timerRef.current?.resetAndStart();
  };

  const goToNextLevel = () => {
    const nextId = parseInt(id) + 1;
    router.push(`/play/${nextId}`);
  };

  // Results panel component
  function ResultPanel() {
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
    <div className="py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Play Level {id}
        </h1>
        <p className="text-gray-600 mb-4">
          Find the hidden sniper in this image. Click when you spot them!
        </p>
        <Timer ref={timerRef} onStop={handleTimerStop} />
      </div>
      
      <div className="relative max-w-4xl mx-auto">
        <div className="relative inline-block w-full">
          <Image
            ref={imageRef}
            src={currentImageSrc}
            alt="Find the sniper in this image"
            width={800}
            height={600}
            className={`w-full h-auto rounded-lg shadow-lg cursor-crosshair ${
              showResult ? 'opacity-20 pointer-events-none select-none' : ''
            }`}
            onLoad={handleImageLoad}
            onClick={handleImageClick}
            priority
          />
          
          {/* Level caption */}
          <div className="text-center mt-2 text-sm text-gray-600">
            Level {id}
          </div>
          
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

      <div className="mt-8 flex justify-between items-center max-w-4xl mx-auto">
        <button
          onClick={() => router.push(`/play/${Math.max(1, parseInt(id) - 1)}`)}
          disabled={parseInt(id) <= 1}
          className={`px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            parseInt(id) <= 1
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
          }`}
        >
          Previous Level
        </button>
        <div className="text-gray-600">
          Level {id}
        </div>
        <button
          onClick={resetGame}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Reset Game
        </button>
      </div>

      {/* Results overlay */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div 
            className="w-full max-w-2xl rounded-2xl bg-white/95 dark:bg-neutral-900/95 shadow-xl p-6"
            aria-modal="true"
            role="dialog"
          >
            <ResultPanel />
          </div>
        </div>
      )}
    </div>
  );
}
