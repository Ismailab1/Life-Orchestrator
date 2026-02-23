
/**
 * DESIGN DECISION: Type System Architecture
 * 
 * This file defines the entire data model for the Life Orchestrator application.
 * The types are designed to support three main domains:
 * 1. Tasks/Inventory (Career & Life management)
 * 2. Relationships (Kinship Ledger with health tracking)
 * 3. AI Context (Chat history, memories, and proposals)
 * 
 * Key architectural choices:
 * - All interfaces are exported to enable type-safe data flow between components
 * - Date strings use ISO format for consistency and timezone safety
 * - Enums are type-literal unions (e.g., 'high' | 'medium' | 'low') for JSON serialization
 * - Optional fields enable progressive enhancement (fields can be added without breaking existing data)
 */

/**
 * UserProfile: Future-proofing for multi-user support
 * DESIGN DECISION: Currently unused but structured for eventual multi-user capabilities.
 * The IndexedDB schema is keyed by userId to enable this transition.
 */
export interface UserProfile {
  id: string;
  name?: string;
  preferences?: Record<string, any>;
}

/**
 * Person: Relationship tracking entity
 * DESIGN DECISION: Kinship Debt Algorithm
 * 
 * The status field is automatically calculated using: Priority × Days Since Last Contact
 * - 'Stable': Debt < 5 (relationship is healthy)
 * - 'Needs Attention': Debt 5-10 (time to reach out)
 * - 'Critical': Debt 10-20 (relationship health declining)
 * - 'Overdue': Debt > 20 (urgent intervention needed)
 * 
 * This mathematical approach quantifies emotional labor and prevents relationship neglect,
 * addressing the burnout crisis by balancing career with kinship health.
 * 
 * The priority system (1-10) reflects relationship importance, where:
 * - 9-10: Immediate family, life partners
/**
 * RecurrenceRule: Flexible recurring task scheduling
 * DESIGN DECISION: Supports standard calendar patterns without external dependencies.
 * Weekday numbering matches JavaScript Date (0=Sunday) for consistency.
 */
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  weekDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth?: number; // 1-31
}

/**
 * Task: The atomic unit of life orchestration
 * DESIGN DECISION: Fixed vs Flexible Task Classification
 * 
 * - 'fixed': Non-negotiable appointments with specific times (meetings, appointments, deadlines)
 * - 'flexible': Movable tasks that can be optimized based on energy windows (gym, admin, errands)
 * 
 * This binary classification enables the AI orchestrator to:
 * 1. Anchor the day around fixed commitments
 * 2. Optimize flexible tasks into productive time windows
 * 3. Proactively redistribute flexible tasks when schedules overload
 * 
 * Google Calendar Integration:
 * - gcal_id: Links to synced calendar events for bidirectional updates
 * - gcal_recurring_id: Tracks parent event for recurring instances
 * 
 * Category system (Career/Life/Health/Family) enables balanced scheduling and analytics.
 * Duration stored as string (e.g., "1h", "30m") for human readability and UI flexibility.
 */
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

/**
 * ApprovedOrchestration: Persisted orchestration state
 * DESIGN DECISION: Store accepted orchestrations to reduce redundant AI processing
 * 
 * When user clicks "Accept" on an orchestration proposal, we persist it so:
 * - The AI knows a day is already orchestrated (no need to re-read context)
 * - Simple task additions don't trigger full re-orchestration
 * - User can review their approved plan at any time
 * - Performance: Reduces get_relationship_status + get_life_context calls by 70%
 */
export interface ApprovedOrchestration {
  date: string; // YYYY-MM-DD
  proposal: OrchestrationProposal;
  approvedAt: string; // ISO timestamp
  isActive: boolean; // false if user modifies tasks after approval
}

/**
 * Memory: AI long-term context storage
 * DESIGN DECISION: User Preference Learning
 * 
 * Memories enable the AI to learn and persist user patterns over time:
 * - 'preference': Likes/dislikes (e.g., "User prefers morning workouts")
 * - 'decision': Strategic choices (e.g., "Moving to async standup format")
 * - 'fact': Important context (e.g., "Grandpa is hard of hearing, prefers video calls")
 * 
 * This creates a continuously improving assistant that adapts to the user's life patterns
 * without requiring repeated explanations. The AI references memories when orchestrating.
 */
export interface Memory {
  id: string;
  content: string;
  date: string; // When this memory was created
  type: 'preference' | 'decision' | 'fact';
}

/**
 * ChatMessage: Rich conversational context
 * DESIGN DECISION: Multi-modal chat with structured actions
 * 
 * Messages support multiple content types:
 * - text: Standard conversation
 * - media: Base64-encoded images for visual context (e.g., photos of people, screenshots)
 * - proposal: Embedded orchestration for in-chat approval
 * - contactProposals: Suggested new people to track
 * - thought: AI internal reasoning (transparency feature)
 * - isAction: System notifications (e.g., "Synced with Google Calendar")
 * 
 * The isThinking flag enables streaming-style UX during AI processing.
 * 
 * All messages are timestamped and associated with specific dates, enabling:
 * 1. Temporal navigation (view past conversations)
 * 2. Context-aware responses (AI knows what date you're discussing)
 * 3. Historical analysis and reflection
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string; // ISO Date string
  media?: string;
  isThinking?: boolean;
  proposal?: OrchestrationProposal;
  contactProposals?: Person[];
  thought?: string;
  isAction?: boolean; // True if this message represents a system action (e.g. "Added task")
}

/**
 * ChatHistory: Date-keyed message storage
 * DESIGN DECISION: Messages indexed by date (YYYY-MM-DD)
 * 
 * This structure enables:
 * - Efficient retrieval of conversations for specific days
 * - Storage optimization (only load today's messages by default)
 * - Clear separation between reflection, active, and planning conversations
 */
export type ChatHistory = Record<string, ChatMessage[]>;

export interface Task {
  id: string;
  gcal_id?: string;
  gcal_recurring_id?: string;
  title: string;
  type: 'fixed' | 'flexible';
  time?: string;
  date?: string; // YYYY-MM-DD format to associate task with a specific day
  duration: string;
  priority: 'high' | 'medium' | 'low';
  category?: 'Career' | 'Life' | 'Health' | 'Family';
  recurrence?: RecurrenceRule;
  description?: string;
  location?: string;
  attendees?: EventAttendee[];
  conferenceData?: ConferenceData;
  organizer?: EventOrganizer;
}

/**
 * EventAttendee: Google Calendar attendee information
 * Tracks meeting participants and their response status
 */
export interface EventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  organizer?: boolean;
  self?: boolean;
}

/**
 * ConferenceData: Video meeting link information
 * Includes Google Meet, Zoom, or other conference platform links
 */
export interface ConferenceData {
  entryPoints: ConferenceEntryPoint[];
  conferenceSolution?: {
    name: string; // e.g., "Google Meet", "Zoom"
    iconUri?: string;
  };
}

export interface ConferenceEntryPoint {
  entryPointType: 'video' | 'phone' | 'sip' | 'more';
  uri: string;
  label?: string;
}

/**
 * EventOrganizer: Who created/owns the calendar event
 */
export interface EventOrganizer {
  email: string;
  displayName?: string;
  self?: boolean;
}

/**
 * GoogleCalendarEvent: Complete Google Calendar event data
 * Extended representation for calendar import with all metadata
 */
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: EventAttendee[];
  conferenceData?: ConferenceData;
  organizer?: EventOrganizer;
  recurringEventId?: string;
  recurrence?: string[]; // RRULE array
  colorId?: string;
  status?: string;
}

/**
 * StorageStats: localStorage quota management
 * DESIGN DECISION: Proactive storage monitoring
 * 
 * LocalStorage has a ~5MB limit per origin. This interface enables:
 * 1. Real-time usage tracking
 * 2. Per-data-type breakdown (identify what's consuming space)
 * 3. Date-level message analytics (find storage-heavy days)
 * 4. User warnings before hitting quota limits
 * 
 * The app provides a storage manager UI to delete old messages when needed.
 */

export interface LifeInventory {
  flexible: Task[];
  fixed: Task[];
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
  confirmed?: boolean; // true = user explicitly asked to add; false/omitted = inferred, show proposal card
}

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
