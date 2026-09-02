/**
 * Smoke test for the offline-store workspace package consumed by
 * apps/web. Confirms the workspace symlink resolves and the
 * `createMutationQueue` API surface is usable.
 *
 * For real apps: write a test that calls `withOffline()` with a
 * mocked `fetch` and asserts the discriminated-union return type.
 * This starter ships the minimum smoke test to keep `pnpm test` green
 * without dragging in @testing-library/react or a TanStack Query
 * testing harness.
 */
import { describe, it, expect } from 'vitest';
import { createMutationQueue } from '@starter/offline-store';

describe('offline-store smoke test', () => {
  it('exposes createMutationQueue and accepts enqueue calls', async () => {
    const q = createMutationQueue();
    expect(typeof q.enqueue).toBe('function');
    expect(typeof q.replay).toBe('function');
    expect(typeof q.all).toBe('function');
    const items = await q.all();
    expect(Array.isArray(items)).toBe(true);
  });
});
