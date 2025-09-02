import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// small helpers
const num = (v: any) => (typeof v === "string" ? Number(v) : v);
const isFiniteNum = (v: any) => typeof v === "number" && Number.isFinite(v);

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    // Normalize both image_id and imageId
    const image_id = raw.image_id ?? raw.imageId;
    const cx = num(raw.cx);
    const cy = num(raw.cy);
    const radius = num(raw.radius ?? 50);

    // Basic validation
    const errs: string[] = [];
    if (!image_id || typeof image_id !== "string") errs.push("image_id (uuid) is required");
    if (!isFiniteNum(cx)) errs.push("cx must be a finite number");
    if (!isFiniteNum(cy)) errs.push("cy must be a finite number");
    if (!isFiniteNum(radius) || radius <= 0) errs.push("radius must be a positive number");
    if (errs.length) {
      return NextResponse.json({ error: "invalid_payload", details: errs }, { status: 422 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("targets")
      .insert([{ image_id, cx, cy, radius }])
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "db_insert_failed", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err: any) {
    console.error("Unexpected /api/targets error:", err);
    return NextResponse.json({ error: "unexpected", details: String(err?.message ?? err) }, { status: 500 });
  }
}