import { createClient } from "@supabase/supabase-js";

/**
 * Read env safely. If something is missing, fail fast with a clear message.
 * This will also log in the browser console when imported by a client component.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Helpful debug if envs aren't loading
  // (You should see this in the browser console on /supabase-test)
  console.error("Missing Supabase env vars", {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
  });
  throw new Error("Supabase env vars not loaded");
}

/** Shared Supabase client (browser) */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export default supabase;
