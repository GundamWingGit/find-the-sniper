import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/welcome");

  return (
    <main className="relative min-h-[80vh]">
      {/* page-local glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="mx-auto h-[900px] w-[1200px] max-w-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 30%, rgba(37,99,235,0.40), rgba(147,51,234,0.30), rgba(249,115,22,0.25) 80%)",
          }}
        />
      </div>

      <section className="mx-auto max-w-3xl px-6 pt-16 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold text-white">Find the Sniper</h1>

        <p className="mt-6 text-white/80 text-lg md:text-xl">
          It's like "Where's Waldo," except Waldo could be anything.
          Spot the target faster than everyone else to climb the ranks and earn rewards.
        </p>

        <div className="mt-10 flex items-center justify-center">
          <SignInButton mode="modal" afterSignInUrl="/welcome" afterSignUpUrl="/welcome">
            <button
              className="rounded-full bg-white/10 text-white/90 px-6 py-3 font-semibold hover:bg-white/20 hover:text-white transition backdrop-blur"
            >
              Sign in to play
            </button>
          </SignInButton>
        </div>

        <p className="mt-8 text-sm text-white/60">
          No spoilers: thumbnails are blurred. Bring your A-game.
        </p>
      </section>
    </main>
  );
}
