import type { NextConfig } from 'next';

import withSerwistInit from '@serwist/next';

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Pages opt into dynamic rendering per-route (see src/app/page.tsx and
  // src/app/not-found.tsx) because the wrapped ThemeProvider from
  // @paalstack/react-ui reads localStorage on mount (theme persistence) and
  // Next 16's static prerender chokes on that. We can opt INTO per-page
  // static rendering once the theme flow is SSR-safe (Phase 2 hardening).

  // Empty turbopack config is required to suppress Next 16's warning
  // that a webpack-style plugin (withSerwistInit) is in use without
  // an explicit turbopack config. The Serwist warning above is the
  // more important signal: `@serwist/next` does not yet support
  // Turbopack (Sep 2026). Production builds still work because
  // Serwist emits the SW via a webpack-style pipeline at build time;
  // the warning is about HMR + SW coexistence in dev.
  // Followed recommendation from Serwist issue serwist/serwist#54.
  turbopack: {},

  transpilePackages: [
    '@paalstack/react-ui',
    '@paalstack/react-hooks',
    '@paalstack/react-icons',
    '@starter/ui-tokens',
    '@starter/auth',
    // Round 28 (2026-09-03) — added the rest of the workspace
    // packages the web app imports. @starter/auth transitively
    // pulls in @starter/database via its CJS dist (require() at
    // the top of packages/auth-client/dist/auth.js), and the BFF
    // route + offline pages import database/offline-store
    // directly. Without these entries, Next's bundler can't
    // resolve @starter/database through the pnpm workspace
    // symlink on Vercel (the symlink resolves to a package
    // whose main is ./dist/index.js, but Vercel's build doesn't
    // run pnpm build first, so dist/ doesn't exist at bundle
    // time). Transpiling the source instead of bundling the
    // emitted CJS bypasses the dist/ dependency entirely.
    '@starter/database',
    '@starter/api-types',
    '@starter/offline-store',
  ],

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'r2.cloudflarestorage.com' }],
  },

  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },

  headers: async () => [
    {
      source: '/:path*',
      headers: SECURITY_HEADERS,
    },
    {
      // PWA service worker: must allow control of the entire origin
      // scope, and must never be cached (browsers must re-validate the
      // SW on every page load so updates activate promptly).
      source: '/sw.js',
      headers: [
        { key: 'Service-Worker-Allowed', value: '/' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
    // Field-staff photo capture needs camera + geolocation. The rest of
    // the app stays locked-down. Per the plan's PWA work, loosening is
    // scoped to /leads/* and /visits/* (the field-data entry points).
    {
      source: '/leads/:path*',
      headers: [
        { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self)' },
      ],
    },
    {
      source: '/visits/:path*',
      headers: [
        { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self)' },
      ],
    },
  ],

  // Proxy NestJS BFF paths to the backend (SSE streams, OpenAPI docs).
  // Sentry, PostHog, and bundle-analyzer wiring are deferred to Phase 2 — they
  // were stripped with the starter boilerplate; bring them back when needed.
  skipTrailingSlashRedirect: true,
  rewrites: async () => [
    {
      source: '/api/backend/:path*',
      destination: `${process.env.BACKEND_API_URL ?? 'http://localhost:8080'}/:path*`,
    },
    {
      source: '/api/docs',
      destination: `${process.env.BACKEND_API_URL ?? 'http://localhost:8080'}/api/docs`,
    },
  ],
};

export default withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Don't register SW in dev — Turbopack HMR + SW is a known footgun.
  // Production build emits the bundled SW into public/sw.js.
  disable: process.env.NODE_ENV === 'development',
  // Cap precache at 5MB; a single analytics chunk can blow this otherwise.
  maximumFileSizeToCacheInBytes: 5_000_000,
})(nextConfig);
