/**
 * Public storage module - the single place the rest of the app talks to for persistence.
 *
 * Backed by IndexedDB (see ./db.ts), with a one-time migration from the old
 * localStorage-based storage on first load. Callers never touch localStorage
 * or IndexedDB directly.
 */

import { StorageStats, ChatHistory, LifeInventory, RelationshipLedger, Memory, ApprovedOrchestration } from "../types";
import * as db from "./db";

const LEGACY_KEYS = {
  ledger: 'life_ledger',
  inventory: 'life_inventory',
  messages: 'life_messages',
  memories: 'life_memories',
  approvedOrchestrations: 'approved_orchestrations',
  tutorialCompleted: 'life_tutorial_completed',
  lastActive: 'life_last_active',
} as const;

interface MetaBag {
  migrated?: boolean;
  tutorialCompleted?: boolean;
  lastActive?: number;
}

const getMeta = (): Promise<MetaBag> => db.getValue<MetaBag>('meta', {});
const setMeta = async (patch: Partial<MetaBag>): Promise<void> => {
  const current = await getMeta();
  await db.setValue('meta', { ...current, ...patch });
};

/** True once IndexedDB has failed and we're running on an in-memory fallback for this session. */
export const isStorageDegraded = (): boolean => db.isDegraded();

/**
 * One-time migration: copies the legacy localStorage keys into IndexedDB, then
 * removes just those keys (never a blanket localStorage.clear()). Safe to call
 * on every app start - it no-ops once the marker is set.
 */
export const migrateFromLocalStorage = async (): Promise<void> => {
  const meta = await getMeta();
  if (meta.migrated) return;

  const readJson = <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const hadLedger = localStorage.getItem(LEGACY_KEYS.ledger) !== null;
  const hadInventory = localStorage.getItem(LEGACY_KEYS.inventory) !== null;
  const hadMessages = localStorage.getItem(LEGACY_KEYS.messages) !== null;
  const hadMemories = localStorage.getItem(LEGACY_KEYS.memories) !== null;
  const hadOrchestrations = localStorage.getItem(LEGACY_KEYS.approvedOrchestrations) !== null;
  const hadTutorial = localStorage.getItem(LEGACY_KEYS.tutorialCompleted) !== null;
  const hadLastActive = localStorage.getItem(LEGACY_KEYS.lastActive) !== null;

  if (hadLedger) await db.setValue('ledger', readJson<RelationshipLedger>(LEGACY_KEYS.ledger, {}));
  if (hadInventory) await db.setValue('inventory', readJson<LifeInventory>(LEGACY_KEYS.inventory, { fixed: [], flexible: [] }));
  if (hadMessages) await db.setValue('messages', readJson<ChatHistory>(LEGACY_KEYS.messages, {}));
  if (hadMemories) await db.setValue('memories', readJson<Memory[]>(LEGACY_KEYS.memories, []));
  if (hadOrchestrations) await db.setValue('approvedOrchestrations', readJson<Record<string, ApprovedOrchestration>>(LEGACY_KEYS.approvedOrchestrations, {}));

  const metaPatch: Partial<MetaBag> = { migrated: true };
  if (hadTutorial) metaPatch.tutorialCompleted = true;
  if (hadLastActive) {
    const lastActive = parseInt(localStorage.getItem(LEGACY_KEYS.lastActive) || '0', 10);
    if (!Number.isNaN(lastActive)) metaPatch.lastActive = lastActive;
  }
  await setMeta(metaPatch);

  // Clean up only the keys we own, never a blanket localStorage.clear().
  if (!db.isDegraded()) {
    Object.values(LEGACY_KEYS).forEach(key => localStorage.removeItem(key));
  }
};

// --- Typed getters/setters, one per data item ---

export const getInventory = (): Promise<LifeInventory> =>
  db.getValue<LifeInventory>('inventory', { fixed: [], flexible: [] });
export const setInventory = (inventory: LifeInventory): Promise<void> =>
  db.setValue('inventory', inventory);

export const getLedger = (): Promise<RelationshipLedger> =>
  db.getValue<RelationshipLedger>('ledger', {});
export const setLedger = (ledger: RelationshipLedger): Promise<void> =>
  db.setValue('ledger', ledger);

export const getMemories = (): Promise<Memory[]> =>
  db.getValue<Memory[]>('memories', []);
export const setMemories = (memories: Memory[]): Promise<void> =>
  db.setValue('memories', memories);

export const getMessages = (): Promise<ChatHistory> =>
  db.getValue<ChatHistory>('messages', {});
export const setMessages = (history: ChatHistory): Promise<void> =>
  db.setValue('messages', history);

export const getApprovedOrchestrations = (): Promise<Record<string, ApprovedOrchestration>> =>
  db.getValue<Record<string, ApprovedOrchestration>>('approvedOrchestrations', {});
export const setApprovedOrchestrations = (map: Record<string, ApprovedOrchestration>): Promise<void> =>
  db.setValue('approvedOrchestrations', map);

export const getTutorialCompleted = async (): Promise<boolean> => !!(await getMeta()).tutorialCompleted;
export const setTutorialCompleted = (completed = true): Promise<void> => setMeta({ tutorialCompleted: completed });

export const getLastActive = async (): Promise<number> => (await getMeta()).lastActive ?? 0;
export const setLastActive = (timestamp: number): Promise<void> => setMeta({ lastActive: timestamp });

// --- Quota monitoring, preserved public interface for StorageManager.tsx ---

export const storageService = {
  /**
   * getStats: Calculate storage usage breakdown.
   * Uses navigator.storage.estimate() for real usage/quota when available,
   * falling back to a generous constant otherwise.
   */
  async getStats(): Promise<StorageStats> {
    try {
      const [messagesSize, ledgerSize, inventorySize, memoriesSize, messages] = await Promise.all([
        db.getStoreByteSize('messages'),
        db.getStoreByteSize('ledger'),
        db.getStoreByteSize('inventory'),
        db.getStoreByteSize('memories'),
        getMessages(),
      ]);

      let usedBytes = messagesSize + ledgerSize + inventorySize + memoriesSize;
      let totalQuota = 200 * 1024 * 1024; // generous fallback (200MB) when estimate() is unavailable

      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (typeof estimate.usage === 'number') usedBytes = estimate.usage;
          if (typeof estimate.quota === 'number' && estimate.quota > 0) totalQuota = estimate.quota;
        } catch {
          // keep fallback values
        }
      }

      const messagesByDate: Record<string, number> = {};
      Object.entries(messages).forEach(([date, msgs]) => {
        messagesByDate[date] = new Blob([JSON.stringify(msgs)]).size;
      });

      return {
        usedBytes,
        totalQuota,
        percentage: totalQuota > 0 ? (usedBytes / totalQuota) * 100 : 0,
        breakdown: {
          messages: messagesSize,
          ledger: ledgerSize,
          memories: memoriesSize,
          inventory: inventorySize,
        },
        messagesByDate,
      };
    } catch (error) {
      console.error("Failed to get storage stats", error);
      return {
        usedBytes: 0,
        totalQuota: 200 * 1024 * 1024,
        percentage: 0,
        breakdown: { messages: 0, ledger: 0, memories: 0, inventory: 0 },
        messagesByDate: {},
      };
    }
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  async clearAll(): Promise<void> {
    await db.clearAllStores();
  }
};


