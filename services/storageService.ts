
import { StorageStats } from "../types";

export const storageService = {
  /**
   * Calculates detailed storage statistics for the app's keys.
   */
  getStats(): StorageStats {
    const keys = {
      messages: 'life_messages',
      ledger: 'life_ledger',
      memories: 'life_memories',
      inventory: 'life_inventory'
    };

    const breakdown = {
      messages: 0,
      ledger: 0,
      memories: 0,
      inventory: 0
    };

    let usedBytes = 0;
    
    // Calculate breakdowns
    Object.entries(keys).forEach(([key, storageKey]) => {
      const val = localStorage.getItem(storageKey) || '';
      const size = val.length * 2; // UTF-16 strings are 2 bytes per char
      breakdown[key as keyof typeof breakdown] = size;
      usedBytes += size;
    });

    // Detailed message breakdown by date
    const messagesByDate: Record<string, number> = {};
    try {
      const messagesRaw = localStorage.getItem(keys.messages);
      if (messagesRaw) {
        const parsed = JSON.parse(messagesRaw);
        Object.entries(parsed).forEach(([date, msgs]: [string, any]) => {
          messagesByDate[date] = JSON.stringify(msgs).length * 2;
        });
      }
    } catch (e) {
      console.error("Error calculating message breakdown", e);
    }

    const totalQuota = 5 * 1024 * 1024; // Standard 5MB limit
    
    return {
      usedBytes,
      totalQuota,
      percentage: Math.min(100, (usedBytes / totalQuota) * 100),
      breakdown,
      messagesByDate
    };
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};
