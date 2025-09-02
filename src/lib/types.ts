export type ScoreRow = {
  id: string;
  image_id: string;
  guest_id: string | null;
  player_name: string | null;
  ms: number;
  duration_ms?: number | null;
  created_at: string;
  rating?: number | null;
  image?: { id: string; public_url: string; title?: string | null; location?: string | null } | null;
};
