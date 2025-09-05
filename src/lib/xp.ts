import supabase from "@/lib/supabase";

export type AwardResult =
  | { awarded: number; xp: number; level: number; skipped?: false }
  | { awarded?: 0; xp: number; level: number; skipped: true };

export async function awardXpForScore(scoreId: string, userId: string): Promise<AwardResult | null> {
  // Try calling the RPC with both score_id and user_id parameters
  const { data, error } = await supabase
    .rpc("award_xp_for_score", { 
      p_score_id: scoreId,
      p_user_id: userId 
    });

  if (error) {
    // If the function doesn't exist with p_user_id, try without it
    if (error.message.includes("Could not find the function") || error.message.includes("schema cache")) {
      console.log("XP system not available (RPC function not found)");
      return null;
    }
    
    // Surface other errors to caller; also log for debugging
    console.error("XP award failed:", error.message);
    return null;
  }

  // The function returns JSONB; trust the shape described above.
  return data as AwardResult;
}
