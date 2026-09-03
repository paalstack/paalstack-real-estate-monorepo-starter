/**
 * TanStack React Query Configuration
 *
 * Configures the QueryClient with sensible defaults for:
 * - Retry logic
 * - Cache times
 * - Stale times
 * - Error handling
 * - Refetch behavior
 *
 * Round 26 (2026-09-03): removed the custom `retryDelay` function
 * from defaults. TanStack's built-in default is identical
 * (`Math.min(1000 * 2 ** attemptIndex, 30000)`); redefining it as a
 * function here meant any code path that serialized a Query (e.g. an
 * IDB persister via `qc.getQueryCache().getAll()`) hit a
 * `DataCloneError: Failed to execute 'put' on 'IDBObjectStore'`
 * because IndexedDB can't structured-clone functions. If you add a
 * persister later, use `dehydrate()` / `hydrate()` from
 * `@tanstack/react-query` — they strip non-cloneable fields by
 * design.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry failed requests by default
      retry: false,

      // Retry delay omitted — TanStack's built-in default is the
      // exponential backoff `Math.min(1000 * 2 ** attemptIndex, 30000)`.
      // See Round 26 above for why this is no longer set explicitly.

      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Cache data for 5 minutes after queries become inactive
      gcTime: 5 * 60 * 1000,

      // Refetch on window focus only in production
      refetchOnWindowFocus: process.env.NODE_ENV === 'production',

      // Refetch when network reconnects
      refetchOnReconnect: true,

      // Refetch on mount even if data is fresh
      refetchOnMount: true,
    },
    mutations: {
      // Don't retry mutations by default (override per mutation if needed)
      retry: 0,
    },
  },
});

/**
 * Create a separate query client for testing.
 * Configures no retries and an infinite cache to prevent test flakiness.
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
