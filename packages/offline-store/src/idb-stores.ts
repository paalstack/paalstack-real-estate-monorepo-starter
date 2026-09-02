import { type UseStore } from 'idb-keyval';

/**
 * idb-keyval store handles. `createStore` returns a `UseStore` callback
 * that's passed as the `customStore` argument to the top-level `get`,
 * `set`, `clear`, `del`, `keys` functions.
 *
 * Why we open the DB explicitly with all stores at version 1: the
 * upstream `createStore` calls `indexedDB.open(dbName)` with no version,
 * so the upgrade callback only runs the FIRST time a store name is
 * requested. Subsequent stores on the same DB never trigger an upgrade
 * and end up not existing at runtime (`NotFoundError: No objectStore
 * named X`). To avoid this, we open the DB explicitly with all known
 * store names and version 1, then wrap each `createStore` invocation
 * in a check.
 *
 * Migration: see README.md "Migration story" section. Schema changes
 * that add a new store need no version bump. Schema changes that modify
 * an existing store's key shape require the upgrade callback.
 */
const DB_NAME = 'shadhil-offline';
const DB_VERSION = 1;
const STORE_NAMES = ['mutations', 'photos', 'rq-cache'] as const;
type StoreName = typeof STORE_NAMES[number];

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
};

const storeNameToUseStore: Record<StoreName, UseStore> = {
  mutations: undefined!,
  photos: undefined!,
  'rq-cache': undefined!,
};

for (const name of STORE_NAMES) {
  storeNameToUseStore[name] = (txMode, callback) =>
    openDb().then((db) => callback(db.transaction(name, txMode).objectStore(name)));
}

export const mutationStore: UseStore = storeNameToUseStore.mutations;
export const photoStore: UseStore = storeNameToUseStore.photos;
export const rqCacheStore: UseStore = storeNameToUseStore['rq-cache'];

/**
 * Key under which the serialized TanStack Query cache is persisted in
 * `rqCacheStore`. Exported so `apps/web/src/lib/query-client/lib.ts`
 * and the SW replay handler use the same key.
 */
export const RQ_CACHE_KEY = 'shadhil-rq-cache';

/**
 * Key under which the mutation queue is persisted in `mutationStore`.
 * The queue is a single array of all pending mutations (FIFO).
 */
export const MUTATION_QUEUE_KEY = 'queue';
