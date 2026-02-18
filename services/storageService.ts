
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
  }
};
