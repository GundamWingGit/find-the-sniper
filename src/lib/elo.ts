import { SupabaseClient } from '@supabase/supabase-js';

// Constants
const K_DEFAULT = 20;      // Default Elo K factor
const MISS_STD_DEDUCTION = 20; // "D" standard deduction for miss penalty

/**
 * Computes miss penalty points based on number of misses
 */
function missPenaltyPoints(misses: number): number {
  const scale = Math.min(1, Math.max(0, misses / 7)); // 0..1, full by 7
  return Math.round(MISS_STD_DEDUCTION * scale);      // 0..20
}

/**
 * Computes a gentler performance score from duration ratio
 */
function softPerformanceScore(durationUsedMs: number, baselineMs: number): {
  ratio: number; 
  Sraw: number; 
  Smapped: number;
} {
  const ratio = durationUsedMs / Math.max(1, baselineMs);
  const c = 1.20;    // center: slightly slower than baseline
  const k = 0.90;    // gentle slope
  const Sraw = 1 / (1 + Math.exp(k * (ratio - c))); // 0..1, higher = better
  const Smapped = 0.08 + 0.84 * Sraw; // clamp into [0.08, 0.92]
  return { ratio, Sraw, Smapped };
}

export type EloArgs = {
  guestId: string; 
  playerName: string | null; 
  imageId: string;
  durationMs: number; 
  baselineMs: number;
  misses: number;
  overrideK?: number; 
  sOverride?: number;
};

export type EloResult = {
  playerBefore: number; 
  playerAfter: number;
  imageBefore: number;  
  imageAfter: number;
  S: number; 
  E: number; 
  ratio: number; 
  baselineMs: number;
  durationUsed: number;
  baseDelta: number;
  penalty: number;
  totalDelta: number;
};

export async function applyEloForRound(
  supabase: SupabaseClient,
  params: EloArgs
): Promise<EloResult> {
  const { guestId, playerName, imageId, durationMs, baselineMs, misses, overrideK, sOverride } = params;
  // 1) Fetch or init player rating
  let { data: playerData } = await supabase
    .from('player_ratings')
    .select('*')
    .eq('guest_id', guestId)
    .single();

  let playerRating = 1500;
  let gamesPlayed = 0;

  if (!playerData) {
    // Insert new player
    const { data: newPlayer, error: playerError } = await supabase
      .from('player_ratings')
      .insert({
        guest_id: guestId,
        player_name: playerName || null,
        rating: 1500,
        games_played: 0
      })
      .select('*')
      .single();
    
    if (playerError) throw playerError;
    playerData = newPlayer;
  } else {
    // Update player name if provided and different
    if (playerName && playerName !== playerData.player_name) {
      await supabase
        .from('player_ratings')
        .update({ player_name: playerName })
        .eq('guest_id', guestId);
    }
  }

  playerRating = playerData.rating;
  gamesPlayed = playerData.games_played;

  // 2) Fetch or init image rating
  let { data: imageData } = await supabase
    .from('image_ratings')
    .select('*')
    .eq('image_id', imageId)
    .single();

  let imageRating = 1500;
  let attempts = 0;

  if (!imageData) {
    // Insert new image rating
    const { data: newImage, error: imageError } = await supabase
      .from('image_ratings')
      .insert({
        image_id: imageId,
        rating: 1500,
        attempts: 0
      })
      .select('*')
      .single();
    
    if (imageError) throw imageError;
    imageData = newImage;
  }

  imageRating = imageData.rating;
  attempts = imageData.attempts;

  // 3) Compute S from performance using softer mapping
  let S: number;
  let ratio: number;
  let S_raw: number;
  
  if (typeof sOverride === 'number') {
    // Use forced override (clamped 0..1)
    S = Math.min(1, Math.max(0, sOverride));
    ratio = durationMs / Math.max(1, baselineMs);
    S_raw = NaN; // Not computed when overridden
  } else {
    // Compute using soft performance mapping
    const perf = softPerformanceScore(durationMs, baselineMs);
    S = perf.Smapped;
    ratio = perf.ratio;
    S_raw = perf.Sraw;
  }

  // 4) Elo expected score
  const diff = playerRating - imageRating;
  const E = 1 / (1 + Math.pow(10, -(diff / 400)));

  // 5) Update ratings with miss penalty
  const K = overrideK ?? K_DEFAULT; // Use constant
  const baseDelta = Math.round(K * (S - E));  // Δperf
  const penalty = missPenaltyPoints(misses);   // 0..20
  const totalDelta = baseDelta - penalty;      // Δ = Δperf + Δmiss (Δmiss is negative)

  const newPlayer = playerRating + totalDelta;
  const newImage = imageRating - baseDelta; // only mirror the perf part to image

  // 6) Persist updates
  const now = new Date().toISOString();

  // Update player rating
  await supabase
    .from('player_ratings')
    .update({
      rating: newPlayer,
      games_played: gamesPlayed + 1,
      updated_at: now
    })
    .eq('guest_id', guestId);

  // Update image rating
  await supabase
    .from('image_ratings')
    .update({
      rating: newImage,
      attempts: attempts + 1,
      updated_at: now
    })
    .eq('image_id', imageId);

  console.debug(`Elo update: baseline=${baselineMs}ms, ratio=${ratio.toFixed(2)}, S=${S.toFixed(3)}, E=${E.toFixed(3)}, K=${K}, sOverride=${sOverride}, player ${playerRating}→${newPlayer}, image ${imageRating}→${newImage}`);

  // Debug logging before return
  console.debug({
    tag: 'elo.apply', 
    durationMs, 
    baselineMs, 
    ratio,
    S_raw, 
    S, 
    K, 
    playerBefore: playerRating, 
    playerAfter: newPlayer, 
    imageBefore: imageRating, 
    imageAfter: newImage
  });
  
  console.debug({ 
    tag: 'elo', 
    K, 
    S, 
    ratio, 
    before: playerRating, 
    after: newPlayer 
  });

  // 7) Return result
  return {
    playerBefore: playerRating,
    playerAfter: newPlayer,
    imageBefore: imageRating,
    imageAfter: newImage,
    S,
    E,
    ratio,
    baselineMs,
    durationUsed: durationMs,
    baseDelta,
    penalty,
    totalDelta
  };
}
