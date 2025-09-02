import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware({
  // Public routes that do NOT require auth
  publicRoutes: ['/', '/api/:path*', '/healthcheck.txt'],
});

export const config = {
  // Match all paths except Next internals and static files
  matcher: [
    '/((?!_next|.*\\..*).*)',
  ],
};
