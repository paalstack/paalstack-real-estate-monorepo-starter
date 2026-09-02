import { cn } from '@paalstack/react-ui/lib';
import { type Metadata, type Viewport } from 'next';
import { Inter } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import { type ReactNode } from 'react';

import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';
import { InstallPrompt } from '@/components/install-prompt';
import { Providers } from '@/providers';

import '@/styles/globals.css';

// Inter — brand font. Loaded via next/font (self-hosted, preloaded,
// no external Google Fonts CDN requests). The `--font-inter` CSS
// variable that next/font sets on <body> is wired to Tailwind's
// `font-sans` utility via `--font-sans` in apps/web/src/styles/globals.css.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Real Estate Starter',
    default: 'Real Estate Starter',
  },
  description:
    'Real-estate CRM for PaalStack — Lead Inbox, Site Visits, Bookings, Chat, Reminders.',
  keywords: ['CRM', 'Real Estate', 'PaalStack', 'Lead Management'],
  authors: [{ name: 'PaalStack' }],
  creator: 'PaalStack',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    title: 'Real Estate Starter',
    description: 'Real-estate CRM for PaalStack',
    siteName: 'Real Estate Starter',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real Estate Starter',
    description: 'Real-estate CRM for PaalStack',
  },
  robots: {
    index: false, // Internal CRM — not indexed
    follow: false,
  },
  // PWA manifest. Next.js file convention `app/manifest.ts` is auto-served
  // at `/manifest.webmanifest`. We serve the manifest as a static file
  // instead (apps/web/public/manifest.webmanifest) — see the comment on
  // the proxy.ts matcher: Vercel Deployment Protection intercepts the
  // route-handler-served manifest URL with 307, breaking Lighthouse's
  // installability check. The static file bypasses the edge auth.
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Real Estate Starter',
    // `black-translucent` lets the WebView's status bar float over the
    // app's surface — required for iOS "Add to Home Screen" to render
    // a real splash instead of a screenshot.
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Do NOT pin maximumScale — pinch-zoom is a WCAG 1.4.4 accessibility
  // requirement (and Android Chrome honors the pin, locking out low-vision
  // users). iOS ignores it anyway.
  viewportFit: 'cover', // let content extend under notches; safe-area padding below
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1e' },
  ],
};

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, 'font-sans antialiased')}>
        <NextTopLoader showSpinner={false} height={5} color="var(--foreground)" />
        <Providers>
          {children}
          <ServiceWorkerRegistrar />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
