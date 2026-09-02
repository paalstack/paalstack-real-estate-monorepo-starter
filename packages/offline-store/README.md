# @starter/offline-store

Platform-agnostic offline data store for the real-estate CRM starter. Provides the primitives both the PWA (`apps/web`) and the future Expo mobile app (`apps/mobile`, when added) need to operate offline.

> **Generic, client-agnostic.** The starter repo deliberately has no client name, brand, or domain. Don't add any here.

## What it provides

| Export | Purpose |
| --- | --- |
| `createMutationQueue()` | IDB-backed FIFO queue of pending mutations; replay on reconnect |
| `createPhotoStore()` | IDB blob store with quota-error retry + oldest-evict |
| `normalizeToWebP(blob, quality)` | Client-side image conversion (HEIC → WebP) |
| `normalizeOnIdle(blob, quality)` | `requestIdleCallback` wrapper for normalize (avoids 100-300ms main-thread stalls on cheap Android) |
| `resolveLWW(client, server)` | Last-Write-Wins conflict resolver (default; pluggable per mutation type) |
| `mutationStore`, `photoStore` (raw `idb-keyval` stores) | Direct access for the TanStack Query persister + SW replay handler |
| `types.ts` | `Mutation`, `OfflineState`, `ReplayResult`, `QueuedItem` |

## IDB schema

```
shadhil-offline DB
├── mutations store  (key: 'queue', value: Mutation[])  — append-only queue
├── photos store     (key: blob UUID, value: Blob)      — photo blobs awaiting upload
└── rq-cache store   (key: 'shadhil-rq-cache', value: serialized TanStack Query state)
```

(Database name `shadhil-offline` is a holdover from the upstream shadhil-crm reference. The starter inherits it; renaming would require a data migration for any field deployments.)

## Migration story

The DB is created lazily via `idb-keyval`'s `createStore()`. The current schema version is implicit (= 1).

**To add a new object store** (e.g. `drafts`): bump to `createStore('shadhil-offline', 'drafts')` and add it to the `STORE_NAMES` array in `src/idb-stores.ts`. The lazy `onupgradeneeded` handler will create the new store on the next call that opens the DB. **This has not been needed yet.**

**To change an existing object store's key shape or value schema** (breaking change): write a one-time migration that copies data from the old key shape to the new one, gated by the DB version. The current schema is intentionally minimal.

## Usage

```ts
import {
  createMutationQueue,
  createPhotoStore,
  normalizeOnIdle,
  resolveLWW,
} from '@starter/offline-store';

// Queue a mutation (call from a form submit handler)
const queue = createMutationQueue();
await queue.enqueue({ endpoint: '/leads', method: 'POST', body: { name: 'A' } });

// Replay on reconnect
const result = await queue.replay(async (m) => {
  const res = await fetch(`/api/backend${m.endpoint}`, {
    method: m.method,
    body: JSON.stringify(m.body),
  });
  return { status: res.status };
});

// Store a photo
const photo = createPhotoStore();
const blobKey = await photo.save(webpBlob);
```

## Testing

```bash
pnpm --filter @starter/offline-store test
```

All tests use `fake-indexeddb` (auto-imported in `test/idb-setup.ts`) to run against an in-memory IDB. No real browser required.
