import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

type Req = { current_image_id: string; guest_id: string };

export async function POST(req: Request) {
  try {
    const { current_image_id, guest_id } = (await req.json().catch(() => ({}))) as Partial<Req>;

    const errs: string[] = [];
    if (!current_image_id) errs.push("current_image_id is required");
    if (!guest_id) errs.push("guest_id is required");
    if (errs.length) return NextResponse.json({ error: "invalid_payload", details: errs }, { status: 422 });

    const supabase = supabaseServer();

    // 1) Find current image timestamp
    const { data: cur, error: curErr } = await supabase
      .from("images")
      .select("created_at")
      .eq("id", current_image_id)
      .single();
    if (curErr || !cur) {
      return NextResponse.json({ error: "not_found", details: "current image not found" }, { status: 404 });
    }

    // Helper: returns first id in ids[] that guest hasn't played
    async function firstUnplayed(ids: string[]): Promise<string | null> {
      if (!ids.length) return null;
      const { data: played } = await supabase
        .from("scores")
        .select("image_id")
        .eq("guest_id", guest_id)
        .in("image_id", ids);
      const playedSet = new Set((played ?? []).map((r) => r.image_id));
      return ids.find((id) => id !== current_image_id && !playedSet.has(id)) ?? null;
    }

    // 2) Prefer: unplayed OLDER than current (desc)
    const { data: olderBatch } = await supabase
      .from("images")
      .select("id")
      .lt("created_at", cur.created_at as string)
      .order("created_at", { ascending: false })
      .limit(100);
    let nextId = await firstUnplayed((olderBatch ?? []).map((d) => d.id));

    // 3) Fallback: ANY unplayed (desc)
    if (!nextId) {
      const { data: allBatch } = await supabase
        .from("images")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(100);
      nextId = await firstUnplayed((allBatch ?? []).map((d) => d.id));
    }

    return NextResponse.json({ next_image_id: nextId ?? null }, { status: 200 });
  } catch (err: any) {
    console.error("next-image error:", err);
    return NextResponse.json({ error: "unexpected", details: String(err?.message ?? err) }, { status: 500 });
  }
}