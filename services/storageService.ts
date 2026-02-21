/**
 * DESIGN DECISION: Storage Management Service
 * 
 * This service monitors and manages browser storage to prevent quota exhaustion.
 * 
 * Why a dedicated storage service?
 * 1. **Quota awareness**: LocalStorage has a ~5MB hard limit. Exceeding it breaks the app.
 * 2. **Proactive management**: Users see warnings before hitting limits
 * 3. **Per-data breakdown**: Identify what's consuming space (usually chat history)
 * 4. **Graceful cleanup**: Enable targeted deletion (e.g., old messages) vs. nuclear reset
 * 
 * Storage Strategy:
 * - localStorage: Primary persistence (synchronous, simple, sufficient)
 * - IndexedDB: Removed from this version (was causing migration complexity)
 * - Future: IndexedDB for embeddings/media, localStorage for structured data
 * 
 * The service calculates byte sizes using Blob conversion, which is accurate for
 * UTF-8 strings (handles emoji, special characters correctly).
 */

import { StorageStats, ChatHistory } from "../types";

export const storageService = {
  /**
   * getStats: Calculate storage usage breakdown
   * DESIGN DECISION: Real-time calculation vs cached stats
   * 
   * Stats are calculated on-demand by iterating localStorage rather than cached.
   * This approach:
   * - Always accurate (no stale data)
   * - Minimal performance impact (localStorage is fast, ~1ms calculation)
   * - Simpler implementation (no cache invalidation logic)
   * 
   * The function calculates:
   * - Total usage across all keys
   * - Per-category breakdown (messages, ledger, inventory, memories)
   * - Per-date message sizes for granular cleanup
   * 
   * The 5MB quota is a soft limit (actual varies by browser), but 5MB is conservative.
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

