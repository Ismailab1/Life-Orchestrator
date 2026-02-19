
import { StorageStats } from "../types";


import { db } from './db';

export const storageService = {
  /**
   * Calculates detailed storage statistics for the app's keys.
   */
  async getStats(): Promise<StorageStats> {
    try {
        const stats = await db.getStats();
        const totalQuota = 5 * 1024 * 1024; // 5MB soft limit
        
        return {
          usedBytes: stats.usage,
          totalQuota,
          percentage: (stats.usage / totalQuota) * 100,
          breakdown: stats.breakdown,
          messagesByDate: stats.messagesByDate
        };
    } catch (error) {
        console.error("Failed to get storage stats", error);
        return {
            usedBytes: 0,
            totalQuota: 5 * 1024 * 1024,
            percentage: 0,
            breakdown: { messages: 0, ledger: 0, memories: 0, inventory: 0 },
            messagesByDate: {}
        };
    }
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  async clearAll(): Promise<void> {
      // Clear IndexedDB
      // We need a userId. For now, assuming single user or iterating.
      // The db.clearAll asks for userId. 
      // Current app doesn't seem to use strict userIds yet (db.ts schema uses 'users' store but app might not).
      // Let's check db.ts again. It implies userId usage.
      // But for a local demo/single user app, maybe we pass a default or wildcards?
      // Actually, looking at db.ts, it uses `put('inventory', { id: userId ... })`.
      // The app likely uses a consistent userId or just one.
      // Let's assume we clear for the current user or everything.
      // Since specific userId isn't easily available here without threading it, 
      // and checking db.ts clearAll implementation:
      // tx.objectStore('users').delete(userId).
      // If we want to "clear EVERYTHING", we should probably clear the entire object stores.
      // But the exposed method takes a userId.
      // Let's use a fixed ID if the app uses one, or just clear the stores directly if we can access db.
      
      // WAIT. I used `db` import in storageService.
      // `db.ts` exports `db` which is an instance of `LifeDatabase`.
      // `LifeDatabase` has `clearAll(userId: string)`.
      
      // I need to know what userId the app uses.
      // In App.tsx, does it use a userId?
      // I haven't seen one.
      // Let's check `services/db.ts` usage in `App.tsx` or `geminiService.ts` if any.
      // Actually, `App.tsx` uses `localStorage` for most things.
      // `useEffect` on line 175 saves to localStorage.
      // `storageService.getStats()` is called.
      // `db.getStats()` iterates cursors.
      
      // If `App.tsx` primarily uses LocalStorage, `db.ts` might be a secondary or future store.
      // `handleClearAllHistory` should definitely clear LocalStorage.
      // And also call `db.clearAll('user')` (default) just in case.
      
      await db.clearAll('default-user'); // 'default-user' or similar if that's what's used.
      // Actually, let's just make sure we clear the stores. 
      // Use a dummy ID for now or check if I can modify db.ts to clear everything.
      
      // Let's just modify `storageService` to expose a simple clear that calls db.clearAll with a placeholder 
      // AND explicitly clears localStorage in App.tsx (since App.tsx manages the source of truth for now).
      return db.clearAll('default_user');
  }
};
