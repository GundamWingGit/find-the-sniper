"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { useUser } from '@clerk/nextjs';
import { getOrCreateLocalGuestId, linkGuestToProfile } from '@/lib/identity';
import { getBaselineForImageP60 } from "@/lib/rating";
import { applyEloForRound, type EloResult } from "@/lib/elo";
import LikeButton from "@/components/LikeButton";

type ImageRow = {
  id: string;
  public_url: string;
  width: number | null;
  height: number | null;
  description?: string | null;
  title?: string | null;
  location?: string | null;
};

type TargetRow = {
  id: string;
  image_id: string;
  cx: number;
  cy: number;
  radius: number;
};

type Status = "loading" | "ready" | "found" | "gaveUp" | "error";

type RoundSummary = {
  hardStop: boolean;
  timeMs: number;
  perfPct: number;
  eloBefore: number;
  eloAfter: number;
  penalty: number;
  baseDelta: number;
  totalDelta: number;
  isPractice?: boolean;
};

const NAME_KEY = 'fts_player_name';

// Helper: check if player previously solved this image
async function hasSolvedBefore(supabase: any, playerId: string, imageId: string): Promise<boolean> {
  if (!playerId) return false;
  const { data, error } = await supabase
    .from('scores')
    .select('id')
    .eq('guest_id', playerId)
    .eq('image_id', imageId)
    .eq('result', 'success')
    .limit(1);
  if (error) { 
    console.warn('hasSolvedBefore error', error); 
    return false; 
  }
  return Array.isArray(data) && data.length > 0;
}

// Helper functions for centralized duration calculations
const durationWithMissPenalty = (ms: number, misses: number) => {
  // +4% per miss, capped at +40% total
  const penaltyFactor = Math.min(1.0 + 0.04 * misses, 1.40);
  return Math.round(ms * penaltyFactor);
};

const pctVsBaseline = (usedMs: number, baselineMs: number) =>
  Math.round((1 - usedMs / Math.max(1, baselineMs)) * 100);

const buildUsedMs = (rawMs: number, misses: number, baselineMs: number) => {
  const penaltyFactor = Math.min(1.0 + 0.04 * misses, 1.40);
  return Math.round(rawMs * penaltyFactor);
};

function getStoredName(): string | null {
  try {
    const stored = localStorage.getItem(NAME_KEY);
    const trimmed = stored?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function sanitizeName(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, 50);
}

function setStoredName(name: string | null): void {
  try {
    if (!name || name.trim().length === 0) {
      localStorage.removeItem(NAME_KEY);
    } else {
      const sanitized = sanitizeName(name);
      localStorage.setItem(NAME_KEY, sanitized);
    }
  } catch {
    // Graceful fallback if localStorage unavailable
  }
}

async function upsertPlayerNameNow(supabase: any, id: string, name: string) {
  try {
    if (!id || !name) return;
    await supabase
      .from('player_name')
      .upsert({ guest_id: id, name }, { onConflict: 'guest_id' });
  } catch (e) {
    console.debug('upsertPlayerNameNow error', e);
  }
}

export default function PlayDbPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const imageId = params?.id;

  const [status, setStatus] = useState<Status>("loading");
  const [img, setImg] = useState<ImageRow | null>(null);
  const [target, setTarget] = useState<TargetRow | null>(null);
  const [err, setErr] = useState<string>("");

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [winMs, setWinMs] = useState<number>(0);
  const [hasSavedScore, setHasSavedScore] = useState<boolean>(false);
  const [localName, setLocalName] = React.useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('player_name') ?? '';
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const gameTimerIdRef = useRef<number | null>(null);
  const gameStartRef = useRef<number>(0);
  const [started, setStarted] = useState<boolean>(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [eloResult, setEloResult] = useState<EloResult | null>(null);
  const [misses, setMisses] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRoundOver, setIsRoundOver] = useState<boolean>(false);
  const [lastMissAt, setLastMissAt] = useState<number>(0);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const roundStartTimeRef = useRef<number>(0);
  const [endReason, setEndReason] = useState<string>('');
  
  // Hard lock refs for bulletproof round control
  const isRoundOverRef = useRef<boolean>(false);
  const missesRef = useRef<number>(0);
  const lastMissAtRef = useRef<number>(0);
  const MISS_COOLDOWN_MS = 250;
  

  
  // Clerk user data
  const { user, isLoaded, isSignedIn } = useUser();
  
  // --- Identity (Clerk + Guest) ---
  const guestId = React.useMemo(() => getOrCreateLocalGuestId(), []);
  const playerId = user?.id ?? guestId;
  const isAuthed = !!user;

  function deriveClerkDisplayName(u?: any) {
    const full = u?.fullName?.trim();
    if (full) return full;
    const uname = u?.username?.trim();
    if (uname) return uname;
    const email = u?.primaryEmailAddress?.emailAddress?.trim();
    if (email) return email.split('@')[0];
    return 'Anonymous';
  }

  // Unified display name for this round
  const displayName = isAuthed ? deriveClerkDisplayName(user) : localName;

  React.useEffect(() => {
    if (!isAuthed || !user?.id) return;
    const name = deriveClerkDisplayName(user);
    supabase
      .from('player_name')
      .upsert({ guest_id: user.id, name }, { onConflict: 'guest_id' })
      .then(({ error }) => {
        if (error) console.warn('player_name upsert on sign-in failed', error);
      });
  }, [isAuthed, user?.id]);

  React.useEffect(() => {
    // Always ensure the name row exists (covers practice runs too)
    upsertPlayerNameNow(supabase, playerId, displayName);
  }, [supabase, playerId, displayName]);

  console.debug('identity', { userId: user?.id, guestId, playerId, isAuthed });
  
  // Like state
  const [liked, setLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);

  // Local name is already initialized from localStorage in useState

  // Keep missesRef in sync with misses state
  useEffect(() => { 
    missesRef.current = misses; 
  }, [misses]);

  React.useEffect(() => {
    if (user?.id && guestId) {
      linkGuestToProfile(supabase, user.id, guestId);
    }
  }, [user?.id, guestId]);

  // Load like data for current image
  useEffect(() => {
    let ignore = false;
    async function loadLikes() {
      if (!imageId) return;
      const [likedRes, countRes] = await Promise.all([
        supabase.from('image_likes')
          .select('image_id')
          .eq('image_id', imageId)
          .eq('guest_id', playerId)
          .maybeSingle(),
        supabase.from('image_like_counts')
          .select('likes')
          .eq('image_id', imageId)
          .maybeSingle(),
      ]);
      if (ignore) return;
      setLiked(!!likedRes.data);
      setLikeCount(countRes.data?.likes ?? 0);
      console.debug('like.init', { imageId, playerId, liked: !!likedRes.data, count: countRes.data?.likes ?? 0 });
    }
    loadLikes();
    return () => { ignore = true; };
  }, [imageId, playerId]);

  // Lock round function
  function lockRound() {
    isRoundOverRef.current = true;
    setIsRoundOver(true);
  }

  async function goToNextImage() {
    try {
      const { data, error } = await supabase
        .from('images')
        .select('id')
        .neq('id', imageId)         // avoid reloading the same image
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('next image fetch failed', error);
        router.push('/feed'); // fallback
        return;
      }

      const nextId = data?.[0]?.id;
      if (nextId) router.push(`/play-db/${nextId}`);
      else router.push('/feed');
    } catch (e) {
      console.warn('next image exception', e);
      router.push('/feed');
    }
  }

  // load image + latest target
  useEffect(() => {
    return () => stopGameTimer();
  }, []);

  // load image + latest target
  useEffect(() => {
    if (!imageId) return;
    (async () => {
      setStatus("loading");
      setErr("");
      // image
      const { data: imgRow, error: imgErr } = await supabase
        .from("images")
        .select("id, public_url, width, height, description, title, location")
        .eq("id", imageId)
        .single();
      if (imgErr || !imgRow) {
        setErr(imgErr?.message ?? "Image not found");
        setStatus("error");
        return;
      }
      setImg(imgRow as ImageRow);
      // latest target for image
      const { data: tRows, error: tErr } = await supabase
        .from("targets")
        .select("id, image_id, cx, cy, radius, created_at")
        .eq("image_id", imageId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (tErr) {
        setErr(tErr.message);
        setStatus("error");
        return;
      }
      setTarget((tRows?.[0] as TargetRow) ?? null);
      setStatus("ready");
    })();
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [imageId]);

  // start timer when image finishes loading (only if game has started)
  function handleImageLoad() {
    if (started) {
      setStartTime(performance.now());
      // animation frame loop for smoother timer
      const tick = () => {
        setElapsed((prev) => {
          if (startTime === null) return prev;
          return (performance.now() - startTime) / 1000;
        });
        timerRef.current = requestAnimationFrame(tick);
      };
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      timerRef.current = requestAnimationFrame(tick);
      // keep any existing flags, then start timer
      startGameTimer();
    }
  }

  function handleStart() {
    setStarted(true);
    setImgSrc(img?.public_url || null);
    const now = performance.now();
    setStartTime(now);
    roundStartTimeRef.current = now;
    // animation frame loop for smoother timer
    const tick = () => {
      setElapsed((prev) => {
        if (startTime === null) return prev;
        return (performance.now() - startTime) / 1000;
      });
      timerRef.current = requestAnimationFrame(tick);
    };
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    timerRef.current = requestAnimationFrame(tick);
    startGameTimer();
  }

  function handleGiveUp() {
    if (isRoundOverRef.current) return;
    
    setImgSrc(null);
    endRoundGiveUp();
  }

  function startGameTimer() {
    if (gameTimerIdRef.current) clearInterval(gameTimerIdRef.current);
    gameStartRef.current = performance.now();
    setElapsedMs(0);
    gameTimerIdRef.current = window.setInterval(() => {
      setElapsedMs(performance.now() - gameStartRef.current);
    }, 50);
  }

  function stopGameTimer() {
    if (gameTimerIdRef.current) {
      clearInterval(gameTimerIdRef.current);
      gameTimerIdRef.current = null;
    }
  }

  function stopTimer() {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    timerRef.current = null;
  }

  function resetRound() {
    setElapsed(0);
    setStartTime(null);
    setStatus("ready");
    setWinMs(0);
    setHasSavedScore(false);
    setSaved(false);
    setSaveError('');
    setStarted(false);
    setImgSrc(null);
    setEloResult(null);
    setMisses(0);
    setIsSaving(false);
    setIsRoundOver(false);
    setLastMissAt(0);
    setRoundSummary(null);
    roundStartTimeRef.current = 0;
    setEndReason('');
    isRoundOverRef.current = false;
    missesRef.current = 0;
    lastMissAtRef.current = 0;
  }



  // handlePlayerNameChange removed - now using localName state

  function handleChangeName() {
    const current = getStoredName() ?? '';
    const input = window.prompt('Update your display name (optional):', current);
    if (input != null) {
      const sanitized = sanitizeName(input);
      setStoredName(sanitized || null);
    }
  }

  // Centralized end-round functions with explicit result and rated logic
  async function endRoundSuccess() {
    stopTimer();
    stopGameTimer();
    setStatus("found");
    lockRound();
    

    const baselineMs = await getBaselineForImageP60(supabase, imageId!);
    const rawMs = Math.max(0, Math.round(performance.now() - roundStartTimeRef.current));
    const usedMs = buildUsedMs(rawMs, missesRef.current, baselineMs);

    let name = getStoredName();
    if (!name) {
      const input = window.prompt('Enter a display name (optional):', '');
      if (input != null) {
        const sanitized = sanitizeName(input);
        name = sanitized || null;
        setStoredName(name);
      }
    }

    const solvedBefore = await hasSolvedBefore(supabase, playerId, imageId!);
    const rated = !solvedBefore;
    let elo = null;
    if (rated) {
      elo = await applyEloForRound(supabase, {
        guestId: playerId,
        playerName: displayName,
        imageId: imageId!,
        durationMs: usedMs,
        baselineMs,
        misses: missesRef.current
      });
    }

    await supabase.from('scores').insert([{
      image_id: imageId,
      guest_id: playerId,
      player_name: displayName,
      ms: rawMs,
      duration_ms: usedMs,
      wrong_clicks: missesRef.current,
      rating: null,
      result: 'success',
      rated,
      elo_player_before: elo?.playerBefore ?? null,
      elo_image_before: elo?.imageBefore ?? null,
      elo_player_after: elo?.playerAfter ?? null,
      elo_image_after: elo?.imageAfter ?? null,
    }]).select('id');

    const savedName = isAuthed ? deriveClerkDisplayName(user) : localName;
    await supabase
      .from('player_name')
      .upsert({ guest_id: playerId, name: savedName }, { onConflict: 'guest_id' });

    setRoundSummary({
      hardStop: false,
      timeMs: usedMs,
      perfPct: pctVsBaseline(usedMs, baselineMs),
      eloBefore: elo?.playerBefore ?? 0,
      eloAfter: elo?.playerAfter ?? 0,
      penalty: elo?.penalty ?? 0,
      baseDelta: elo?.baseDelta ?? 0,
      totalDelta: elo?.totalDelta ?? 0,
      isPractice: !rated,
    });

    console.debug({ 
      tag: 'finish', 
      result: 'success', 
      rated, 
      misses: missesRef.current, 
      usedMs, 
      solvedBefore 
    });
    
    setSaved(true);
  }

  async function endRoundHardStop() {
    stopTimer();
    stopGameTimer();
    setStatus("found");
    lockRound();
    

    const baselineMs = await getBaselineForImageP60(supabase, imageId!);
    const rawMs = Math.max(0, Math.round(performance.now() - roundStartTimeRef.current));
    const penalized = Math.round(rawMs * 1.40);
    const verySlow = Math.round(baselineMs * 6);
    const usedMs = Math.max(penalized, verySlow);

    let name = getStoredName();
    if (!name) {
      const input = window.prompt('Enter a display name (optional):', '');
      if (input != null) {
        const sanitized = sanitizeName(input);
        name = sanitized || null;
        setStoredName(name);
      }
    }

    const solvedBefore = await hasSolvedBefore(supabase, playerId, imageId!);
    const rated = !solvedBefore;       // fail affects rating only until first success exists
    let elo = null;
    if (rated) {
      elo = await applyEloForRound(supabase, {
        guestId: playerId,
        playerName: displayName,
        imageId: imageId!,
        durationMs: usedMs,
        baselineMs,
        misses: 10,
        sOverride: 0.05,
        overrideK: 16
      });
    }

    await supabase.from('scores').insert([{
      image_id: imageId,
      guest_id: playerId,
      player_name: displayName,
      ms: rawMs,
      duration_ms: usedMs,
      wrong_clicks: 10,
      rating: null,
      result: 'hard_stop',
      rated,
      elo_player_before: elo?.playerBefore ?? null,
      elo_image_before: elo?.imageBefore ?? null,
      elo_player_after: elo?.playerAfter ?? null,
      elo_image_after: elo?.imageAfter ?? null,
    }]).select('id');

    const savedName = isAuthed ? deriveClerkDisplayName(user) : localName;
    await supabase
      .from('player_name')
      .upsert({ guest_id: playerId, name: savedName }, { onConflict: 'guest_id' });

    setRoundSummary({
      hardStop: true,
      timeMs: usedMs,
      perfPct: pctVsBaseline(usedMs, baselineMs),
      eloBefore: elo?.playerBefore ?? 0,
      eloAfter: elo?.playerAfter ?? 0,
      penalty: elo?.penalty ?? 0,
      baseDelta: elo?.baseDelta ?? 0,
      totalDelta: elo?.totalDelta ?? 0,
      isPractice: !rated,
    });

    console.debug({ 
      tag: 'finish', 
      result: 'hard_stop', 
      rated, 
      misses: missesRef.current, 
      usedMs, 
      solvedBefore 
    });
    
    setSaved(true);
  }

  async function endRoundGiveUp() {
    stopTimer();
    stopGameTimer();
    setStatus("found");
    lockRound();
    

    const baselineMs = await getBaselineForImageP60(supabase, imageId!);
    const rawMs = Math.max(0, Math.round(performance.now() - roundStartTimeRef.current));
    const penalized = Math.round(rawMs * 1.40);
    const verySlow = Math.round(baselineMs * 6);
    const usedMs = Math.max(penalized, verySlow);

    let name = getStoredName();
    if (!name) {
      const input = window.prompt('Enter a display name (optional):', '');
      if (input != null) {
        const sanitized = sanitizeName(input);
        name = sanitized || null;
        setStoredName(name);
      }
    }

    const solvedBefore = await hasSolvedBefore(supabase, playerId, imageId!);
    const rated = !solvedBefore;
    let elo = null;
    if (rated) {
      elo = await applyEloForRound(supabase, {
        guestId: playerId,
        playerName: displayName,
        imageId: imageId!,
        durationMs: usedMs,
        baselineMs,
        misses: missesRef.current,
        sOverride: 0.05,
        overrideK: 16
      });
    }

    await supabase.from('scores').insert([{
      image_id: imageId,
      guest_id: playerId,
      player_name: displayName,
      ms: rawMs,
      duration_ms: usedMs,
      wrong_clicks: missesRef.current,
      rating: null,
      result: 'give_up',
      rated,
      elo_player_before: elo?.playerBefore ?? null,
      elo_image_before: elo?.imageBefore ?? null,
      elo_player_after: elo?.playerAfter ?? null,
      elo_image_after: elo?.imageAfter ?? null,
    }]).select('id');

    const savedName = isAuthed ? deriveClerkDisplayName(user) : localName;
    await supabase
      .from('player_name')
      .upsert({ guest_id: playerId, name: savedName }, { onConflict: 'guest_id' });

    setRoundSummary({
      hardStop: true,
      timeMs: usedMs,
      perfPct: pctVsBaseline(usedMs, baselineMs),
      eloBefore: elo?.playerBefore ?? 0,
      eloAfter: elo?.playerAfter ?? 0,
      penalty: elo?.penalty ?? 0,
      baseDelta: elo?.baseDelta ?? 0,
      totalDelta: elo?.totalDelta ?? 0,
      isPractice: !rated,
    });

    console.debug({ 
      tag: 'finish', 
      result: 'give_up', 
      rated, 
      misses: missesRef.current, 
      usedMs, 
      solvedBefore 
    });
    
    setSaved(true);
  }

  function handleClick(e: React.MouseEvent) {
    if (isRoundOverRef.current) return;
    if (missesRef.current >= 10) return;

    const now = performance.now();
    if (now - lastMissAtRef.current < MISS_COOLDOWN_MS) return;

    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect || !imgRef.current || !img || !target || status !== "ready" || !started) return;
    
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const renderedW = rect.width;
    const renderedH = rect.height;

    const naturalW = img.width ?? imgRef.current.naturalWidth ?? renderedW;
    const naturalH = img.height ?? imgRef.current.naturalHeight ?? renderedH;

    const cxNat = (clickX * naturalW) / renderedW;
    const cyNat = (clickY * naturalH) / renderedH;

    const dx = cxNat - target.cx;
    const dy = cyNat - target.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hit = dist <= target.radius;

    if (hit) {
      if (missesRef.current >= 10) return; // belt-and-suspenders
      endRoundSuccess();
      return;
    }

    // Miss
    const newMisses = Math.min(10, missesRef.current + 1);
    setMisses(newMisses);
    missesRef.current = newMisses;
    lastMissAtRef.current = now;

    if (newMisses >= 10) {
      endRoundHardStop();   // immediate forced fail
    }
  }

  if (status === "loading") {
    return <div className="max-w-4xl mx-auto p-6 text-gray-200">Loading…</div>;
  }
  if (status === "error" || !img) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          {err || "Something went wrong"}
        </div>
        <div className="mt-4">
          <a className="text-blue-500 hover:underline" href="/upload">← Back to Upload</a>
        </div>
      </div>
    );
  }

  // No target set yet
  if (!target) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="p-8 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              Target not set yet for this image
            </h2>
            <p className="text-yellow-700 mb-6">
              Someone needs to define the target location before this image can be played.
            </p>
            <a
              href={`/set-target/${imageId}`}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
            >
              Set Target
            </a>
          </div>
        </div>
      </div>
    );
  }

  const shortId = (id: string) => id.length > 12 ? id.slice(0, 8) + '…' : id;
  const imageTitle = img.title?.trim() || shortId(img.id);

  // Debug logging for render
  console.debug('like.render', { imageId, playerId, liked, likeCount });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-100">Play (DB)</h1>
          {started && (
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>Time: {((status === "found" ? winMs : elapsedMs) / 1000).toFixed(2)}s</span>
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                Misses: {misses}/10
              </span>
            </div>
          )}
        </div>

        <LikeButton
          imageId={imageId!}
          guestId={playerId}
          initialLiked={liked}
          initialCount={likeCount}
          className="shrink-0 text-white hover:text-red-400"
          onChanged={(nextLiked, nextCount) => {
            setLiked(nextLiked);
            setLikeCount(nextCount);
            console.debug('like.changed', { nextLiked, nextCount });
          }}
        />
      </header>
      
      <p className="text-gray-300 mb-4">Find the hidden spot in this image. Click when you spot it!</p>
      {img.description?.trim() && (
        <div className="text-sm text-gray-400 mb-2">Find: {img.description.trim()}</div>
      )}

      <div className="relative inline-block select-none">
        {/* Placeholder before start or after give up */}
        {(!imgSrc || status === "gaveUp") && (
          <div 
            className="rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center"
            style={{
              width: img?.width ? Math.min(img.width, 800) : 600,
              height: img?.height ? Math.min(img.height * (Math.min(img.width || 800, 800) / (img.width || 800)), 600) : 400
            }}
          >
            <div className="text-gray-500 text-center">
              <div className="text-4xl mb-2">🖼️</div>
              <div className="text-sm">Image will load when you start</div>
            </div>
          </div>
        )}

        {/* Actual image (only when playing or won) */}
        {imgSrc && status !== "gaveUp" && (
          <div className={isRoundOverRef.current ? 'pointer-events-none' : ''}>
            <img
              ref={imgRef}
              src={imgSrc}
              alt="play"
              className={`max-w-full rounded-lg border border-gray-700 ${started && status === "ready" ? "cursor-crosshair" : "cursor-default"}`}
              onLoad={handleImageLoad}
              onClick={handleClick}
            />
          </div>
        )}

        {/* Pre-game start overlay */}
        {!started && status === "ready" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 max-w-md mx-4 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">{imageTitle}</h2>
              {img.location?.trim() && (
                <p className="text-sm text-gray-600 mb-3">{img.location.trim()}</p>
              )}
              {img.description?.trim() && (
                <p className="text-sm text-gray-700 mb-4 italic">Find: {img.description.trim()}</p>
              )}
              <button
                onClick={handleStart}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium text-lg"
              >
                Start
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Give up button while playing */}
      {started && status === "ready" && !isRoundOver && (
        <div className="mt-4 text-center">
          <button
            onClick={handleGiveUp}
            className="px-4 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Give Up
          </button>
        </div>
      )}

      {/* Give up end panel */}
      {status === "gaveUp" && (
        <div className="mt-6 p-4 rounded-lg bg-gray-50 border border-gray-200 text-center">
          <div className="text-2xl mb-2">😔</div>
          <div className="text-gray-700 mb-4">You gave up</div>
          
          <div className="flex gap-3 justify-center">
            <button
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              onClick={resetRound}
            >
              Play Again
            </button>
            <a className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700" href="/feed">
              Back to Feed
            </a>
            <button className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-800" onClick={goToNextImage}>
              Next Level
            </button>
          </div>
        </div>
      )}

      {/* Win panel */}
      {status === "found" && (
        <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200 text-center">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-green-700 mb-1">
            {roundSummary?.hardStop ? 'Better luck next time!' : 'You found it!'}
          </div>
          <div className="text-gray-700 mb-2">
            Time: {roundSummary ? (roundSummary.timeMs / 1000).toFixed(2) : (winMs / 1000).toFixed(2)}s {misses > 0 && `(${misses} misses)`}
          </div>
          
          <div className="mb-4">
            <LikeButton
              imageId={imageId!}
              guestId={playerId}
              initialLiked={liked}
              initialCount={likeCount}
              className="text-gray-700 hover:text-red-500"
              onChanged={(nextLiked, nextCount) => {
                setLiked(nextLiked);
                setLikeCount(nextCount);
                console.debug('like.changed', { nextLiked, nextCount });
              }}
            />
          </div>
          
          {roundSummary && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-800 font-medium">
                New rating: {roundSummary.eloAfter} (was {roundSummary.eloBefore})
              </div>
              <div className="text-blue-600 text-sm">
                Performance vs baseline: {roundSummary.perfPct}% {roundSummary.perfPct > 0 ? 'faster' : 'slower'}
              </div>
              {misses > 0 && roundSummary.penalty > 0 && !roundSummary.isPractice && (
                <div className="text-red-600 text-sm">
                  Miss penalty: −{roundSummary.penalty} pts
                </div>
              )}
              {roundSummary.isPractice && (
                <div className="text-gray-500 text-sm">
                  Practice run — rating unchanged.
                </div>
              )}
            </div>
          )}
          
          {!isAuthed ? (
            <>
              <div className="text-sm mt-4 mb-1">Your name (optional)</div>
              <input
                value={localName}
                onChange={(e) => {
                  setLocalName(e.target.value);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('player_name', e.target.value);
                  }
                }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Your name"
              />
            </>
          ) : (
            <div className="text-sm text-muted-foreground mt-4">
              Saved as <span className="font-medium">{displayName}</span>
            </div>
          )}

          {/* Auto-save status */}
          <div className="mb-4">
            {isSaving ? (
              <div className="text-blue-600">Saving…</div>
            ) : saved ? (
              <div className="text-green-600">Saved!</div>
            ) : null}
          </div>

          <div className="flex gap-3 justify-center mb-4">
            <button
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              onClick={resetRound}
            >
              Play Again
            </button>
            <button className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-800" onClick={goToNextImage}>
              Next Level
            </button>
          </div>

          <div className="mt-2">
            <button
              onClick={handleChangeName}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Change name
            </button>
          </div>

          {saveError && (
            <div className="text-red-600 text-sm">
              {saveError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
