'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface TimerProps {
  onStop?: (ms: number) => void;
}

export interface TimerRef {
  start: () => void;
  stop: () => void;
  reset: () => void;
  resetAndStart: () => void;
}

const Timer = forwardRef<TimerRef, TimerProps>(({ onStop }, ref) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    if (!isRunning) {
      startTimeRef.current = Date.now() - elapsedMs;
      setIsRunning(true);
    }
  };

  const stop = () => {
    if (isRunning) {
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      onStop?.(elapsedMs);
    }
  };

  const reset = () => {
    setElapsedMs(0);
    setIsRunning(false);
    startTimeRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resetAndStart = () => {
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    setIsRunning(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useImperativeHandle(ref, () => ({
    start,
    stop,
    reset,
    resetAndStart,
  }));

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedMs(Date.now() - startTimeRef.current);
        }
      }, 10); // Update every 10ms for smooth display
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const seconds = (elapsedMs / 1000).toFixed(2);

  return (
    <div className="text-lg font-mono text-gray-700">
      Time: {seconds}s
    </div>
  );
});

Timer.displayName = 'Timer';

export default Timer;
