'use client';

import Link from 'next/link';
import { useIsAdmin } from '@/lib/admin';

export default function SetTargetButton({ imageId }: { imageId: string }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  return (
    <Link
      href={`/set-target/${imageId}`}
      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      Set Target
    </Link>
  );
}
