import { describe, it, expect, vi } from 'vitest';
import { normalizeToWebP, normalizeOnIdle } from '../src/photo-normalize';

describe('normalizeToWebP', () => {
  it('throws on non-image input', async () => {
    const blob = new Blob(['text'], { type: 'text/plain' });
    await expect(normalizeToWebP(blob, 0.85)).rejects.toThrow(/expected image/);
  });

  it('returns a Blob with type image/webp (jsdom env polyfills canvas)', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      await expect(normalizeToWebP(blob, 0.85)).rejects.toBeDefined();
      return;
    }
    const result = await normalizeToWebP(blob, 0.85);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/webp');
  });

  it('throws a specific error when OffscreenCanvas is undefined', async () => {
    const originalCIb = (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
    const originalOSC = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = async () =>
      ({ width: 1, height: 1, close: () => {} }) as unknown as ImageBitmap;
    delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    try {
      await expect(normalizeToWebP(blob, 0.85)).rejects.toThrow(/OffscreenCanvas/);
    } finally {
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOSC;
      (globalThis as { createImageBitmap?: unknown }).createImageBitmap = originalCIb;
    }
  });
});

describe('normalizeOnIdle', () => {
  it('defers to requestIdleCallback when available', async () => {
    const idleCallbacks: Array<() => void> = [];
    const ricMock = vi.fn((cb: () => void) => {
      idleCallbacks.push(cb);
      return 1;
    });
    (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback =
      ricMock;
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      const p = normalizeOnIdle(blob, 0.85);
      expect(ricMock).toHaveBeenCalled();
      idleCallbacks.forEach((cb) => cb());
      await expect(p).rejects.toBeDefined();
      return;
    }
    const p = normalizeOnIdle(blob, 0.85);
    expect(ricMock).toHaveBeenCalled();
    idleCallbacks.forEach((cb) => cb());
    const result = await p;
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/webp');
  });

  it('falls back to immediate when requestIdleCallback is unavailable', async () => {
    const original = (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      await expect(normalizeOnIdle(blob, 0.85)).rejects.toBeDefined();
    } else {
      const result = await normalizeOnIdle(blob, 0.85);
      expect(result.type).toBe('image/webp');
    }
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = original;
  });
});
