import supabase from "@/lib/supabase";

export type AwardResult =
  | { awarded: number; xp: number; level: number; skipped?: false }
  | { awarded?: 0; xp: number; level: number; skipped: true; reason?: string };

export async function awardXpForScore(scoreId: string, clerkUserId: string): Promise<AwardResult | null> {
  const { data, error } = await supabase.rpc("award_xp_for_score", {
    p_score_id: scoreId,
    p_user_id: clerkUserId,
  });

  if (error) {
    console.error("XP award failed:", error.message);
    return null;
  }
  return data as AwardResult;
}