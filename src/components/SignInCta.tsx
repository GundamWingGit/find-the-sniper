'use client';

import { useClerk } from '@clerk/nextjs';

type Props = { className?: string; children?: React.ReactNode };

export default function SignInCta({ className = '', children = 'Sign in to play' }: Props) {
  const { openSignIn } = useClerk();

  return (
    <button
      type="button"
      onClick={() =>
        openSignIn({
          // these control where users land after auth
          afterSignInUrl: '/welcome',
          afterSignUpUrl: '/welcome',
          // optional safety net if modal cannot open
          signInFallbackRedirectUrl: '/welcome',
        })
      }
      className={className}
    >
      {children}
    </button>
  );
}
