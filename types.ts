

export interface UserProfile {
  id: string;
  name?: string;
  preferences?: Record<string, any>;
}

export interface Person {
  name: string;
  relation: string; // e.g., "Grandmother", "Best Friend", "College Roommate"
  category: 'Family' | 'Friend' | 'Network';
  priority: number;
  notes: string; // broadened from health_notes
  last_contact: string; // ISO date string
  status: 'Stable' | 'Needs Attention' | 'Critical' | 'Overdue';
  image?: string; 
}

export interface RelationshipLedger {
  [key: string]: Person;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  weekDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth?: number; // 1-31
}

export interface Task {
  id: string;
  gcal_id?: string;
  gcal_recurring_id?: string; // Parent ID of a recurring instance
  title: string;
  type: 'fixed' | 'flexible';
  time?: string;
  date?: string; // YYYY-MM-DD format to associate task with a specific day
  duration: string;
  priority: 'high' | 'medium' | 'low';
  category?: 'Career' | 'Life' | 'Health' | 'Family';
  recurrence?: RecurrenceRule;
}

export interface LifeInventory {
  flexible: Task[];
  fixed: Task[];
}

export interface Memory {
  id: string;
  content: string;
  date: string; // When this memory was created
  type: 'preference' | 'decision' | 'fact';
}

export interface OrchestrationProposal {
  optimized_timeline: string;
  reasoning: string;
  schedule: Task[]; // Full structured list of tasks for the day
}

export interface UpdateRelationshipArgs {
  person_name: string;
  notes_update: string;
  status_level: 'Stable' | 'Needs Attention' | 'Critical' | 'Overdue';
  category?: 'Family' | 'Friend' | 'Network'; // Optional, inferred if new
  relation?: string; // Optional, useful for new contacts
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string; // ISO Date string
  media?: string;
  isThinking?: boolean;
  proposal?: OrchestrationProposal;
  contactProposal?: Person;
  thought?: string;
}

export type ChatHistory = Record<string, ChatMessage[]>;

export interface StorageStats {
  usedBytes: number;
  totalQuota: number; // usually 5MB
  percentage: number;
  breakdown: {
    messages: number;
    ledger: number;
    memories: number;
    inventory: number;
  };
  messagesByDate: Record<string, number>;
}
