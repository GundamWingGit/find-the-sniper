import Link from 'next/link';

export default function PlayIndex() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Ready to Play?</h1>
        <p className="text-sm opacity-70">
          Find the hidden sniper as fast as you can. Tap play to start your first round.
        </p>
        <div>
          <Link
            href="/play/1"
            className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Play
          </Link>
        </div>
      </div>
    </main>
  );
}
