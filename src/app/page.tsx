import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/feed');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Find the Sniper</h1>
        <p className="text-sm opacity-70">
          Spot the hidden target as fast as you can. Log in to start your first game!
        </p>
        <div className="mx-auto">
          <SignIn routing="hash" redirectUrl="/feed" />
        </div>
      </div>
    </main>
  );
}
