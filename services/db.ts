/**
 * IndexedDB persistence layer for this single-user, single-device app.
 *
 * One object store per logical data item, each holding exactly one record
 * under a fixed key (SINGLETON_KEY). This mirrors the old localStorage
 * key/value shape 1:1, keeping migration and the API trivial.
 *
 * If IndexedDB is unavailable (private browsing, disabled, quota errors),
 * every operation transparently falls back to an in-memory Map so the app
 * keeps working for the session - callers can check `isDegraded()` to warn
 * the user that data won't persist across reloads.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { LifeInventory, RelationshipLedger, Memory, ChatHistory, ApprovedOrchestration } from '../types';

const DB_NAME = 'life-orchestrator-db';
const DB_VERSION = 2;
const SINGLETON_KEY = 'singleton';

export type StoreName = 'inventory' | 'ledger' | 'memories' | 'messages' | 'approvedOrchestrations' | 'meta';

interface MetaRecord {
  key: string;
  value: any;
}

interface LifeSystemDB extends DBSchema {
  inventory: { key: string; value: { key: string; data: LifeInventory } };
  ledger: { key: string; value: { key: string; data: RelationshipLedger } };
  memories: { key: string; value: { key: string; data: Memory[] } };
  messages: { key: string; value: { key: string; data: ChatHistory } };
  approvedOrchestrations: { key: string; value: { key: string; data: Record<string, ApprovedOrchestration> } };
  meta: { key: string; value: MetaRecord };
}

const STORE_NAMES: StoreName[] = ['inventory', 'ledger', 'memories', 'messages', 'approvedOrchestrations', 'meta'];

// In-memory fallback used when IndexedDB can't be opened at all.
const memoryFallback = new Map<StoreName, Map<string, any>>(STORE_NAMES.map(name => [name, new Map()]));
let degraded = false;
const degradedListeners = new Set<() => void>();

/** Marks the session as degraded (in-memory only) and notifies subscribers, once. */
const markDegraded = (context: string, err: unknown): void => {
  console.error(`[db] ${context}`, err);
  if (!degraded) {
    degraded = true;
    degradedListeners.forEach(listener => listener());
  }
};

/** Subscribe to be notified the moment storage degrades to in-memory-only. Returns an unsubscribe fn. */
export const onDegraded = (listener: () => void): (() => void) => {
  degradedListeners.add(listener);
  return () => degradedListeners.delete(listener);
};

let dbPromise: Promise<IDBPDatabase<LifeSystemDB>> | null = null;

const getDB = (): Promise<IDBPDatabase<LifeSystemDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<LifeSystemDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        // Recreate any store left over from an older, incompatible schema (e.g. a
        // previous version keyed 'inventory'/'ledger' by userId instead of 'key').
        for (const name of STORE_NAMES) {
          if (db.objectStoreNames.contains(name) && transaction.objectStore(name).keyPath !== 'key') {
            db.deleteObjectStore(name);
          }
        }
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'key' });
          }
        }
      },
    }).catch(err => {
      markDegraded('Failed to open IndexedDB, falling back to in-memory storage', err);
      throw err;
    });
  }
  return dbPromise;
};

export const isDegraded = (): boolean => degraded;

/** Probes whether IndexedDB is usable in this browser context (private browsing, quota, etc). */
export const isIndexedDBAvailable = async (): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') {
    markDegraded('indexedDB is undefined in this context', new Error('indexedDB unavailable'));
    return false;
  }
  try {
    await getDB();
    return true;
  } catch {
    return false;
  }
};

export const getValue = async <T>(store: StoreName, defaultValue: T): Promise<T> => {
  if (degraded) {
    return memoryFallback.get(store)!.get(SINGLETON_KEY) ?? defaultValue;
  }
  try {
    const db = await getDB();
    const record = await db.get(store, SINGLETON_KEY);
    return (record as any)?.data ?? (record as any)?.value ?? defaultValue;
  } catch (err) {
    markDegraded(`getValue(${store}) failed, using in-memory fallback`, err);
    return memoryFallback.get(store)!.get(SINGLETON_KEY) ?? defaultValue;
  }
};

export const setValue = async <T>(store: StoreName, value: T): Promise<void> => {
  memoryFallback.get(store)!.set(SINGLETON_KEY, value);
  if (degraded) return;
  try {
    const db = await getDB();
    const record = store === 'meta' ? { key: SINGLETON_KEY, value } : { key: SINGLETON_KEY, data: value };
    await db.put(store, record as any);
  } catch (err) {
    markDegraded(`setValue(${store}) failed, kept in-memory only`, err);
  }
};

export const clearAllStores = async (): Promise<void> => {
  for (const store of STORE_NAMES) {
    memoryFallback.get(store)!.clear();
  }
  if (degraded) return;
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    await Promise.all(STORE_NAMES.map(name => tx.objectStore(name).clear()));
    await tx.done;
  } catch (err) {
    markDegraded('clearAllStores failed', err);
  }
};

/** Byte size estimate for one store's record, used by getStats(). */
export const getStoreByteSize = async (store: Exclude<StoreName, 'meta'>): Promise<number> => {
  const data = await getValue(store, null);
  if (data === null) return 0;
  return new Blob([JSON.stringify(data)]).size;
};

