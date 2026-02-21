/**
 * DESIGN DECISION: IndexedDB Layer for Future Scalability
 * 
 * This database implementation is currently unused but prepared for future requirements:
 * 
 * Why IndexedDB alongside localStorage?
 * 1. **Vector embeddings**: For semantic search of memories and conversations
 * 2. **Larger storage**: IndexedDB can store gigabytes vs localStorage's 5MB
 * 3. **Advanced queries**: Indexed queries by date, user, type for performance
 * 4. **Offline-first**: Better sync capabilities for future mobile apps
 * 
 * Why not use it now?
 * - Async API adds complexity to state management
 * - Current data size fits comfortably in localStorage
 * - Migration path is clear when needed
 * 
 * Schema Design:
 * - users: Multi-user support skeleton
 * - conversations: Message history with optional embeddings
 * - memories: AI learned facts with semantic search capability
 * - inventory/ledger: Blob storage matching current localStorage structure
 * - tasks: Granular task storage for advanced filtering (future optimization)
 * 
 * The schema is keyed by userId to enable future multi-user or multi-device sync.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { LifeInventory, RelationshipLedger, ChatMessage, Memory, UserProfile, Task, Person } from '../types';

/**
 * Schema Definition
 * DESIGN DECISION: Compound indexes for efficient querying
 * 
 * The 'by-date' index uses [userId, timestamp] to enable:
 * - Fast retrieval of all messages for a user
 * - Date-range queries (e.g., "get last 7 days of messages")
 * - Sorted results without additional sorting client-side
 */
interface LifeSystemDB extends DBSchema {
  users: {
    key: string;
    value: UserProfile;
  };
  conversations: {
    key: string;
    value: ChatMessage & { userId: string; embedding?: number[] };
    indexes: { 'by-user': string; 'by-date': [string, string] }; // [userId, dateString]
  };
  memories: {
    key: string;
    value: Memory & { userId: string; embedding?: number[] };
    indexes: { 'by-user': string; 'by-type': [string, string] };
  };
  inventory: {
    key: string;
    value: { id: string; userId: string; data: LifeInventory }; // Storing the whole inventory blobl for now as migration step, ideally should be granular
    indexes: { 'by-user': string };
  };
  ledger: {
    key: string;
    value: { id: string; userId: string; data: RelationshipLedger };
    indexes: { 'by-user': string };
  };
  // Granular task storage for better querying if needed later
  tasks: {
    key: string;
    value: Task & { userId: string };
    indexes: { 'by-user': string; 'by-date': [string, string] };
  };
}

/**
 * Database versioning and migration
 * DESIGN DECISION: Version 1 schema with forward-compatible structure
 * 
 * The upgrade callback defines schema changes between versions.
 * When DB_VERSION increments, this function runs to migrate existing data.
 * 
 * Current approach:
 * - All object stores created upfront
 * - Space efficient (only create stores that don't exist)
 * - Forward-compatible (new fields can be added without schema changes)
 */
const DB_NAME = 'life-orchestrator-db';
const DB_VERSION = 1;

export class LifeDatabase {
  private dbPromise: Promise<IDBPDatabase<LifeSystemDB>>;

  constructor() {
    this.dbPromise = openDB<LifeSystemDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Users store
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }

        // Conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' });
          conversationStore.createIndex('by-user', 'userId');
          conversationStore.createIndex('by-date', ['userId', 'timestamp']); 
        }

        // Memories store
        if (!db.objectStoreNames.contains('memories')) {
          const memoryStore = db.createObjectStore('memories', { keyPath: 'id' });
          memoryStore.createIndex('by-user', 'userId');
          memoryStore.createIndex('by-type', ['userId', 'type']);
        }

        // Inventory store (Single blob for now to match current app structure)
        if (!db.objectStoreNames.contains('inventory')) {
          const invStore = db.createObjectStore('inventory', { keyPath: 'userId' }); // Keyed by userId for singleton per user
        }

        // Ledger store (Single blob for now)
        if (!db.objectStoreNames.contains('ledger')) {
          const ledgerStore = db.createObjectStore('ledger', { keyPath: 'userId' });
        }
        
        // Tasks store (Future proofing)
        if (!db.objectStoreNames.contains('tasks')) {
            const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
            taskStore.createIndex('by-user', 'userId');
            taskStore.createIndex('by-date', ['userId', 'date']);
        }
      },
    });
  }

  // --- CRUD Operations ---

  async getUser(userId: string): Promise<UserProfile | undefined> {
    return (await this.dbPromise).get('users', userId);
  }

  async saveUser(user: UserProfile): Promise<string> {
    await (await this.dbPromise).put('users', user);
    return user.id;
  }

  async addMessage(userId: string, message: ChatMessage, embedding?: number[]): Promise<void> {
    await (await this.dbPromise).put('conversations', { ...message, userId, embedding });
  }

  async getMessagesForDate(userId: string, dateStr: string): Promise<ChatMessage[]> {
    // Ideally we'd index by date string part of timestamp, but for now we'll fetch range or filter
    // Since timestamp is ISO, we can range query for the day
    const start = new Date(dateStr).toISOString();
    const end = new Date(new Date(dateStr).getTime() + 86400000).toISOString();
    
    // This is a naive implementation. Optimized would use a key range on an index
    const db = await this.dbPromise;
    const all = await db.getAllFromIndex('conversations', 'by-user', userId);
    return all.filter(m => {
        const d = new Date(m.timestamp).toLocaleDateString('en-CA');
        return d === dateStr;
    });
  }
  
  async getAllMessages(userId: string): Promise<ChatMessage[]> {
      const db = await this.dbPromise;
      // Use the compound index [userId, timestamp] to get messages sorted by time
      // IDBKeyRange.bound works with arrays for compound indexes
      const range = IDBKeyRange.bound([userId, ''], [userId, '\uffff']);
      return await db.getAllFromIndex('conversations', 'by-date', range);
  }

  async saveMemory(userId: string, memory: Memory, embedding?: number[]): Promise<void> {
    await (await this.dbPromise).put('memories', { ...memory, userId, embedding });
  }

  async getMemories(userId: string): Promise<Memory[]> {
    return (await this.dbPromise).getAllFromIndex('memories', 'by-user', userId);
  }

  async saveInventory(userId: string, inventory: LifeInventory): Promise<void> {
    // For the "blob" approach
    await (await this.dbPromise).put('inventory', { id: userId, userId, data: inventory });
  }

  async getInventory(userId: string): Promise<LifeInventory | undefined> {
    const res = await (await this.dbPromise).get('inventory', userId);
    return res?.data;

  /**
   * Semantic Search Implementation (Placeholder)
   * DESIGN DECISION: Client-side vector search for privacy
   * 
   * This would enable queries like:
   * - "Show me times I discussed burnout"
   * - "Find memories about morning routines"
   * 
   * Approach:
   * 1. Generate embeddings using Gemini's embedding API
   * 2. Store embeddings alongside messages/memories
   * 3. Compute cosine similarity client-side for search
   * 
   * Why client-side?
   * - No server = no data leaves user's device
   * - Embeddings are small (~100 floats per text)
   * - Modern browsers handle vector math efficiently
   * 
   * Note: Currently unimplemented, prepared for future feature.
   */
  }

  async saveLedger(userId: string, ledger: RelationshipLedger): Promise<void> {
    await (await this.dbPromise).put('ledger', { id: userId, userId, data: ledger });
  }

  async getLedger(userId: string): Promise<RelationshipLedger | undefined> {
    const res = await (await this.dbPromise).get('ledger', userId);
    return res?.data;
  }

  // --- Vector Search (Naive client-side) ---
  // In a real app with massive data, checking every embedding is slow. 
  // For <10k items, it's instant in JS.
  async findSimilarMemories(userId: string, queryEmbedding: number[], limit = 5): Promise<Memory[]> {
    const memories = await this.getMemories(userId);
    const withScores = memories.map(mem => ({
      item: mem,
      score: this.cosineSimilarity(queryEmbedding, (mem as any).embedding || [])
    })).filter(x => x.score > 0.6); // Threshold

    withScores.sort((a, b) => b.score - a.score);
    return withScores.slice(0, limit).map(x => x.item);
  }
  
  async findSimilarMessages(userId: string, queryEmbedding: number[], limit = 5): Promise<ChatMessage[]> {
    const msgs = await this.getAllMessages(userId);
    const withScores = msgs.map(msg => ({
      item: msg,
      score: this.cosineSimilarity(queryEmbedding, (msg as any).embedding || [])
    })).filter(x => x.score > 0.6); // Threshold for relevance

    withScores.sort((a, b) => b.score - a.score);
    return withScores.slice(0, limit).map(x => x.item);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }
  
  // --- Stats ---
  async getStats(): Promise<{ usage: number, count: number, breakdown: any, messagesByDate: Record<string, number> }> {
      const db = await this.dbPromise;
      let totalUsage = 0;
      let totalCount = 0;
      const breakdown = { messages: 0, ledger: 0, memories: 0, inventory: 0 };
      const messagesByDate: Record<string, number> = {};

      const tx = db.transaction(['conversations', 'memories', 'inventory', 'ledger'], 'readonly');

      // Helper to estimate size
      const getSize = (obj: any) => JSON.stringify(obj).length;

      // 1. Conversations
      let cursor: any = await tx.objectStore('conversations').openCursor();
      while (cursor) {
          const size = getSize(cursor.value);
          breakdown.messages += size;
          totalUsage += size;
          totalCount++;
          
          const dateKey = new Date(cursor.value.timestamp).toLocaleDateString('en-CA');
          messagesByDate[dateKey] = (messagesByDate[dateKey] || 0) + size;
          
          cursor = await cursor.continue();
      }

      // 2. Memories
      cursor = await tx.objectStore('memories').openCursor();
      while (cursor) {
          const size = getSize(cursor.value);
          breakdown.memories += size;
          totalUsage += size;
          totalCount++;
          cursor = await cursor.continue();
      }

      // 3. Inventory
      cursor = await tx.objectStore('inventory').openCursor();
      while (cursor) {
          const size = getSize(cursor.value);
          breakdown.inventory += size;
          totalUsage += size;
          totalCount++; 
          cursor = await cursor.continue();
      }

      // 4. Ledger
      cursor = await tx.objectStore('ledger').openCursor();
      while (cursor) {
          const size = getSize(cursor.value);
          breakdown.ledger += size;
          totalUsage += size;
          totalCount++;
          cursor = await cursor.continue();
      }

      return { usage: totalUsage, count: totalCount, breakdown, messagesByDate };
  }

  async clearAll(userId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(['conversations', 'memories', 'inventory', 'ledger', 'tasks', 'users'], 'readwrite');
    await Promise.all([
        tx.objectStore('conversations').clear(),
        tx.objectStore('memories').clear(),
        tx.objectStore('inventory').clear(),
        tx.objectStore('ledger').clear(),
        tx.objectStore('tasks').clear(),
        tx.objectStore('users').delete(userId), // Or clear if we want to remove all users
    ]);
    await tx.done;
  }
}

export const db = new LifeDatabase();
