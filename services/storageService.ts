
import { StorageStats, ChatHistory } from "../types";

export const storageService = {
  /**
   * Calculates detailed storage statistics from localStorage.
   * IndexedDB has been removed - localStorage is the single source of truth.
   */
  async getStats(): Promise<StorageStats> {
    try {
        const totalQuota = 5 * 1024 * 1024; // 5MB localStorage soft limit
        
        // Calculate actual localStorage usage for main data items
        const ledgerStr = localStorage.getItem('life_ledger') || '{}';
        const inventoryStr = localStorage.getItem('life_inventory') || '{"fixed":[],"flexible":[]}';
        const messagesStr = localStorage.getItem('life_messages') || '{}';
        const memoriesStr = localStorage.getItem('life_memories') || '[]';
        
        const ledgerSize = new Blob([ledgerStr]).size;
        const inventorySize = new Blob([inventoryStr]).size;
        const messagesSize = new Blob([messagesStr]).size;
        const memoriesSize = new Blob([memoriesStr]).size;
        
        // Calculate total localStorage usage including all items (tutorial flags, tokens, etc.)
        let totalUsed = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key) || '';
                totalUsed += new Blob([key]).size + new Blob([value]).size;
            }
        }
        
        // Parse messages to get per-date breakdown
        const messages: ChatHistory = JSON.parse(messagesStr);
        const messagesByDate: Record<string, number> = {};
        Object.entries(messages).forEach(([date, msgs]) => {
            messagesByDate[date] = new Blob([JSON.stringify(msgs)]).size;
        });
        
        return {
          usedBytes: totalUsed,
          totalQuota,
          percentage: (totalUsed / totalQuota) * 100,
          breakdown: {
            messages: messagesSize,
            ledger: ledgerSize,
            memories: memoriesSize,
            inventory: inventorySize
          },
          messagesByDate
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
      // IndexedDB has been removed - localStorage clearing happens in App.tsx
      console.log('[StorageService] clearAll called - localStorage managed by App.tsx');
      return Promise.resolve();
  }
};

