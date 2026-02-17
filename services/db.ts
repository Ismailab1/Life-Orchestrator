import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { LifeInventory, RelationshipLedger, ChatMessage, Memory, UserProfile, Task, Person } from '../types';

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
      return await db.getAllFromIndex('conversations', 'by-user', userId);
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
  async getStats(): Promise<{ usage: number, count: number }> {
      // Approximate
      return { usage: 0, count: 0 }; 
  }
}

export const db = new LifeDatabase();
