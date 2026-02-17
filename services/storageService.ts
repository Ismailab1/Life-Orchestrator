
import { StorageStats } from "../types";


import { db } from './db';

export const storageService = {
  /**
   * Calculates detailed storage statistics for the app's keys.
   */
  async getStats(): Promise<StorageStats> {
    // Current simple implementation just returns basic stats
    // In future, this should query IDB for meaningful size
    // For now, we return placeholders since IDB size is async and harder to estimate cheaply
    return {
      usedBytes: 0,
      totalQuota: 5 * 1024 * 1024,
      percentage: 0,
      breakdown: {
        messages: 0,
        ledger: 0,
        memories: 0,
        inventory: 0
      },
      messagesByDate: {}
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
