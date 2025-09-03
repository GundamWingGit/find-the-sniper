import Link from "next/link";
import WelcomeGuard from "@/components/WelcomeGuard";

export default function WelcomeAuthed() {
  return (
    <WelcomeGuard>
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
          <h1 className="text-4xl md:text-5xl font-semibold text-white">Welcome! 👋</h1>

          {/* Rules */}
          <p className="mt-6 text-white/80 text-lg md:text-xl">
            The rules are simple: we show you a real photo, you find the hidden target.
            The faster you click it, the more points you score. Miss 10 times and—oops—game over.
          </p>

          {/* Upload encouragement */}
          <p className="mt-3 text-white/75">
            Take a picture of anything, upload your own images, and send them to friends!
            The more your images are played and liked, the more rewards you earn.
          </p>

          {/* Single CTA */}
          <div className="mt-8 flex justify-center">
            <Link
              href="/feed"
              className="rounded-full bg-white/10 text-white/90 px-7 py-3 font-semibold
                         hover:bg-white/20 hover:text-white transition backdrop-blur"
            >
              Start Sniping
            </Link>
          </div>

          <p className="mt-8 text-sm text-white/60">
            Tip: scores are ranked by speed—and images level up with you.
          </p>
        </section>
      </main>
    </WelcomeGuard>
  );
}
