/**
 * `withOffline()` — minimal example of an offline-aware `useMutation`
 * wrapper built on top of `@starter/offline-store`.
 *
 * Pattern: keep your existing `useMutation` hooks for normal online
 * calls; wrap them in `withOffline()` only on forms that genuinely
 * need offline support (lead capture, photo upload, etc.).
 *
 * Return type is a discriminated union so the form can branch on
 * `kind` to decide "Saved" vs "Saved locally":
 *
 *   const m = withOffline({ mutationFn: ... });
 *   m.mutate(
 *     { endpoint: '/leads', method: 'POST', body: payload },
 *     {
 *       onSuccess: (res) => {
 *         if (res.kind === 'synced') { show 'Lead created' }
 *         if (res.kind === 'queued') { show 'Saved locally' }
 *       },
 *       onError: () => { show validation error from 4xx },
 *     }
 *   );
 *
 * Replace this with your app's actual mutation hooks. The starter
 * ships this as a *reference* — adapt to your domain.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { createMutationQueue, type Mutation, type OfflineMutationResult } from '@starter/offline-store';

const queue = createMutationQueue();

type OfflineArg = {
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body: unknown;
};

/**
 * Minimal example: a single offline-aware mutation that enqueues on
 * network failure. For real apps, you'll want multiple
 * typed-arg variants (JSON vs multipart for photo upload, etc.).
 */
export function withOffline(): UseMutationResult<OfflineMutationResult<unknown>, Error, OfflineArg> {
  return useMutation<OfflineMutationResult<unknown>, Error, OfflineArg>({
    mutationFn: async (arg) => {
      try {
        const res = await fetch(`/api/backend${arg.endpoint}`, {
          method: arg.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(arg.body),
          credentials: 'same-origin',
        });
        if (res.status >= 200 && res.status < 400) {
          const data = res.status === 204 ? undefined : await res.json();
          return { kind: 'synced' as const, data };
        }
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`API ${res.status}`);
        }
        // 5xx: enqueue
        const queued = await queue.enqueue({
          endpoint: arg.endpoint,
          method: arg.method,
          body: arg.body,
        } as Omit<Mutation, 'id' | 'createdAt' | 'retries'>);
        return { kind: 'queued' as const, id: queued.id, queuedAt: queued.createdAt };
      } catch (err) {
        if (err instanceof TypeError && /Failed to fetch|NetworkError/i.test(err.message)) {
          const queued = await queue.enqueue({
            endpoint: arg.endpoint,
            method: arg.method,
            body: arg.body,
          } as Omit<Mutation, 'id' | 'createdAt' | 'retries'>);
          return { kind: 'queued' as const, id: queued.id, queuedAt: queued.createdAt };
        }
        throw err;
      }
    },
  });
}
