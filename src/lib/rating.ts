import { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_BASELINE = 180000; // 3 minutes fallback

/**
 * Helper function to compute 60th percentile
 */
function percentile60(arr: number[]): number {
  if (!arr.length) return NaN;
  const a = arr.slice().sort((x, y) => x - y);
  const idx = Math.floor(0.60 * (a.length - 1));
  return a[idx];
}

/**
 * Gets the baseline time for an image (median of recent scores or global fallback)
 */
export async function getBaselineForImage(
  supabase: SupabaseClient,
  imageId: string
): Promise<number> {
  let baselineMs = DEFAULT_BASELINE;
  
  try {
    // 1. Try to get median from recent scores for this specific image
    const { data: imageScores } = await supabase
      .from('scores')
      .select('ms')
      .eq('image_id', imageId)
      .not('ms', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (imageScores && imageScores.length >= 10) {
      // Use image-specific median
      const times = imageScores.map(s => s.ms).sort((a, b) => a - b);
      const mid = Math.floor(times.length / 2);
      baselineMs = times.length % 2 === 0 
        ? (times[mid - 1] + times[mid]) / 2 
        : times[mid];
    } else {
      // 2. Fall back to global median
      const { data: globalScores } = await supabase
        .from('scores')
        .select('ms')
        .not('ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (globalScores && globalScores.length > 0) {
        const times = globalScores.map(s => s.ms).sort((a, b) => a - b);
        const mid = Math.floor(times.length / 2);
        baselineMs = times.length % 2 === 0 
          ? (times[mid - 1] + times[mid]) / 2 
          : times[mid];
      }
    }
  } catch (error) {
    console.warn('Baseline: Error fetching baseline data, using default:', error);
  }

  return baselineMs;
}

/**
 * Gets the P60 baseline time for an image (60th percentile of recent durations)
 */
export async function getBaselineForImageP60(
  supabase: SupabaseClient,
  imageId: string
): Promise<number> {
  try {
    // 1) Fetch last 200 durations for this image (non-null), newest first
    const { data: imageScores } = await supabase
      .from('scores')
      .select('duration_ms')
      .eq('image_id', imageId)
      .not('duration_ms', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);

    // 2) Compute P60 for this image (if at least 10 samples)
    if (imageScores && imageScores.length >= 10) {
      const durations = imageScores.map(s => s.duration_ms);
      const p60 = percentile60(durations);
      const baseline = Math.max(p60, DEFAULT_BASELINE);
      console.debug(`P60 Baseline: Using image P60 ${baseline}ms from ${durations.length} samples`);
      return baseline;
    }

    // 3) Else fetch last 500 durations globally and compute P60
    const { data: globalScores } = await supabase
      .from('scores')
      .select('duration_ms')
      .not('duration_ms', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (globalScores && globalScores.length > 0) {
      const durations = globalScores.map(s => s.duration_ms);
      const p60 = percentile60(durations);
      const baseline = Math.max(p60, DEFAULT_BASELINE);
      console.debug(`P60 Baseline: Using global P60 ${baseline}ms from ${durations.length} samples (image had ${imageScores?.length || 0})`);
      return baseline;
    }

    // 4) Return default if no data
    console.debug(`P60 Baseline: Using default ${DEFAULT_BASELINE}ms (no prior data)`);
    return DEFAULT_BASELINE;
  } catch (error) {
    console.warn('P60 Baseline: Error fetching baseline data, using default:', error);
    return DEFAULT_BASELINE;
  }
}

/**
 * Computes a 1-5 star rating for a completion time based on image-specific or global baselines
 */
export async function computeRatingForImage(
  supabase: SupabaseClient,
  imageId: string,
  durationMs: number
): Promise<number> {
  let baselineMs = DEFAULT_BASELINE;
  
  try {
    // 1. Try to get median from recent scores for this specific image
    const { data: imageScores } = await supabase
      .from('scores')
      .select('ms')
      .eq('image_id', imageId)
      .not('ms', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (imageScores && imageScores.length >= 10) {
      // Use image-specific median
      const times = imageScores.map(s => s.ms).sort((a, b) => a - b);
      const mid = Math.floor(times.length / 2);
      baselineMs = times.length % 2 === 0 
        ? (times[mid - 1] + times[mid]) / 2 
        : times[mid];
      console.debug(`Rating: Using image baseline ${baselineMs}ms from ${times.length} samples`);
    } else {
      // 2. Fall back to global median
      const { data: globalScores } = await supabase
        .from('scores')
        .select('ms')
        .not('ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (globalScores && globalScores.length > 0) {
        const times = globalScores.map(s => s.ms).sort((a, b) => a - b);
        const mid = Math.floor(times.length / 2);
        baselineMs = times.length % 2 === 0 
          ? (times[mid - 1] + times[mid]) / 2 
          : times[mid];
        console.debug(`Rating: Using global baseline ${baselineMs}ms from ${times.length} samples (image had ${imageScores?.length || 0})`);
      } else {
        console.debug(`Rating: Using default baseline ${baselineMs}ms (no prior data)`);
      }
    }
  } catch (error) {
    console.warn('Rating: Error fetching baseline data, using default:', error);
  }

  // 3. Compute rating using logistic function
  const ratio = durationMs / baselineMs;
  const k = 3; // steepness parameter
  const score01 = 1 / (1 + Math.exp(k * (ratio - 1)));
  
  let stars = Math.round(1 + 4 * score01);
  stars = Math.min(5, Math.max(1, stars));

  console.debug(`Rating computation: T0=${baselineMs}ms, duration=${durationMs}ms, ratio=${ratio.toFixed(2)}, score01=${score01.toFixed(3)}, stars=${stars}`);
  
  return stars;
}
