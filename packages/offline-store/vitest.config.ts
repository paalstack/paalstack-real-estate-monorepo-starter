import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Polyfill IndexedDB for tests that use idb-keyval. The setup file
    // imports `fake-indexeddb/auto` which installs the global
    // `indexedDB`, `IDBKeyRange`, etc.
    setupFiles: ['./test/idb-setup.ts'],
    // Each test file runs in its own worker so fake-indexeddb state from
    // one test doesn't leak into the next.
    isolate: true,
  },
});
