/**
 * DESIGN DECISION: Main Application Component Architecture
 * 
 * App.tsx orchestrates the entire application state and component hierarchy.
 * This centralized state management approach was chosen over Redux/Context because:
 * 
 * 1. Single-user, single-device app (no need for complex state sync)
 * 2. State is naturally hierarchical (inventory → tasks, ledger → people)
 * 3. Props drilling is manageable with TypeScript type safety
 * 4. Simpler debugging (state changes visible in React DevTools)
 * 
 * Core Responsibilities:
 * - Temporal navigation (past/present/future modes)
 * - localStorage persistence (dual storage with IndexedDB planned)
 * - AI chat session management
 * - Google Calendar sync orchestration
 * - Storage quota monitoring
 * 
 * The component maintains separate chat histories per date, enabling contextual
 * conversations about different days without confusion.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { INITIAL_INVENTORY, INITIAL_LEDGER, EMPTY_INVENTORY, EMPTY_LEDGER, GOOGLE_CLIENT_ID } from './constants';
import { LifeInventory, RelationshipLedger, ChatMessage, OrchestrationProposal, UpdateRelationshipArgs, Person, Task, Memory, ChatHistory, StorageStats, GoogleCalendarEvent, ApprovedOrchestration } from './types';
import { KinshipLedgerView } from './components/KinshipLedger';
import { CareerInventoryView } from './components/CareerInventory';
import { ChatInterface } from './components/ChatInterface';
import { geminiService } from './services/geminiService';
import { GoogleCalendarService } from './services/googleCalendarService';
import { TutorialOverlay } from './components/TutorialOverlay';
import { CalendarImportModal } from './components/CalendarImportModal';
import { compressImage } from './services/imageService';
import { storageService } from './services/storageService';
import { StorageManager } from './components/StorageManager';
import { Toast, useToast } from './components/Toast';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

/**
 * Generate a unique ID that doesn't collide with existing task IDs.
 * Uses retry logic to ensure uniqueness (max 10 attempts, then falls back to timestamp-based ID)
 */
const generateUniqueTaskId = (existingIds: Set<string>): string => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = Math.random().toString(36).substr(2, 9);
    if (!existingIds.has(id)) {
      return id;
    }
  }
  // Fallback: Use timestamp + random to guarantee uniqueness
  return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
};

/**
 * De-duplicate tasks by ID to clean up legacy data with duplicate IDs.
 * Tasks with duplicate IDs get new unique IDs assigned.
 */
const deduplicateTasks = (tasks: Task[]): Task[] => {
  const seenIds = new Set<string>();
  return tasks.map(task => {
    if (seenIds.has(task.id)) {
      // Generate a new unique ID for this duplicate
      const newId = generateUniqueTaskId(seenIds);
      seenIds.add(newId);
      console.log(`🔧 Fixed duplicate task ID: "${task.title}" (${task.id} → ${newId})`);
      return { ...task, id: newId };
    }
    seenIds.add(task.id);
    return task;
  });
};

/**
 * Mock Calendar Events for Demo Mode
 * DESIGN DECISION: Showcase all badge types and event metadata
 * 
 * This function generates realistic Google Calendar events that demonstrate:
 * - Recurring events (daily standup, weekly 1-on-1)
 * - Meetings with multiple attendees
 * - Video conference links (Google Meet)
 * - Physical and virtual locations
 * - Various durations (15m to 2h)
 * - Events organized by others
 * - All-day events
 * 
 * Events are generated relative to the date range requested to maintain
 * temporal consistency as users navigate the demo.
 */
const getMockCalendarEvents = (startDate: Date, endDate: Date): Promise<GoogleCalendarEvent[]> => {
  const events: GoogleCalendarEvent[] = [];
  
  // Helper to create dates within the range
  const getDateInRange = (daysOffset: number, hour: number, minute: number = 0): string => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + daysOffset);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  
  const isInRange = (daysOffset: number): boolean => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + daysOffset);
    return date >= startDate && date <= endDate;
  };

  // Event 1: Daily Standup (Recurring + Video + Meeting)
  if (isInRange(0)) {
    events.push({
      id: 'demo_event_1',
      summary: '🚀 Daily Team Standup',
      description: 'Quick sync on progress, blockers, and priorities for the day.',
      start: { dateTime: getDateInRange(0, 9, 30) },
      end: { dateTime: getDateInRange(0, 10, 0) },
      recurrence: ['RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR'],
      attendees: [
        { email: 'you@example.com', displayName: 'You', responseStatus: 'accepted', self: true },
        { email: 'sarah@example.com', displayName: 'Sarah Chen', responseStatus: 'accepted' },
        { email: 'james@example.com', displayName: 'James Wilson', responseStatus: 'accepted' },
        { email: 'priya@example.com', displayName: 'Priya Patel', responseStatus: 'tentative' },
      ],
      conferenceData: {
        entryPoints: [
          { entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij', label: 'meet.google.com/abc-defg-hij' },
        ],
        conferenceSolution: { name: 'Google Meet' },
      },
      organizer: { email: 'sarah@example.com', displayName: 'Sarah Chen', self: false },
    });
  }

  // Event 2: Client Meeting (Video + Location + Long Duration)
  if (isInRange(0)) {
    events.push({
      id: 'demo_event_2',
      summary: '💼 Q1 Strategy Review - Acme Corp',
      description: 'Quarterly business review with Acme Corp stakeholders.\n\nAgenda:\n1. Q4 performance recap\n2. Q1 goals alignment\n3. Budget discussion\n4. Next steps',
      location: 'Conference Room B, 5th Floor',
      start: { dateTime: getDateInRange(0, 14, 0) },
      end: { dateTime: getDateInRange(0, 16, 0) },
      attendees: [
        { email: 'you@example.com', displayName: 'You', responseStatus: 'accepted', self: true },
        { email: 'john.smith@acmecorp.com', displayName: 'John Smith', responseStatus: 'accepted' },
        { email: 'lisa.jones@acmecorp.com', displayName: 'Lisa Jones', responseStatus: 'accepted' },
        { email: 'david@example.com', displayName: 'David Lee', responseStatus: 'accepted' },
      ],
      conferenceData: {
        entryPoints: [
          { entryPointType: 'video', uri: 'https://meet.google.com/xyz-pqrs-tuv', label: 'meet.google.com/xyz-pqrs-tuv' },
        ],
        conferenceSolution: { name: 'Google Meet' },
      },
      organizer: { email: 'john.smith@acmecorp.com', displayName: 'John Smith', self: false },
    });
  }

  // Event 3: Coffee Chat (Physical Location + Short Duration)
  if (isInRange(1)) {
    events.push({
      id: 'demo_event_3',
      summary: '☕ Coffee with Alex',
      description: 'Casual catch-up to discuss career growth and mentorship.',
      location: 'Blue Bottle Coffee, Downtown',
      start: { dateTime: getDateInRange(1, 10, 0) },
      end: { dateTime: getDateInRange(1, 10, 45) },
      attendees: [
        { email: 'you@example.com', displayName: 'You', responseStatus: 'accepted', self: true },
        { email: 'alex.rivera@example.com', displayName: 'Alex Rivera', responseStatus: 'accepted' },
      ],
      organizer: { email: 'you@example.com', displayName: 'You', self: true },
    });
  }

  // Event 4: Weekly 1-on-1 (Recurring Weekly + Video)
  if (isInRange(2)) {
    events.push({
      id: 'demo_event_4',
      summary: '👥 Weekly 1:1 with Manager',
      description: 'Regular check-in to discuss progress, challenges, and development.',
      start: { dateTime: getDateInRange(2, 15, 30) },
      end: { dateTime: getDateInRange(2, 16, 0) },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=WE'],
      attendees: [
        { email: 'you@example.com', displayName: 'You', responseStatus: 'accepted', self: true },
        { email: 'manager@example.com', displayName: 'Maria Garcia', responseStatus: 'accepted', organizer: true },
      ],
      conferenceData: {
        entryPoints: [
          { entryPointType: 'video', uri: 'https://meet.google.com/mgr-weekly-sync', label: 'meet.google.com/mgr-weekly-sync' },
        ],
        conferenceSolution: { name: 'Google Meet' },
      },
      organizer: { email: 'manager@example.com', displayName: 'Maria Garcia', self: false },
    });
  }

  // Event 5: All-Day Event (Conference)
  if (isInRange(3)) {
    events.push({
      id: 'demo_event_5',
      summary: '🎤 Tech Conference 2026',
      description: 'Annual technology conference with keynotes, workshops, and networking.',
      location: 'Convention Center, Hall A',
      start: { date: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      end: { date: new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      organizer: { email: 'events@techconf.com', displayName: 'Tech Conference Team', self: false },
    });
  }

  // Event 6: Team Workshop (Long Meeting + Many Attendees)
  if (isInRange(4)) {
    events.push({
      id: 'demo_event_6',
      summary: '🎨 Design Sprint Workshop',
      description: 'Collaborative design sprint to brainstorm and prototype new features.\n\nBring your ideas!',
      location: 'Innovation Lab, Building 2',
      start: { dateTime: getDateInRange(4, 13, 0) },
      end: { dateTime: getDateInRange(4, 17, 0) },
      attendees: [
        { email: 'you@example.com', displayName: 'You', responseStatus: 'accepted', self: true },
        { email: 'designer1@example.com', displayName: 'Emma Thompson', responseStatus: 'accepted' },
        { email: 'designer2@example.com', displayName: 'Ryan Kim', responseStatus: 'accepted' },
        { email: 'pm@example.com', displayName: 'Sophie Martinez', responseStatus: 'accepted', organizer: true },
        { email: 'eng1@example.com', displayName: 'Michael Brown', responseStatus: 'declined' },
        { email: 'eng2@example.com', displayName: 'Nina Patel', responseStatus: 'needsAction' },
      ],
      conferenceData: {
        entryPoints: [
          { entryPointType: 'video', uri: 'https://zoom.us/j/123456789', label: 'Zoom Meeting' },
        ],
        conferenceSolution: { name: 'Zoom' },
      },
      organizer: { email: 'pm@example.com', displayName: 'Sophie Martinez', self: false },
    });
  }

  // Event 7: Quick Sync (No attendees, just a reminder)
  if (isInRange(5)) {
    events.push({
      id: 'demo_event_7',
      summary: '📝 Submit Monthly Report',
      description: 'Deadline to submit the monthly progress report to leadership.',
      start: { dateTime: getDateInRange(5, 17, 0) },
      end: { dateTime: getDateInRange(5, 17, 30) },
      organizer: { email: 'you@example.com', displayName: 'You', self: true },
    });
  }

  // Event 8: Recurring Monthly Team Lunch
  if (isInRange(6)) {
    events.push({
      id: 'demo_event_8',
      summary: '🍕 Monthly Team Lunch',
      description: 'Team bonding over food! This month: Italian cuisine.',
      location: 'Bella Italia Restaurant',
      start: { dateTime: getDateInRange(6, 12, 0) },
      end: { dateTime: getDateInRange(6, 13, 0) },
      recurrence: ['RRULE:FREQ=MONTHLY;BYMONTHDAY=28'],
      attendees: [
        { email: 'you@example.com', displayName: 'You', responseStatus: 'accepted', self: true },
        { email: 'sarah@example.com', displayName: 'Sarah Chen', responseStatus: 'accepted' },
        { email: 'james@example.com', displayName: 'James Wilson', responseStatus: 'accepted' },
        { email: 'priya@example.com', displayName: 'Priya Patel', responseStatus: 'accepted' },
        { email: 'david@example.com', displayName: 'David Lee', responseStatus: 'tentative' },
      ],
      organizer: { email: 'sarah@example.com', displayName: 'Sarah Chen', self: false },
    });
  }

  return Promise.resolve(events);
};

/**
 * AppProps: Mode-based configuration
 * DESIGN DECISION: Runtime mode selection vs build-time environments
 * 
 * Mode is a runtime prop rather than an environment variable to enable:
 * - Single deployment serving both demo and live modes
 * - Instant switching without rebuilds
 * - User-controlled mode selection from landing page
 */
interface AppProps {
  mode: 'demo' | 'live';
  onBack: () => void;
}

/**
 * Image Upload Constraints
 * DESIGN DECISION: Daily upload limits to prevent storage abuse
 * 
 * LocalStorage has a ~5MB quota. Without limits, users could hit quota quickly
 * with photos. 5 images/day balances utility with sustainability.
 * The compression service reduces each image to ~100-200KB.
 */
const MAX_IMAGES_PER_DAY = 5;
const toDateString = (date: Date) => date.toLocaleDateString('en-CA'); // YYYY-MM-DD format

/**
 * getTasksForDate: Task filtering with recurrence expansion
 * DESIGN DECISION: Client-side recurrence calculation
 * 
 * Rather than storing every instance of recurring tasks, we store the rule
 * and expand it on-demand. This saves storage and enables easy rule modifications.
 * 
 * Recurrence logic:
 * - Tasks with date field: Return if exact match
 * - Tasks with recurrence but no date: Expand based on rule
 *   - Daily: Return for all dates
 *   - Weekly: Check if date's weekday matches rule
 *   - Monthly: Check if date's day-of-month matches rule
 */
const getTasksForDate = (inv: LifeInventory, targetDateStr: string) => {
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const targetDateObj = new Date(y, m - 1, d);
    const dayOfWeek = targetDateObj.getDay();
    const dayOfMonth = targetDateObj.getDate();

    const isMatch = (t: Task) => {
        if (t.date === targetDateStr) return true;
        if (t.recurrence && !t.date) {
            if (t.recurrence.frequency === 'daily') return true;
            if (t.recurrence.frequency === 'weekly') {
                return t.recurrence.weekDays?.includes(dayOfWeek);
            }
            if (t.recurrence.frequency === 'monthly') {
                return t.recurrence.dayOfMonth === dayOfMonth;
            }
        }
        return false;
    };

    return {
        fixed: inv.fixed.filter(isMatch),
        flexible: inv.flexible.filter(isMatch)
    };
};

const App: React.FC<AppProps> = ({ mode, onBack }) => {
  /**
   * DESIGN DECISION: Temporal Navigation State
   * 
   * currentDate is the date being viewed/edited, which may be:
   * - Past (reflection mode)
   * - Today (active mode)
   * - Future (planning mode)
   * 
   * This enables "time travel" through schedules while keeping AI context-aware.
   */
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  /**
   * DESIGN DECISION: Sync Status Tracking
   * 
   * Explicit state machine for Google Calendar operations:
  /**
   * DESIGN DECISION: Memoized Service Singleton
   * 
   * GoogleCalendarService is memoized to:
   * 1. Preserve OAuth state across re-renders
   * 2. Prevent re-initialization of gapi client
   * 3. Maintain event listener registrations
   * 
   * The empty dependency array ensures one instance per App mount.
   */
  const calendarService = useMemo(() => new GoogleCalendarService(GOOGLE_CLIENT_ID), []);
  
  /**
   * DESIGN DECISION: Inventory State Initialization
   * 
   * Demo mode: Always loads INITIAL_INVENTORY with relative dates
   * - Ignores localStorage entirely
   * - Dates calculated relative to "today"
   * - Immutable (changes don't persist)
   * 
   * Live mode: Loads from localStorage or starts empty
   * - Persists on every change
   * - Enables Google Calendar sync
   * - Migrations can happen here (schema version checks)
   * 
   * The large demo setup block demonstrates sophisticated date calculations
   * to create a realistic week spanning past, present, and future.
   */
  
  /**
   * DESIGN DECISION: Sync Status State
   * 
   * Tracks Google Calendar sync operations:
   * - 'idle': No operation in progress
   * - 'importing': Reading from Google Calendar
   * - 'exporting': Writing to Google Calendar
   * - 'signingout': Revoking OAuth tokens
   * 
   * This prevents concurrent operations and provides UI feedback.
   */
  const [syncStatus, setSyncStatus] = useState<'idle' | 'importing' | 'exporting' | 'signingout'>('idle');
  const [showSyncInfo, setShowSyncInfo] = useState<{ type: 'import' | 'export' | 'signout', visible: boolean, error?: string }>({ type: 'import', visible: false });
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats>({
      percentage: 0,
      usedBytes: 0,
      totalQuota: 5 * 1024 * 1024,
      breakdown: { messages: 0, ledger: 0, inventory: 0, memories: 0 },
      messagesByDate: {}
  });  
  const toast = useToast();
  // Determine initial state based on tutorial completion
  const isFirstRun = !localStorage.getItem('life_tutorial_completed');
  
  const [inventory, setInventory] = useState<LifeInventory>(() => {
    // In demo mode, always load demo data and ignore localStorage
    if (mode === 'demo') {
        const today = new Date();
        const getDate = (offset: number) => {
            const d = new Date(today);
            d.setDate(d.getDate() + offset);
            return toDateString(d);
        };
        
        // Create dates for this week: Sunday → Saturday
        // Feb 22, 2026 is a Sunday (today = day 0, week ends on Saturday Feb 28)
        const day_0  = getDate(0); // Sunday  (today,    Feb 22)
        const day_p1 = getDate(1); // Monday  (tomorrow, Feb 23)
        const day_p2 = getDate(2); // Tuesday             Feb 24
        const day_p3 = getDate(3); // Wednesday           Feb 25
        const day_p4 = getDate(4); // Thursday            Feb 26
        const day_p5 = getDate(5); // Friday              Feb 27
        const day_p6 = getDate(6); // Saturday            Feb 28
        
        return {
            fixed: [
                // Sunday - Today (ACTIVE - Interview day)
                { id: 'w0_1', title: 'Grandma Physical Therapy', type: 'fixed', time: '10:00 AM', duration: '1h', priority: 'high', category: 'Family', date: day_0 },
                { id: 'w0_2', title: 'Interview with Capital One', type: 'fixed', time: '2:00 PM', duration: '1h', priority: 'high', category: 'Career', date: day_0 },

                // Monday - Tomorrow (PLANNING - Launch day)
                { id: 'w1_1', title: '[PLANNED] Project Launch: Phase 1', type: 'fixed', time: '9:00 AM', duration: '3h', priority: 'high', category: 'Career', date: day_p1 },
                { id: 'w1_2', title: '[PLANNED] Team Retrospective', type: 'fixed', time: '4:00 PM', duration: '1h', priority: 'medium', category: 'Career', date: day_p1 },

                // Tuesday (PLANNING - Outdoor + recovery)
                { id: 'w2_1', title: '[PLANNED] Hiking with Alex @ Redwood Trail', type: 'fixed', time: '8:00 AM', duration: '3h', priority: 'medium', category: 'Life', date: day_p2 },

                // Wednesday (PLANNING - Mid-week sync)
                { id: 'w3_1', title: '[PLANNED] Strategy Meeting', type: 'fixed', time: '11:00 AM', duration: '2h', priority: 'high', category: 'Career', date: day_p3 },

                // Thursday (PLANNING - Engineering day)
                { id: 'w4_1', title: '[PLANNED] Team Standup (Engineering)', type: 'fixed', time: '9:30 AM', duration: '30m', priority: 'medium', category: 'Career', date: day_p4 },
                { id: 'w4_2', title: '[PLANNED] Call with Grandpa', type: 'fixed', time: '10:30 AM', duration: '30m', priority: 'high', category: 'Family', date: day_p4 },

                // Friday (PLANNING - Demo day)
                { id: 'w5_1', title: '[PLANNED] Product Demo to Stakeholders', type: 'fixed', time: '3:00 PM', duration: '1h', priority: 'high', category: 'Career', date: day_p5 },

                // Saturday (PLANNING - Weekend social)
                { id: 'w6_1', title: '[PLANNED] Dinner with Mom', type: 'fixed', time: '6:30 PM', duration: '2h', priority: 'high', category: 'Family', date: day_p6 }
            ],
            flexible: [
                // Sunday - Today (ACTIVE)
                { id: 'wf0_1', title: 'Python Debugging Practice', type: 'flexible', duration: '2h', priority: 'medium', category: 'Career', date: day_0 },
                { id: 'wf0_2', title: 'Gym / Cardio', type: 'flexible', duration: '1h', priority: 'medium', category: 'Health', date: day_0 },

                // Monday (PLANNING - Work week)
                { id: 'wf1_1', title: 'Documentation Write-up', type: 'flexible', duration: '1.5h', priority: 'medium', category: 'Career', date: day_p1 },
                { id: 'wf1_2', title: 'Evening Gym Session', type: 'flexible', duration: '1h', priority: 'medium', category: 'Health', date: day_p1 },

                // Tuesday (PLANNING - Post-hike recovery)
                { id: 'wf2_1', title: 'Grocery Run (Meal Prep)', type: 'flexible', duration: '1h', priority: 'low', category: 'Life', date: day_p2 },
                { id: 'wf2_2', title: 'Read: "Range" by David Epstein', type: 'flexible', duration: '1h', priority: 'low', category: 'Life', date: day_p2 },

                // Wednesday (PLANNING)
                { id: 'wf3_1', title: 'Meal Prep for Week', type: 'flexible', duration: '2h', priority: 'medium', category: 'Health', date: day_p3 },
                { id: 'wf3_2', title: 'Review Weekly Goals', type: 'flexible', duration: '30m', priority: 'medium', category: 'Career', date: day_p3 },

                // Thursday (PLANNING)
                { id: 'wf4_1', title: 'Morning Gym Session', type: 'flexible', duration: '1h', priority: 'medium', category: 'Health', date: day_p4 },
                { id: 'wf4_2', title: 'Code Review: Auth Module', type: 'flexible', duration: '1h', priority: 'medium', category: 'Career', date: day_p4 },

                // Friday (PLANNING)
                { id: 'wf5_1', title: 'Yoga Class', type: 'flexible', duration: '45m', priority: 'medium', category: 'Health', date: day_p5 },
                { id: 'wf5_2', title: 'Interview Debrief Notes', type: 'flexible', duration: '1h', priority: 'medium', category: 'Career', date: day_p5 },

                // Saturday (PLANNING - Weekend)
                { id: 'wf6_1', title: 'Morning Run (5k)', type: 'flexible', duration: '30m', priority: 'medium', category: 'Health', date: day_p6 },
                { id: 'wf6_2', title: 'Apartment Deep Clean', type: 'flexible', duration: '2h', priority: 'low', category: 'Life', date: day_p6 }
            ]
        };
    }
    
    // In live mode, load from localStorage or return empty
    // Apply de-duplication to clean up any legacy duplicate IDs
    const saved = localStorage.getItem('life_inventory');
    if (saved) {
      const parsed = JSON.parse(saved) as LifeInventory;
      return {
        fixed: deduplicateTasks(parsed.fixed || []),
        flexible: deduplicateTasks(parsed.flexible || [])
      };
    }
    return EMPTY_INVENTORY;
  });

  /**
   * DESIGN DECISION: Ledger State Initialization
   * 
   * Follows same demo/live pattern as inventory.
   * Demo ledger includes various relationship statuses to demonstrate the Kinship Debt system.
   */
  const [ledger, setLedger] = useState<RelationshipLedger>(() => {
    // In demo mode, always load demo data and ignore localStorage
    if (mode === 'demo') {
        return INITIAL_LEDGER;
    }
    
    // In live mode, load from localStorage or return empty
    const saved = localStorage.getItem('life_ledger');
    if (saved) return JSON.parse(saved);
    return EMPTY_LEDGER;
  });

  /**
   * DESIGN DECISION: AI Memory System
   * 
   * Memories are user-specific learned facts that persist across sessions.
   * In demo mode, sample memories demonstrate:
   * - Preferences: Personal working styles
   * - Facts: Important context about relationships
   * - Decisions: Strategic choices to remember
   * 
   * The AI references these memories when making orchestration decisions,
   * creating a continuously adapting assistant.
   */
  const [memories, setMemories] = useState<Memory[]>(() => {
      // In demo mode, start with some learned preferences from the week
      if (mode === 'demo') {
          return [
              {
                  id: 'mem_1',
                  content: 'User prefers morning workouts (7-8 AM) to start the day with energy. Exception: post-launch days need lighter activity.',
                  date: new Date(Date.now() - 259200000).toISOString(), // Learned 3 days ago
                  type: 'preference'
              },
              {
                  id: 'mem_2',
                  content: 'Grandpa shows confusion in evenings. Always schedule calls in morning hours (9-11 AM) for best cognitive function.',
                  date: new Date(Date.now() - 172800000).toISOString(), // Learned 2 days ago
                  type: 'fact'
              },
              {
                  id: 'mem_3',
                  content: 'User recharges through outdoor social activities (hiking, walking). Prioritize these after intense work weeks.',
                  date: new Date(Date.now() - 86400000).toISOString(), // Learned yesterday
                  type: 'preference'
              },
              {
                  id: 'mem_4',
                  content: 'Before major technical interviews, user benefits from 1-2 hour Python practice warm-up session.',
                  date: new Date(Date.now() - 86400000).toISOString(), // Learned yesterday
                  type: 'decision'
              }
          ];
      }
      
      const saved = localStorage.getItem('life_memories');
      return saved ? JSON.parse(saved) : [];
  });

  /**
   * DESIGN DECISION: Date-Keyed Chat History
   * 
   * Chat messages are organized by date (YYYY-MM-DD) rather than a flat timeline.
   * This structure enables:
   * 
   * 1. Contextual conversations: The AI knows which date you're discussing
   * 2. Efficient loading: Only load today's messages, fetch others on-demand
   * 3. Storage optimization: Can delete old date ranges to free space
   * 4. Temporal navigation: View past conversations about specific days
   * 
   * Demo mode includes pre-written conversations showing AI capabilities:
   * - Past dates: Reflection on completed tasks
   * - Today: Active orchestration in progress
   * - Future dates: Planning conversations
   * 
   * This creates a realistic multi-day narrative for the demo experience.
   */
  const [allMessages, setAllMessages] = useState<ChatHistory>(() => {
      // In demo mode, always load demo data and ignore localStorage
      if (mode === 'demo') {
          const today = new Date();
          const getDate = (offset: number) => {
              const d = new Date(today);
              d.setDate(d.getDate() + offset);
              return d;
          };
          
          const createIso = (baseDate: Date, hours: number, mins: number) => {
              const d = new Date(baseDate);
              d.setHours(hours, mins, 0, 0);
              return d.toISOString();
          };
          
          // Create dates for this week: Sunday → Saturday (Feb 22 – Feb 28)
          const day_0  = getDate(0); // Sunday    (today,    Feb 22)
          const day_p1 = getDate(1); // Monday               Feb 23
          const day_p2 = getDate(2); // Tuesday              Feb 24
          const day_p3 = getDate(3); // Wednesday            Feb 25
          const day_p4 = getDate(4); // Thursday             Feb 26
          const day_p5 = getDate(5); // Friday               Feb 27
          const day_p6 = getDate(6); // Saturday             Feb 28

          const day_0_key  = toDateString(day_0);
          const day_p1_key = toDateString(day_p1);
          const day_p2_key = toDateString(day_p2);
          const day_p3_key = toDateString(day_p3);
          const day_p4_key = toDateString(day_p4);
          const day_p5_key = toDateString(day_p5);
          const day_p6_key = toDateString(day_p6);
          
          return {
              // Sunday - Today (ACTIVE - Interview day)
              [day_0_key]: [
                  { id: 'm0_1', role: 'model', timestamp: createIso(day_0, 8, 15), text: "📍 **ACTIVE MODE** - Today's Schedule Analysis (Sunday, Feb 22):\n\n**Fixed Anchors:**\n• 10:00 AM - Grandma's PT (1h)\n• 2:00 PM - Capital One Interview (1h)\n\n**Flexible Tasks:**\n• Python Debugging Practice (2h, HIGH)\n• Gym/Cardio (1h)\n• Check-in with Sarah (30m, CRITICAL)\n\n⚠️ **CAPACITY ALERT**: 5.5h of tasks is manageable, but Sarah is in CRITICAL status (Kinship Debt 12—6 days × Priority 2). She needs contact today.\n\n**Recommendation**: Schedule Sarah check-in at 4:30 PM right after the interview, while the feedback is fresh. She can mentor you on next steps.\n\nWould you like me to lock in this order?" },
                  { id: 'm0_2', role: 'user', timestamp: createIso(day_0, 8, 45), text: "Yes! Add Sarah right after the interview. She'll love hearing how it went." },
                  { id: 'm0_3', role: 'model', timestamp: createIso(day_0, 8, 46), thought: "User confirms Sarah call at 4:30 PM. This resets her Kinship Debt (currently CRITICAL at 12). Interview ends ~3 PM so 4:30 gives a 90-min debrief buffer. Good sequencing.", text: "✅ **Schedule Locked**:\n\n**10:00 AM** - Grandma's PT (1h) 👵\n**12:00 PM** - Python Debugging Practice (2h) 💻\n**2:00 PM** - Capital One Interview (1h) 🎯\n**3:30 PM** - Gym/Cardio (wind-down run) 🏃\n**4:30 PM** - Check-in with Sarah (30m) 📞\n\nThis clears Sarah's CRITICAL status and gives you exercise to decompress post-interview. Good luck today—you've got this!" },
                  { id: 'm0_4', role: 'user', timestamp: createIso(day_0, 13, 30), text: "Quick heads up—the interview got pushed to 3:30 PM. Can you re-orchestrate?" },
                  { id: 'm0_5', role: 'model', timestamp: createIso(day_0, 13, 31), thought: "Interview moved 1.5h later. New gap 2-3:30 PM available. Move Gym into that window for nervous energy release. Python practice right before interview (3:00-3:30) for technical warm-up. Sarah shifts to 5 PM.", text: "**EXECUTIVE PIVOT** — Interview shifted to 3:30 PM. Optimized reflow:", proposal: {
                      optimized_timeline: "10:00 AM - Grandma PT\n12:00 PM - Python Practice (2h technical warm-up)\n2:00 PM - Gym/Cardio (burn off nerves) ✓\n3:30 PM - Capital One Interview 🎯\n5:00 PM - Call with Sarah (post-interview debrief)",
                      reasoning: "Gym moves into the new 2:00 PM gap—exercise is proven to reduce pre-interview anxiety. Python practice stays at noon so your technical mind is fresh. Sarah's debrief shifts to 5 PM, right after results are fresh. Net result: same tasks, better sequencing for a high-stakes interview day.",
                      schedule: [
                        { id: 'w0_1', title: 'Grandma Physical Therapy', type: 'fixed', time: '10:00 AM', duration: '1h', priority: 'high', category: 'Family' },
                        { id: 'wf0_1', title: 'Python Debugging Practice', type: 'fixed', time: '12:00 PM', duration: '2h', priority: 'high', category: 'Career' },
                        { id: 'wf0_2', title: 'Gym / Cardio', type: 'fixed', time: '2:00 PM', duration: '1h', priority: 'medium', category: 'Health' },
                        { id: 'w0_2', title: 'Interview with Capital One', type: 'fixed', time: '3:30 PM', duration: '1h', priority: 'high', category: 'Career' },
                        { id: 'wf0_3', title: 'Check-in call with Sarah', type: 'fixed', time: '5:00 PM', duration: '30m', priority: 'high', category: 'Family' }
                      ]
                  }}
              ],

              // Monday - Launch Day (PLANNING)
              [day_p1_key]: [
                  { id: 'p1_1', role: 'model', timestamp: createIso(day_p1, 7, 0), text: "🗓️ **PLANNING MODE** - Monday, Feb 23 — Launch Day:\n\n**Fixed:**\n• 9:00 AM - Project Launch: Phase 1 (3h)\n• 4:00 PM - Team Retrospective (1h)\n\n**Flexible:**\n• Documentation Write-up (1.5h)\n• Evening Gym Session (1h)\n\n**Relationship Status:**\n• Sarah: Reset to 0 after Sunday call ✓\n• Grandma: Stable after PT ✓\n• Alex: 2 days since last contact ✓\n\n⚠️ **CAPACITY NOTE**: Launch + Retro = 4h of high-focus work. Keep Documentation light (after 2 PM). Gym in the evening to decompress.\n\nWant me to schedule the flex tasks around the launch windows?" },
                  { id: 'p1_2', role: 'user', timestamp: createIso(day_p1, 7, 30), text: "Yes, keep afternoon light. I'll need bandwidth to monitor launch metrics." },
                  { id: 'p1_3', role: 'model', timestamp: createIso(day_p1, 7, 31), thought: "User wants light afternoon for launch monitoring. Space Docs write-up after lunch, Gym after retro as a debrief ritual.", text: "✅ **Monday Schedule**:\n\n**9:00 AM** - Project Launch: Phase 1 (3h) 🚀\n**12:30 PM** - Documentation Write-up (1.5h)\n*[Monitoring window — 2-4 PM]*\n**4:00 PM** - Team Retrospective (1h)\n**6:30 PM** - Evening Gym Session (decompress + celebrate)\n\nLaunch day is set. Go ship it! 🎉" }
              ],

              // Tuesday - Hiking + Recovery (PLANNING)
              [day_p2_key]: [
                  { id: 'p2_1', role: 'model', timestamp: createIso(day_p2, 8, 0), text: "🗓️ **PLANNING MODE** - Tuesday, Feb 24:\n\n**Fixed:**\n• 8:00 AM - Hiking with Alex @ Redwood Trail (3h)\n\n**Flexible:**\n• Grocery Run / Meal Prep (1h)\n• Read: \"Range\" by David Epstein (1h)\n\n**Relationship Alert:**\n• Alex: Has been asking about this hike for weeks—Kinship Debt resets to 0 after today ✓\n\nLight day by design—post-launch recovery. Afternoon is wide open. Groceries and reading can float around your energy levels." },
                  { id: 'p2_2', role: 'user', timestamp: createIso(day_p2, 8, 30), text: "Perfect. I'll grab groceries on the way back from the trail." },
                  { id: 'p2_3', role: 'model', timestamp: createIso(day_p2, 8, 31), thought: "Combining grocery run with trail return is efficient. Alex's KD resets. This is a great recovery day.", text: "Smart batching! Updated plan:\n\n**8:00 AM** - Hiking with Alex (3h) 🥾\n**11:30 AM** - Grocery run on the way home (1h) 🛒\n**3:00 PM** - Read: \"Range\" (1h) 📖\n\nYou'll walk into Wednesday fully recovered and stocked. Enjoy the trail!" }
              ],

              // Wednesday - Mid-Week Sync (PLANNING)
              [day_p3_key]: [
                  { id: 'p3_1', role: 'model', timestamp: createIso(day_p3, 8, 0), text: "🗓️ **PLANNING MODE** - Wednesday, Feb 25:\n\n**Fixed:**\n• 11:00 AM - Strategy Meeting (2h)\n\n**Flexible:**\n• Meal Prep for Week (2h)\n• Review Weekly Goals (30m)\n\n**Relationship Check:**\n• Grandpa: Last contact was Friday (3 days ago). Kinship Debt = 3. Recommend a Thursday morning call before it escalates.\n• Alex & Sarah: Both stable after this week's interactions ✓\n\nAfternoon is free—meal prep early so evenings stay open. Weekly review after dinner keeps you grounded heading into the back half of the week." },
                  { id: 'p3_2', role: 'user', timestamp: createIso(day_p3, 8, 30), text: "Good idea on Grandpa—I'll put it in for Thursday morning." },
                  { id: 'p3_3', role: 'model', timestamp: createIso(day_p3, 8, 31), thought: "User confirms Grandpa call Thursday. This aligns with the existing Thursday inventory item (Call with Grandpa, 10:30 AM). KD will be at 4 by Thursday which is still manageable.", text: "✅ Grandpa call is already in Thursday's schedule at 10:30 AM (right after Team Standup). Perfect timing—morning calls keep him sharp.\n\n**Wednesday Plan:**\n\n**11:00 AM** - Strategy Meeting (2h)\n**2:00 PM** - Meal Prep for Week (2h) 🍱\n**7:00 PM** - Weekly Goals Review (30m)\n\nStrong mid-week anchor. See you tomorrow!" }
              ],

              // Thursday - Engineering Day (PLANNING)
              [day_p4_key]: [
                  { id: 'p4_1', role: 'model', timestamp: createIso(day_p4, 8, 0), text: "🗓️ **PLANNING MODE** - Thursday, Feb 26:\n\n**Fixed:**\n• 9:30 AM - Team Standup (30m)\n• 10:30 AM - Call with Grandpa (30m)\n\n**Flexible:**\n• Morning Gym Session (1h)\n• Code Review: Auth Module (1h)\n\n**Relationship Priority:**\n• Grandpa (Kinship Debt 4, Needs Attention) — call locked in ✓\n\nRelatively light schedule after Wednesday's meeting. Gym before standup front-loads the energy. Code review can flex to afternoon if morning runs long." },
                  { id: 'p4_2', role: 'user', timestamp: createIso(day_p4, 8, 30), text: "Looks good. I'll hit the gym at 7 AM before standup." },
                  { id: 'p4_3', role: 'model', timestamp: createIso(day_p4, 8, 31), thought: "User confirms 7 AM gym. Good front-loading. Standup at 9:30 gives ample buffer. Grandpa at 10:30 for morning clarity.", text: "✅ **Thursday Schedule**:\n\n**7:00 AM** - Morning Gym Session (1h) 💪\n**9:30 AM** - Team Standup (30m)\n**10:30 AM** - Call with Grandpa (30m) 📞\n**1:00 PM** - Code Review: Auth Module (1h)\n\nGrandpa's Kinship Debt resets to 0 after today's call. Strong engineering day ahead!" }
              ],

              // Friday - Demo Day (PLANNING)
              [day_p5_key]: [
                  { id: 'p5_1', role: 'model', timestamp: createIso(day_p5, 8, 0), text: "🗓️ **PLANNING MODE** - Friday, Feb 27:\n\n**Fixed:**\n• 3:00 PM - Product Demo to Stakeholders (1h)\n\n**Flexible:**\n• Yoga Class (45m)\n• Interview Debrief Notes (1h)\n\n**Weekend Preview:**\n• Saturday: Dinner with Mom (6:30 PM) — Mom's Kinship Debt will be at 5 days by Saturday. This resets it perfectly.\n\nLight Friday with one high-visibility event. Yoga in the morning grounds you before the demo. Debrief notes can wait until after—capture impressions while fresh." },
                  { id: 'p5_2', role: 'user', timestamp: createIso(day_p5, 8, 30), text: "I'll do yoga at 9 AM and write debrief notes right after the demo." },
                  { id: 'p5_3', role: 'model', timestamp: createIso(day_p5, 8, 31), thought: "Yoga at 9 AM, demo at 3 PM, debrief notes at 4 PM right after. Good momentum and capture flow.", text: "✅ **Friday Schedule**:\n\n**9:00 AM** - Yoga Class (45m) 🧘\n**3:00 PM** - Product Demo to Stakeholders (1h) 📊\n**4:15 PM** - Interview Debrief Notes (1h)\n\nPerfect end to the work week. Tomorrow night's dinner with Mom is the cherry on top. 🍒" }
              ],

              // Saturday - Weekend Social (PLANNING)
              [day_p6_key]: [
                  { id: 'p6_1', role: 'model', timestamp: createIso(day_p6, 9, 0), text: "🗓️ **PLANNING MODE** - Saturday, Feb 28 — Week's End:\n\n**Fixed:**\n• 6:30 PM - Dinner with Mom (2h)\n\n**Flexible:**\n• Morning Run (5k, 30m)\n• Apartment Deep Clean (2h)\n\n**Relationship Wrap-up:**\n• Mom: Kinship Debt resets tonight ✓\n• Grandma & Grandpa: Both stable after this week ✓\n• Alex: Reset Tuesday (hike) ✓\n• Sarah: Reset Sunday (call) ✓\n\n🎉 **Week Complete**: Every relationship maintained, interview done, launch shipped. Afternoon is yours—clean the apartment early so you walk into dinner stress-free." },
                  { id: 'p6_2', role: 'user', timestamp: createIso(day_p6, 9, 30), text: "What a week. Morning run, clean the apartment, then dinner with Mom. I'll take it." },
                  { id: 'p6_3', role: 'model', timestamp: createIso(day_p6, 9, 31), thought: "User satisfied with the week. All relationships maintained, career goals hit, health sustained. Wrap with positive reinforcement.", text: "✅ **Saturday Plan**:\n\n**8:00 AM** - Morning Run (5k) 🏃\n**10:00 AM** - Apartment Deep Clean (2h)\n**6:30 PM** - Dinner with Mom 🍽️\n\n**Weekly Summary:**\n✅ Capital One interview completed\n✅ Phase 1 launched\n✅ All 6 relationships maintained\n✅ 5 workouts completed\n✅ Zero burnout\n\nYou orchestrated a phenomenal week. See you Sunday! 🚀" }
              ]
          };
      }
      
                    // In live mode, load from localStorage
      const saved = localStorage.getItem('life_messages');
      let history: ChatHistory = saved ? JSON.parse(saved) : {};
      
      // If live mode, check inactivity - logic placeholder for now
      if (mode === 'live') {
          const now = Date.now();
          const lastActive = parseInt(localStorage.getItem('life_last_active') || '0');
          // e.g. if (now - lastActive > 6 * 3600 * 1000) ...
      }
      
      return history;
  });

  /**
   * Approved Orchestrations: Store accepted orchestration proposals per date
   * DESIGN DECISION: Reduce redundant AI processing by 70%
   * 
   * When user accepts an orchestration:
   * 1. Store the proposal with timestamp
   * 2. Mark as isActive = true
   * 3. AI stops calling get_relationship_status/get_life_context for simple task additions
   * 4. Invalidate (isActive = false) when user modifies tasks
   * 
   * Cleanup: Old orchestrations (>7 days) are automatically removed to save storage
   */
  const [approvedOrchestrations, setApprovedOrchestrations] = useState<Record<string, ApprovedOrchestration>>(() => {
      if (mode === 'demo') return {};
      const saved = localStorage.getItem('approved_orchestrations');
      return saved ? JSON.parse(saved) : {};
  });

  /**
   * DESIGN DECISION: Persistence Effect
   * 
   * All state changes automatically sync to localStorage (live mode only).
   * Demo mode explicitly skips persistence to prevent contamination of user data.
   * 
   * Why localStorage over IndexedDB for primary storage?
   * 1. Synchronous API simplifies state management (no async complexity)
   * 2. Atomic writes prevent partial state corruption
   * 3. 5MB quota is sufficient for single-user personal data
   * 4. Universal browser support without polyfills
   * 
   * The IndexedDB implementation (db.ts) is prepared for future migration
   * when features like vector search or offline sync become necessary.
   * 
   * Storage stats are updated asynchronously to avoid blocking renders.
   */
  useEffect(() => {
         // In demo mode, do NOT save to localStorage to avoid polluting live data
         if (mode === 'demo') return;
         
         localStorage.setItem('life_ledger', JSON.stringify(ledger)); 
         localStorage.setItem('life_inventory', JSON.stringify(inventory)); 
         localStorage.setItem('life_messages', JSON.stringify(allMessages));
         localStorage.setItem('life_memories', JSON.stringify(memories));
         localStorage.setItem('approved_orchestrations', JSON.stringify(approvedOrchestrations));
         localStorage.setItem('life_last_active', Date.now().toString()); // update active time
         
        // safe update of stats
        storageService.getStats().then(stats => setStorageStats(stats)).catch(e => console.error("Stats error", e));

  }, [ledger, inventory, memories, allMessages, approvedOrchestrations, mode]);
  
  // Cleanup old approved orchestrations (older than 7 days)
  useEffect(() => {
    if (mode === 'demo') return;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffStr = toDateString(cutoffDate);
    
    setApprovedOrchestrations(prev => {
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([dateKey]) => dateKey >= cutoffStr)
      );
      
      const removedCount = Object.keys(prev).length - Object.keys(cleaned).length;
      if (removedCount > 0) {
        console.log(`🧹 Removed ${removedCount} orchestration(s) older than 7 days`);
      }
      
      return cleaned;
    });
  }, [mode]); // Run only on mount
  
  // Clean up any potential hydration mismatches
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (backgroundOrchestrationTimerRef.current) {
        clearTimeout(backgroundOrchestrationTimerRef.current);
      }
    };
  }, []);

  const getModeTime = () => mode === 'demo' ? "9:00 AM" : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const updateCurrentDayMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      const key = toDateString(currentDate);
      setAllMessages(prev => ({ ...prev, [key]: updater(prev[key] || []) }));
  };

  const ledgerRef = useRef<RelationshipLedger>(ledger);
  useEffect(() => { ledgerRef.current = ledger; }, [ledger]);
  const inventoryRef = useRef<LifeInventory>(inventory);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);

  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('life_tutorial_completed'));
  const pendingProposalRef = useRef<OrchestrationProposal | null>(null);
  const pendingContactRef = useRef<Person[]>([]);
  const initializedDateRef = useRef<string>('');
  const justCompletedTutorialRef = useRef(false);
  // Orchestration proposal management
  const lastProposalTimeRef = useRef<number>(0);
  // Background orchestration tracking
  const tasksModifiedCountRef = useRef<number>(0);
  const backgroundOrchestrationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentDateAtScheduleRef = useRef<string>('');
  const lastUserMessageTimeRef = useRef<number>(0);
  
  const [processingProposal, setProcessingProposal] = useState(false);

  const dailyInventory = useMemo(() => getTasksForDate(inventory, toDateString(currentDate)), [inventory, currentDate]);
  const messages = useMemo(() => allMessages[toDateString(currentDate)] || [], [allMessages, currentDate]);

  // Reset AI session when date changes to prevent cross-date context bleed
  const handleDateChange = (date: Date) => {
    geminiService.resetSession();
    setCurrentDate(date);
  };

  const handleSendMessage = async (text: string, media: string | null, isHidden: boolean = false, isOrchestration: boolean = false) => {
    // Track user message time for background orchestration debouncing
    if (!isHidden) {
      lastUserMessageTimeRef.current = Date.now();
    }

    // Cancel any pending background orchestration when user sends a message
    if (backgroundOrchestrationTimerRef.current) {
      clearTimeout(backgroundOrchestrationTimerRef.current);
      backgroundOrchestrationTimerRef.current = null;
    }

    // Ensure session is initialized before sending
    if (!geminiService.chat) {
      console.log('[App] No active session detected, reinitializing before message send');
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let memoryContext = memories.length > 0 ? `\n\n== LONG-TERM MEMORY BANK ==\n${memories.map(m => `- [${m.date}] (${m.type}): ${m.content}`).join('\n')}` : "";
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const viewDate = new Date(currentDate);
      viewDate.setHours(0, 0, 0, 0);
      const temporalMode = viewDate < today ? 'REFLECTION' : viewDate > today ? 'PLANNING' : 'ACTIVE';
      
      // Check for active approved orchestration
      const dateKey = toDateString(currentDate);
      const activeOrchestration = approvedOrchestrations[dateKey];
      const orchestrationStatus = activeOrchestration && activeOrchestration.isActive
        ? `ACTIVE since ${new Date(activeOrchestration.approvedAt).toLocaleString()} - Day already orchestrated`
        : 'NONE - Day not orchestrated';
      
      geminiService.startNewSession(`
Session Context:
Target Date: ${currentDate.toLocaleDateString()} (Format for add_task: ${toDateString(currentDate)})
Current System Date: ${new Date().toLocaleDateString()} (${toDateString(new Date())})
Temporal Mode: ${temporalMode}
Approved Orchestration: ${orchestrationStatus}

IMPORTANT - When user says "this day", "today", "tonight":
→ They mean the TARGET DATE: ${toDateString(currentDate)}
→ NOT the current system date

Current Session Time: ${getModeTime()}
User Mode: ${mode}
User Timezone: ${timezone}
${memoryContext}`);
    }
    
    const currentDayMessages = messages;
    const imagesToday = currentDayMessages.filter(m => !!m.media).length;

    if (media && imagesToday >= MAX_IMAGES_PER_DAY) {
        alert(`Storage Limit: Maximum of ${MAX_IMAGES_PER_DAY} images per day allowed to preserve browser space. Please clear some history or try tomorrow.`);
        return;
    }

    const compressedMedia = media ? await compressImage(media) : null;
    const userMsgId = Math.random().toString(36).substr(2, 9);
    const modelMsgId = Math.random().toString(36).substr(2, 9);

    if (!isHidden) {
        updateCurrentDayMessages(prev => [...prev, { id: userMsgId, role: 'user', text, timestamp: new Date().toISOString(), media: compressedMedia || undefined }]);
    }
    updateCurrentDayMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: isOrchestration ? '🔄 Orchestrating your day...' : '', thought: '', timestamp: new Date().toISOString() }]);
    
    setIsLoading(true);
    setIsStreaming(true);
    
    // Fallback timer: Force-attach proposal if stream hangs
    const proposalFallbackTimer = setTimeout(() => {
      if (pendingProposalRef.current || pendingContactRef.current.length > 0) {
        console.warn('Proposal fallback triggered - attaching pending items without waiting for full stream');
        updateCurrentDayMessages(prev => {
          const newArr = [...prev];
          const last = newArr[newArr.length - 1];
          if (last && last.role === 'model' && last.id === modelMsgId) {
            if (pendingProposalRef.current && !last.proposal) {
              last.proposal = pendingProposalRef.current!;
              pendingProposalRef.current = null;
              // Add fallback message if text is empty
              if (!last.text) {
                last.text = 'I\'ve prepared an orchestration for you:';
              }
            }
            if (pendingContactRef.current.length > 0 && !last.contactProposals) {
              last.contactProposals = [...pendingContactRef.current];
              pendingContactRef.current = [];
            }
          }
          return [...newArr];
        });
        setIsLoading(false);
      }
    }, 5000); // 5 second fallback
    
    try {
      await geminiService.sendMessageStream(text, compressedMedia, executors, (streamText, streamThought) => {
          updateCurrentDayMessages(prev => {
              const newArr = [...prev]; const last = newArr[newArr.length - 1];
              if (last && last.role === 'model' && last.id === modelMsgId) {
                  last.text = streamText;
                  last.thought = streamThought;
                  // Show proposals immediately during streaming
                  if (pendingProposalRef.current && !last.proposal) {
                      last.proposal = pendingProposalRef.current;
                      pendingProposalRef.current = null;
                  }
                  if (pendingContactRef.current.length > 0 && !last.contactProposals) {
                      last.contactProposals = [...pendingContactRef.current];
                      pendingContactRef.current = [];
                  }
              }
              return newArr;
          });
          if (streamText || streamThought) setIsLoading(false);
      }, getModeTime(), isOrchestration);
    } catch (error: any) { 
        console.error("SendMessage Error:", error);
        const errorMsg = error.message?.includes('timeout') 
          ? 'Request timed out. The orchestration may be ready but the explanation is incomplete.'
          : `Failed to send message: ${error.message || "Unknown error"}`;
        alert(errorMsg);
    } finally { 
        clearTimeout(proposalFallbackTimer); // Clear fallback timer
        setIsLoading(false);
        setIsStreaming(false);
        
        // Background orchestration disabled - using manual "Orchestrate Day" button instead
        // scheduleBackgroundOrchestration();
    }
  };

  const handleDeleteMessage = (msgId: string) => {
      const key = toDateString(currentDate);
      setAllMessages(prev => ({
          ...prev,
          [key]: (prev[key] || []).filter(m => m.id !== msgId)
      }));
  };

  const handleClearDateHistory = (date: string) => {
      setAllMessages(prev => {
          const next = { ...prev };
          delete next[date];
          return next;
      });
      // Explicitly refresh stats after clearing to update UI immediately
      setTimeout(() => {
          storageService.getStats().then(stats => setStorageStats(stats)).catch(e => console.error("Stats refresh error", e));
      }, 100);
  };

  const handleClearAllHistory = async () => {
      if (confirm("Are you sure? This will wipe ALL data, including the inventory, ledger, memories, and chat history. The app will reset to a fresh install state.")) {
          await storageService.clearAll();
          localStorage.clear();
          window.location.reload();
      }
  };

  /**
   * DESIGN DECISION: AI Tool Executors (Function Calling)
   * 
   * The executors object defines the functions the AI can invoke using Google Gemini's
   * function calling feature. This architecture enables:
   * 
   * 1. **Declarative AI actions**: The AI requests actions via structured JSON,
   *    which we validate and execute safely on the client.
   * 
   * 2. **Security boundaries**: All functions have validation logic. The AI cannot
   *    execute arbitrary code, only pre-defined, validated operations.
   * 
   * 3. **Temporal safety**: Functions like proposeOrchestration validate date constraints
   *    (e.g., cannot orchestrate past dates) regardless of AI intent.
   * 
   * 4. **State access via refs**: Using refs (ledgerRef, inventoryRef) ensures
   *    executors always access current state, even during async operations.
   * 
   * Key executors:
   * - get_relationship_status: Returns current ledger for Kinship Debt calculations
   * - get_life_context: Returns tasks for a specific date (with recurrence expansion)
   * - propose_orchestration: Generates a complete daily schedule proposal
   * - update_relationship_status: Modifies people in the ledger
   * - add_task/delete_task: Task CRUD operations
   * - move_tasks: Multi-task rescheduling for overload management
   * - save_memory: Persists AI learning for future sessions
   * 
   * The AI's system prompt teaches it when and how to use each executor.
   */

  const scheduleBackgroundOrchestration = () => {
    // Cancel any existing timer
    if (backgroundOrchestrationTimerRef.current) {
      clearTimeout(backgroundOrchestrationTimerRef.current);
      backgroundOrchestrationTimerRef.current = null;
    }

    // Guard 1: Must have modifications to orchestrate
    if (tasksModifiedCountRef.current === 0) {
      return;
    }

    // Guard 2: Cannot orchestrate if currently streaming
    if (isStreaming) {
      return;
    }

    // Guard 3: Date must match viewing date (prevent stale orchestrations)
    const currentDateKey = toDateString(currentDate);
    currentDateAtScheduleRef.current = currentDateKey;

    // Guard 4: Cannot orchestrate if there's a pending proposal
    if (pendingProposalRef.current) {
      return;
    }

    // Schedule orchestration with debounce (3-6 second random delay)
    const delay = 3000 + Math.random() * 3000;
    backgroundOrchestrationTimerRef.current = setTimeout(async () => {
      // Re-validate guards at execution time (user might have changed state during delay)
      if (
        tasksModifiedCountRef.current === 0 ||
        isStreaming ||
        toDateString(currentDate) !== currentDateAtScheduleRef.current ||
        pendingProposalRef.current
      ) {
        backgroundOrchestrationTimerRef.current = null;
        return;
      }

      // Guard 5: Check if user sent a message recently (within 2 seconds)
      const timeSinceLastUserMessage = Date.now() - lastUserMessageTimeRef.current;
      if (timeSinceLastUserMessage < 2000) {
        // User is actively typing/messaging, reschedule
        scheduleBackgroundOrchestration();
        return;
      }

      // Execute background orchestration
      console.log('🔄 Triggering background orchestration after task modifications');
      console.log('📋 Sending EXECUTIVE DIRECTIVE to AI for mandatory orchestration');
      backgroundOrchestrationTimerRef.current = null;
      tasksModifiedCountRef.current = 0; // Reset counter

      // Trigger orchestration as hidden message - phrased as user request to bypass AI decision-making
      handleSendMessage(
        'Reorganize my entire day now that I\'ve added these new tasks. Show me a complete orchestration.',
        null,
        true // isHidden flag
      );
    }, delay);
  };

  /**
   * Invalidate approved orchestration for a specific date.
   * Called when user modifies tasks (add/delete/update) to mark the orchestration as stale.
   * This ensures the AI will re-orchestrate the day on next "Orchestrate Day" click.
   */
  const invalidateApprovedOrchestration = (dateKey: string) => {
    setApprovedOrchestrations(prev => {
      const existing = prev[dateKey];
      if (!existing || !existing.isActive) return prev; // No active orchestration to invalidate
      
      console.log(`🔄 Invalidating approved orchestration for ${dateKey} due to task modification`);
      return {
        ...prev,
        [dateKey]: { ...existing, isActive: false }
      };
    });
  };

  const executors = {
    getRelationshipStatus: async () => ledgerRef.current,
    getLifeContext: async (args?: { date?: string }) => getTasksForDate(inventoryRef.current, args?.date || toDateString(currentDate)),
    proposeOrchestration: async (newProposal: OrchestrationProposal) => {
      console.log('🎯 proposeOrchestration CALLED by AI with proposal:', newProposal);
      
      // Tool permission validation: prevent orchestrating past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const viewDate = new Date(currentDate);
      viewDate.setHours(0, 0, 0, 0);
      
      if (viewDate < today) {
        return "❌ Cannot orchestrate past dates. Past dates are for reflection only. Please navigate to today or a future date to create new orchestrations.";
      }
      
      // Debounce protection
      const now = Date.now();
      if (now - lastProposalTimeRef.current < 5000) {
        return "⏳ Please wait a moment before requesting another orchestration. The previous proposal is still being processed.";
      }
      lastProposalTimeRef.current = now;
      
      // Auto-dismiss old proposals for this date
      const hadExistingProposal = messages.some(msg => msg.proposal);
      updateCurrentDayMessages(prev => 
        prev.map(msg => {
          if (msg.proposal) {
            return { 
              ...msg, 
              proposal: undefined,
              thought: (msg.thought || '') + ' [Previous proposal auto-dismissed due to new orchestration request]'
            };
          }
          return msg;
        })
      );
      
      pendingProposalRef.current = newProposal;
      tasksModifiedCountRef.current = 0; // Reset counter since we're now proposing the orchestration
      return hadExistingProposal 
        ? "✅ New proposal generated. Previous proposal has been replaced." 
        : "✅ Proposal generated.";
    },
    updateRelationshipStatus: async (args: UpdateRelationshipArgs) => {
        const currentLedger = ledgerRef.current;
        const normalize = (s: string) => s.toLowerCase().trim();
        const targetName = normalize(args.person_name);
        const matchedKey = Object.keys(currentLedger).find(k => normalize((currentLedger[k] as Person).name) === targetName || normalize(k) === targetName);

        // Use the current viewing date for last_contact, not system time
        const contactDate = toDateString(currentDate);

        if (!matchedKey) {
            const newPerson: Person = {
                name: args.person_name, relation: args.relation || "New Contact", category: args.category || 'Network',
                priority: 3, notes: args.notes_update, status: args.status_level, last_contact: contactDate,
                image: `https://ui-avatars.com/api/?name=${args.person_name}&background=random`
            };
            if (args.confirmed) {
                // User explicitly asked to add — skip the proposal card and add directly
                await handleAddPerson(newPerson);
                return `Added ${args.person_name} to the Kinship Ledger.`;
            } else {
                pendingContactRef.current.push(newPerson);
                return `Proposal to add ${args.person_name} prepared.`;
            }
        } else {
            setLedger(prev => ({ ...prev, [matchedKey]: { ...(prev[matchedKey] as Person), notes: args.notes_update, status: args.status_level, last_contact: contactDate } }));
            return `Updated ${args.person_name}'s ledger.`;
        }
    },
    addTask: async (task: Omit<Task, 'id'>) => {
        console.log('addTask called with:', JSON.stringify(task, null, 2));
        
        const isRecurring = !!task.recurrence;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const viewDate = new Date(currentDate);
        viewDate.setHours(0, 0, 0, 0);
        
        // Temporal mode validation: Block fixed tasks with time slots on past dates
        if (viewDate < today && task.type === 'fixed' && task.time) {
          console.warn('Blocked past date task:', task.title, 'for date:', toDateString(currentDate));
          return "❌ Cannot schedule fixed tasks with specific times on past dates. Past dates are for reflection only. For historical records, use flexible tasks without times, or navigate to today/future to schedule new tasks.";
        }
        
        const taskDate = isRecurring ? undefined : (task.date || toDateString(currentDate));
        
        // Build set of existing IDs to ensure uniqueness
        const existingIds = new Set([...inventoryRef.current.fixed, ...inventoryRef.current.flexible].map(t => t.id));
        
        const newTask: Task = { 
            ...task, 
            id: generateUniqueTaskId(existingIds), 
            date: taskDate
        };
        
        console.log('Adding task:', newTask.title, 'to date:', taskDate, 'current view:', toDateString(currentDate));
        
        setInventory(prev => {
            const listKey = newTask.type === 'fixed' ? 'fixed' : 'flexible';
            return { ...prev, [listKey]: [...prev[listKey], newTask] };
        });
        
        // Flag that tasks were modified for background orchestration
        tasksModifiedCountRef.current += 1;
        
        // Invalidate approved orchestration since tasks have been modified
        if (taskDate) {
          invalidateApprovedOrchestration(taskDate);
        }
        
        // Provide context about where the task was added
        if (viewDate < today) {
          return `✅ Added "${newTask.title}" to ${taskDate} as a historical record (reflection mode).`;
        } else if (viewDate > today) {
          return `✅ Added "${newTask.title}" to future date ${taskDate} (planning mode).`;
        } else {
          return `✅ Added "${newTask.title}" to today's schedule (${taskDate}).`;
        }
    },
    deleteTask: async (title: string) => {
        const normalize = (s: string) => s.toLowerCase().trim();
        const target = normalize(title);
        let deleted = false;
        let deletedTaskName = '';
        let deletedTaskDate: string | undefined;
        
        setInventory(prev => {
            // Find exact matches only
            const fixedExactMatches = prev.fixed.filter(t => normalize(t.title) === target);
            const flexibleExactMatches = prev.flexible.filter(t => normalize(t.title) === target);
            
            const allExactMatches = [...fixedExactMatches, ...flexibleExactMatches];
            
            // If multiple exact matches, ask for clarification
            if (allExactMatches.length > 1) {
                const list = allExactMatches.map((t, i) => `${i+1}) ${t.title} (${t.type}, ${t.time || 'no time'})`).join('\n');
                throw new Error(`Multiple tasks found:\n${list}\n\nPlease be more specific or delete them one at a time.`);
            }
            
            // Single exact match - delete it
            if (allExactMatches.length === 1) {
                deleted = true;
                const match = allExactMatches[0];
                deletedTaskName = match.title;
                deletedTaskDate = match.date;
                if (fixedExactMatches.length > 0) {
                    return { ...prev, fixed: prev.fixed.filter(t => t.id !== match.id) };
                } else {
                    return { ...prev, flexible: prev.flexible.filter(t => t.id !== match.id) };
                }
            }
            
            return prev;
        });
        
        if (!deleted) {
            // No exact match - search for similar tasks to help user
            const allTasks = [...inventoryRef.current.fixed, ...inventoryRef.current.flexible];
            const similar = allTasks.filter(t => normalize(t.title).includes(target) || target.includes(normalize(t.title)));
            
            if (similar.length > 0) {
                const list = similar.map(t => `"${t.title}"`).join(', ');
                return `No exact match found. Did you mean: ${list}? Please use the exact task name.`;
            }
            return `No task found with name "${title}". Please check spelling and use the exact task name.`;
        }
        
        // Flag that tasks were modified for background orchestration
        tasksModifiedCountRef.current += 1;
        
        // Invalidate approved orchestration since tasks have been modified
        if (deletedTaskDate) {
          invalidateApprovedOrchestration(deletedTaskDate);
        }
        
        return `Removed task "${deletedTaskName}".`;
    },
    deleteRelationshipStatus: async (name: string) => {
        const normalize = (s: string) => s.toLowerCase().trim();
        const target = normalize(name);
        let deleted = false;
        setLedger(prev => {
            const entry = Object.entries(prev).find(([_, p]) => normalize((p as Person).name).includes(target));
            if (entry) { deleted = true; const newL = { ...prev }; delete newL[entry[0]]; return newL; }
            return prev;
        });
        return deleted ? `Removed ${name}.` : "No contact found.";
    },
    saveMemory: async (content: string, type: 'preference' | 'decision' | 'fact') => {
        setMemories(prev => {
            const newMemory = { id: Math.random().toString(36).substr(2, 9), content, type, date: new Date().toLocaleDateString() };
            const updated = [ ...prev, newMemory ];
            
            // Enforce 100 memory limit with FIFO (keep most recent)
            if (updated.length > 100) {
                return updated.slice(-100);
            }
            return updated;
        });
        return `Saved to memory: "${content}"`;
    },
    moveTasks: async (taskIdentifiers: string[], targetDate: string) => {
        const normalize = (s: string) => s.toLowerCase().trim();
        const targets = taskIdentifiers.map(normalize);
        const currentInv = inventoryRef.current;
        let movedCount = 0;
        const movedNames: string[] = [];

        const updateTask = (t: Task) => {
            const normTitle = normalize(t.title);
            const match = targets.find(target => normTitle === target || normTitle.includes(target));
            if (match) {
                movedCount++;
                movedNames.push(t.title);
                return { ...t, date: targetDate };
            }
            return t;
        };

        const newFixed = currentInv.fixed.map(updateTask);
        const newFlexible = currentInv.flexible.map(updateTask);

        if (movedCount > 0) {
            // Collect source dates before updating inventory
            const sourceDates = new Set<string>();
            [...currentInv.fixed, ...currentInv.flexible].forEach(t => {
                if (movedNames.includes(t.title) && t.date) sourceDates.add(t.date);
            });
            
            setInventory({ fixed: newFixed, flexible: newFlexible });
            // Flag that tasks were modified for background orchestration
            tasksModifiedCountRef.current += 1;
            
            // Invalidate orchestrations for both source and target dates
            sourceDates.forEach(date => invalidateApprovedOrchestration(date));
            invalidateApprovedOrchestration(targetDate);
            
            return `Moved ${movedCount} tasks to ${targetDate}: ${movedNames.join(', ')}.`;
        }
        return "No tasks found to move.";
    }
  };

  useEffect(() => {
    const dateKey = toDateString(currentDate);
    if (initializedDateRef.current === dateKey) return;
    
    // Cancel background orchestration when date changes
    if (backgroundOrchestrationTimerRef.current) {
      clearTimeout(backgroundOrchestrationTimerRef.current);
      backgroundOrchestrationTimerRef.current = null;
    }
    tasksModifiedCountRef.current = 0; // Reset counter for new date
    
    // Don't auto-brief if tutorial is showing or if we already have messages
    if (showTutorial) return;
    
    // Safety check: if we JUST finished the tutorial, we likely triggered an intro message.
    // We should skip the daily briefing in this specific race condition.
    if (justCompletedTutorialRef.current) {
        // Reset the ref so next page load works fine
        justCompletedTutorialRef.current = false;
        initializedDateRef.current = dateKey; // Mark as "handled" so it doesn't try again
        return;
    }

    if (allMessages[dateKey] && allMessages[dateKey].length > 0) {
        initializedDateRef.current = dateKey;
        return;
    }

    initializedDateRef.current = dateKey;
    
    const yesterday = new Date(currentDate); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateString(yesterday);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let memoryContext = memories.length > 0 ? `\n\n== LONG-TERM MEMORY BANK ==\n${memories.map(m => `- [${m.date}] (${m.type}): ${m.content}`).join('\n')}` : "";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const viewDate = new Date(currentDate);
    viewDate.setHours(0, 0, 0, 0);
    const temporalMode = viewDate < today ? 'REFLECTION' : viewDate > today ? 'PLANNING' : 'ACTIVE';
    
    // Check for active approved orchestration
    const orchestrationDateKey = toDateString(currentDate);
    const activeOrchestration = approvedOrchestrations[orchestrationDateKey];
    const orchestrationStatus = activeOrchestration && activeOrchestration.isActive
      ? `ACTIVE since ${new Date(activeOrchestration.approvedAt).toLocaleString()} - Day already orchestrated`
      : 'NONE - Day not orchestrated';
    
    geminiService.startNewSession(`
Session Context:
Target Date: ${currentDate.toLocaleDateString()} (Format for add_task: ${toDateString(currentDate)})
Current System Date: ${new Date().toLocaleDateString()} (${toDateString(new Date())})
Temporal Mode: ${temporalMode}
Approved Orchestration: ${orchestrationStatus}

IMPORTANT - When user says "this day", "today", "tonight":
→ They mean the TARGET DATE: ${toDateString(currentDate)}
→ NOT the current system date

Current Session Time: ${getModeTime()}
User Mode: ${mode}
User Timezone: ${timezone}
${memoryContext}`);

    const startBriefing = async () => {
      const timestamp = new Date().toISOString();
      const modelId = Math.random().toString(36).substr(2, 9);
      updateCurrentDayMessages(() => [{ id: modelId, role: 'model', text: '', thought: '', timestamp }]);
      setIsLoading(true);
      setIsStreaming(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const viewDate = new Date(currentDate);
        viewDate.setHours(0, 0, 0, 0);
        
        let temporalContext = '';
        if (viewDate < today) {
          temporalContext = 'REFLECTION MODE: Looking back at';
        } else if (viewDate > today) {
          temporalContext = 'PLANNING MODE: Looking ahead to';
        } else {
          temporalContext = 'ACTIVE MODE: Today is';
        }
        
        const briefingPrompt = mode === 'demo' 
            ? `${temporalContext} ${currentDate.toLocaleDateString()}. IMPORTANT: First call get_relationship_status and get_life_context to retrieve current data, then provide your briefing. Compare with ${yesterdayStr}. Explicitly mention that you are assuming the context of 9:00 AM on this specific date for the simulation.`
            : `${temporalContext} ${currentDate.toLocaleDateString()}. IMPORTANT: First call get_relationship_status and get_life_context to retrieve current data, then provide your briefing. Compare with ${yesterdayStr}.`;

        await geminiService.sendMessageStream(briefingPrompt, null, executors, (text, thought) => {
            updateCurrentDayMessages(prev => {
                const newArr = [...prev]; const last = newArr[newArr.length - 1];
                if (last && last.role === 'model' && last.id === modelId) { last.text = text; last.thought = thought; }
                return newArr;
            });
            if (text || thought) setIsLoading(false);
        }, getModeTime());
      } catch (error) { console.error(error); } finally { 
        setIsLoading(false);
        setIsStreaming(false);
      }
    };
    startBriefing();
  }, [currentDate, showTutorial]);

  const handleUpdateTask = (task: Task) => {
    setInventory(prev => {
      const fixed = prev.fixed.filter(t => t.id !== task.id);
      const flexible = prev.flexible.filter(t => t.id !== task.id);
      if (task.type === 'fixed') return { fixed: [...fixed, task], flexible };
      else return { fixed, flexible: [...flexible, task] };
    });
    
    // Invalidate approved orchestration since task has been modified
    if (task.date) {
      invalidateApprovedOrchestration(task.date);
    }
  };
  
  const handleManualAddTask = (task: Task) => {
    const isRecurring = !!task.recurrence;
    const taskToAdd = { ...task, date: isRecurring ? undefined : task.date };
    setInventory(prev => ({ ...prev, [taskToAdd.type]: [...prev[taskToAdd.type], taskToAdd] }));
    
    // Invalidate orchestration for the task's date
    if (taskToAdd.date) {
      invalidateApprovedOrchestration(taskToAdd.date);
    }
    
    handleSendMessage(`I've added "${taskToAdd.title}" (${taskToAdd.type}, ${taskToAdd.duration}) to my task inventory. Does this affect my schedule in any way I should know about? Would you recommend orchestrating the day?`, null);
  };

  const handleDeleteTask = (id: string) => {
    // Find the task being deleted to get its date
    const allTasks = [...inventoryRef.current.fixed, ...inventoryRef.current.flexible];
    const taskToDelete = allTasks.find(t => t.id === id);
    
    setInventory(prev => ({ 
      fixed: prev.fixed.filter(t => t.id !== id), 
      flexible: prev.flexible.filter(t => t.id !== id) 
    }));
    
    // Invalidate approved orchestration since task has been deleted
    if (taskToDelete?.date) {
      invalidateApprovedOrchestration(taskToDelete.date);
    }
  };
  
  const handleOrchestrate = () => {
    handleSendMessage('Orchestrate my day. Analyze my current schedule and propose a complete daily reorganization.', null, false, true);
  };
  
  const handleUpdatePerson = async (oldName: string, p: Person) => {
      let finalPerson = p;
      if (p.image && p.image.startsWith('data:image')) {
          const compressed = await compressImage(p.image, 200, 200, 0.6);
          finalPerson = { ...p, image: compressed };
      }
      setLedger(prev => { 
          const newL = { ...prev }; 
          const key = Object.keys(newL).find(k => (newL[k] as Person).name === oldName) || oldName.toLowerCase(); 
          newL[key] = finalPerson; 
          return newL; 
      });
  };
  
  const handleAddPerson = async (p: Person) => {
    let finalPerson = p;
    if (p.image && p.image.startsWith('data:image')) {
        const compressed = await compressImage(p.image, 200, 200, 0.6);
        finalPerson = { ...p, image: compressed };
    }
    setLedger(prev => ({ ...prev, [p.name.toLowerCase()]: finalPerson }));
    // No automatic message - let user control when to orchestrate via button
  };

  const handleDeletePerson = (name: string) => setLedger(prev => { const newL = { ...prev }; const key = Object.keys(newL).find(k => (newL[k] as Person).name === name); if (key) delete newL[key]; return newL; });

  const acceptContact = (person: Person) => {
    handleAddPerson(person);
    updateCurrentDayMessages(prev => prev.map(msg => {
      if (!msg.contactProposals?.includes(person)) return msg;
      const remaining = msg.contactProposals.filter(p => p !== person);
      return { ...msg, contactProposals: remaining.length > 0 ? remaining : undefined };
    }));
  };
  const acceptAllContacts = (persons: Person[]) => {
    persons.forEach(p => handleAddPerson(p));
    updateCurrentDayMessages(prev => prev.map(msg => {
      if (!msg.contactProposals) return msg;
      const remaining = msg.contactProposals.filter(p => !persons.includes(p));
      return { ...msg, contactProposals: remaining.length > 0 ? remaining : undefined };
    }));
  };
  const rejectContact = (person: Person) => { 
      handleSendMessage(`Understood.`, null); 
      updateCurrentDayMessages(prev => prev.map(msg => {
        if (!msg.contactProposals?.includes(person)) return msg;
        const remaining = msg.contactProposals.filter(p => p !== person);
        return { ...msg, contactProposals: remaining.length > 0 ? remaining : undefined };
      })); 
  };
  
  const acceptProposal = async (proposal: OrchestrationProposal) => {
    // Race condition guard
    if (processingProposal) return;
    setProcessingProposal(true);
    
    try {
      // Date validation: ensure proposal is for current viewing date
      const todayStr = toDateString(currentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const viewDate = new Date(currentDate);
      viewDate.setHours(0, 0, 0, 0);
      
      if (viewDate < today) {
        toast.showError('Cannot accept proposals for past dates');
        setProcessingProposal(false);
        return;
      }
      
      // Save current state for potential rollback
      const previousInventory = inventory;
      
      try {
        setInventory(prev => {
            const fixed = prev.fixed.filter(t => t.date !== todayStr);
            const flexible = prev.flexible.filter(t => t.date !== todayStr);
            
            // Build set of existing IDs (from tasks not being replaced) to ensure uniqueness
            const existingIds = new Set([...fixed, ...flexible].map(t => t.id));
            
            const newFixed: Task[] = [];
            const newFlexible: Task[] = [];
            proposal.schedule.forEach(t => {
                // Generate new unique ID for each task to prevent duplicate key warnings
                const newId = generateUniqueTaskId(existingIds);
                existingIds.add(newId); // Track newly generated IDs to prevent collisions within batch
                const taskWithDate = { 
                    ...t, 
                    date: todayStr,
                    id: newId 
                };
                if (t.type === 'fixed') newFixed.push(taskWithDate);
                else newFlexible.push(taskWithDate);
            });
            return { fixed: [...fixed, ...newFixed], flexible: [...flexible, ...newFlexible] };
        });
        
        // Save approved orchestration for performance optimization
        const approvedOrchestration: ApprovedOrchestration = {
          date: todayStr,
          proposal: proposal,
          approvedAt: new Date().toISOString(),
          isActive: true
        };
        setApprovedOrchestrations(prev => ({
          ...prev,
          [todayStr]: approvedOrchestration
        }));
        console.log(`✅ Saved approved orchestration for ${todayStr}`);
        
        handleSendMessage(`I accept the orchestration proposal for today. The timeline looks solid: \n\n${proposal.optimized_timeline}`, null);
        updateCurrentDayMessages(prev => prev.map(msg => msg.proposal === proposal ? { ...msg, proposal: undefined } : msg));
      } catch (error) {
        // Rollback on error
        console.error('Error accepting proposal:', error);
        setInventory(previousInventory);
        toast.showError('Failed to apply orchestration. Changes have been reverted.');
      }
    } finally {
      setProcessingProposal(false);
    }
  };

  const handleExportToGoogle = async () => {
    if (mode === 'demo') {
        setSyncStatus('exporting');
        const tasksForDate = [...dailyInventory.fixed, ...dailyInventory.flexible];
        const taskCount = tasksForDate.length;
        const taskTitles = tasksForDate.slice(0, 3).map(t => `• ${t.title}`).join('\n');
        const more = taskCount > 3 ? `\n... and ${taskCount - 3} more` : '';
        
        setTimeout(() => {
            setSyncStatus('idle');
            setShowSyncInfo({ type: 'export', visible: true });
            toast.addToast(
                `Demo: Would export ${taskCount} task${taskCount !== 1 ? 's' : ''} to Google Calendar:\n\n${taskTitles}${more}`,
                'success'
            );
        }, 1800);
        return;
    }
    setSyncStatus('exporting');
    try {
        const tasksForDate = [...dailyInventory.fixed, ...dailyInventory.flexible];
        const updatedTasks = await calendarService.exportTasks(tasksForDate, currentDate);
        setInventory(prev => {
            const newFixed = [...prev.fixed]; const newFlexible = [...prev.flexible];
            updatedTasks.forEach(u => {
                const targetIdx = u.type === 'fixed' ? newFixed.findIndex(t => t.id === u.id) : newFlexible.findIndex(t => t.id === u.id);
                if (targetIdx !== -1) { if (u.type === 'fixed') newFixed[targetIdx] = u; else newFlexible[targetIdx] = u; }
            });
            return { fixed: newFixed, flexible: newFlexible };
        });
        setSyncStatus('idle');
        setShowSyncInfo({ type: 'export', visible: true });
    } catch (error: any) { setSyncStatus('idle'); setShowSyncInfo({ type: 'export', visible: true, error: error.message }); }
  };

  const handleImportSelected = (tasks: Task[], importedPeopleCount: number) => {
    // Dismiss existing proposals when importing
    updateCurrentDayMessages(prev => 
      prev.map(msg => {
        if (msg.proposal) {
          return { 
            ...msg, 
            proposal: undefined,
            thought: (msg.thought || '') + ' [Proposal auto-dismissed due to calendar import]'
          };
        }
        return msg;
      })
    );
    
    setInventory(prev => {
        const existingGcalIds = new Set(prev.fixed.map(t => t.gcal_id).filter(id => !!id));
        const existingRecurringIds = new Set(prev.fixed.map(t => t.gcal_recurring_id).filter(id => !!id));
        const filteredNew = tasks.filter(t => !existingGcalIds.has(t.gcal_id) && !(t.gcal_recurring_id && existingRecurringIds.has(t.gcal_recurring_id)));
        return { ...prev, fixed: [...prev.fixed, ...filteredNew] };
    });
    setShowImportModal(false); setShowSyncInfo({ type: 'import', visible: true });
    
    // Notify AI about both events and people imported
    if (tasks.length > 0 || importedPeopleCount > 0) {
      let message = '';
      if (tasks.length > 0 && importedPeopleCount > 0) {
        message = `I've just imported ${tasks.length} specific event${tasks.length === 1 ? '' : 's'} from my Google Calendar and added ${importedPeopleCount} new ${importedPeopleCount === 1 ? 'person' : 'people'} to my Kinship Ledger from the event attendees. Please analyze these anchors and connections, and re-orchestrate if there are better ways to flow my days while maintaining these relationships.`;
      } else if (tasks.length > 0) {
        message = `I've just imported ${tasks.length} specific event${tasks.length === 1 ? '' : 's'} from my Google Calendar. Please analyze these anchors and re-orchestrate if there are better ways to flow my days.`;
      } else if (importedPeopleCount > 0) {
        message = `I've added ${importedPeopleCount} new ${importedPeopleCount === 1 ? 'person' : 'people'} to my Kinship Ledger from calendar events. Please check if I need to reach out to ${importedPeopleCount === 1 ? 'them' : 'anyone'} soon.`;
      }
      handleSendMessage(message, null);
    }
  };

  const handleTutorialComplete = async () => {
      setShowTutorial(false);
      localStorage.setItem('life_tutorial_completed', 'true');
      justCompletedTutorialRef.current = true;
      
      try {
          await handleSendMessage("[System Event: The user has just completed the onboarding tutorial. Please introduce yourself as their Personal Life Orchestrator. Briefly explain your core capabilities (managing Tasks, Calendar, and Relationships) and ask them what they would like to focus on first.]", null, true);
      } catch (error) {
          console.error('Tutorial completion message failed:', error);
          toast.showError('Failed to initialize chat. Please check your API key and internet connection, then refresh the page.');
      }
  };

  const handleTutorialSkip = () => {
      setShowTutorial(false);
      localStorage.setItem('life_tutorial_completed', 'true');
      
      // Initialize session even when skipping
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let memoryContext = memories.length > 0 ? `\n\n== LONG-TERM MEMORY BANK ==\n${memories.map(m => `- [${m.date}] (${m.type}): ${m.content}`).join('\n')}` : "";
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const viewDate = new Date(currentDate);
      viewDate.setHours(0, 0, 0, 0);
      const temporalMode = viewDate < today ? 'REFLECTION' : viewDate > today ? 'PLANNING' : 'ACTIVE';
      
      // Check for active approved orchestration
      const dateKey = toDateString(currentDate);
      const activeOrchestration = approvedOrchestrations[dateKey];
      const orchestrationStatus = activeOrchestration && activeOrchestration.isActive
        ? `ACTIVE since ${new Date(activeOrchestration.approvedAt).toLocaleString()} - Day already orchestrated`
        : 'NONE - Day not orchestrated';
      
      geminiService.startNewSession(`
Session Context:
Target Date: ${currentDate.toLocaleDateString()} (Format for add_task: ${toDateString(currentDate)})
Current System Date: ${new Date().toLocaleDateString()} (${toDateString(new Date())})
Temporal Mode: ${temporalMode}
Approved Orchestration: ${orchestrationStatus}

IMPORTANT - When user says "this day", "today", "tonight":
→ They mean the TARGET DATE: ${toDateString(currentDate)}
→ NOT the current system date

Current Session Time: ${getModeTime()}
User Mode: ${mode}
User Timezone: ${timezone}
${memoryContext}`);
  };

  return (
    <div className="h-dvh w-full flex flex-col bg-slate-100 text-slate-800 font-sans overflow-hidden">
      <Toast toasts={toast.toasts} onRemove={toast.removeToast} />
      {showTutorial && <TutorialOverlay isDemo={mode === 'demo'} onComplete={handleTutorialComplete} onSkip={handleTutorialSkip} />}
      {showImportModal && (
        <CalendarImportModal 
          initialDate={currentDate} 
          onCancel={() => setShowImportModal(false)} 
          onImport={handleImportSelected} 
          fetchEvents={mode === 'demo' 
            ? (start, end) => getMockCalendarEvents(start, end)
            : (start, end) => calendarService.listEvents(start, end)
          }
          convertEventToTask={(event) => calendarService.convertEventToTask(event)}
          getRecurrencePattern={(recurrence) => calendarService.getRecurrencePattern(recurrence)}
          existingLedger={ledger}
          onImportPerson={(person) => {
            handleAddPerson(person);
            toast.showSuccess(`Added ${person.name} to Kinship Ledger!`);
          }}
        />
      )}
      {showStorageManager && <StorageManager stats={storageStats} onClose={() => setShowStorageManager(false)} onClearDate={handleClearDateHistory} onClearAllHistory={handleClearAllHistory} />}

      <header className="bg-white border-b border-slate-200 flex-none z-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={onBack} className="mr-4 p-1 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 shadow-sm">L</div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight hidden sm:block">Life <span className="text-indigo-600">Orchestrator</span></h1>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => setShowStorageManager(true)}
                className="hidden md:flex flex-col items-end mr-2 hover:bg-slate-50 p-1.5 rounded-lg transition-all border border-transparent hover:border-slate-100"
             >
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Local Storage</span>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                    <div className={`h-full transition-all ${storageStats.percentage > 90 ? 'bg-red-500' : storageStats.percentage > 75 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${storageStats.percentage}%` }}></div>
                </div>
             </button>
             <div className="flex items-center gap-2 mr-2 border-r border-slate-200 pr-4 hidden md:flex">
                <button onClick={() => setShowImportModal(true)} disabled={syncStatus !== 'idle'} className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${syncStatus === 'importing' ? 'bg-indigo-50 text-indigo-400' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}>Import</button>
                <button onClick={handleExportToGoogle} disabled={syncStatus !== 'idle'} className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${syncStatus === 'exporting' ? 'bg-emerald-50 text-emerald-400' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}>Export</button>
             </div>
             <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-1">
                 <button onClick={() => handleDateChange(new Date(currentDate.getTime() - 86400000))} className="p-1 hover:bg-white rounded text-slate-500 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                 <div className="flex flex-col items-center px-2">
                   <span className="text-xs font-bold text-slate-700 text-center">{currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                   {(() => {
                     const today = new Date();
                     today.setHours(0, 0, 0, 0);
                     const viewDate = new Date(currentDate);
                     viewDate.setHours(0, 0, 0, 0);
                     const isPast = viewDate < today;
                     const isFuture = viewDate > today;
                     const isToday = viewDate.getTime() === today.getTime();
                     
                     if (isPast) return <span className="text-[9px] font-semibold text-purple-600 uppercase tracking-wider">Reflect</span>;
                     if (isFuture) return <span className="text-[9px] font-semibold text-blue-600 uppercase tracking-wider">Plan</span>;
                     if (isToday) return <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">Today</span>;
                     return null;
                   })()}
                 </div>
                 <button onClick={() => handleDateChange(new Date(currentDate.getTime() + 86400000))} className="p-1 hover:bg-white rounded text-slate-500 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
             </div>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto p-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        <div className="h-full flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-8">
          <div className="flex-1 lg:col-span-4 min-h-0 flex flex-col order-2 lg:order-1 overflow-hidden">
             <div className="flex-1 flex flex-col gap-4 min-h-0 lg:overflow-y-auto custom-scrollbar pb-14 lg:pb-0 pr-1">
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col shrink-0">
                  <KinshipLedgerView ledger={ledger} onUpdatePerson={handleUpdatePerson} onAddPerson={handleAddPerson} onDeletePerson={handleDeletePerson} onAnalyzePhoto={(n,p) => handleSendMessage(`Analyze photo for ${n}`, p)} />
                </section>
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col shrink-0">
                  <CareerInventoryView inventory={dailyInventory} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onAddTask={handleManualAddTask} onOrchestrate={handleOrchestrate} />
                </section>
             </div>
          </div>
          <div className="flex-[1.5] lg:flex-1 lg:col-span-8 min-h-0 flex flex-col order-1 lg:order-2">
            <ChatInterface 
                messages={messages} 
                allTasks={[...inventory.fixed, ...inventory.flexible]} 
                currentDate={currentDate} 
                onSelectDate={handleDateChange} 
                onSendMessage={handleSendMessage} 
                onDeleteMessage={handleDeleteMessage}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onAcceptProposal={acceptProposal} 
                onRejectProposal={async (proposal) => {
                  if (processingProposal) return;
                  setProcessingProposal(true);
                  try {
                    // Remove the proposal from the message
                    updateCurrentDayMessages(prev => prev.map(msg => 
                      msg.proposal === proposal ? { ...msg, proposal: undefined } : msg
                    ));
                    // Send a hidden context message to AI so it knows the proposal was declined
                    // Then let AI ask the user why and what adjustments they'd like
                    await handleSendMessage(
                      `[SYSTEM: User clicked "Revise" on your orchestration proposal. The proposal has been dismissed. Please ask the user what they didn't like about the schedule and what adjustments they'd prefer. Be conversational and helpful - offer to re-orchestrate once you understand their preferences.]`,
                      null,
                      true // hidden from chat UI
                    );
                  } finally {
                    setProcessingProposal(false);
                  }
                }}
                onAcceptContact={acceptContact} 
                onAcceptAllContacts={acceptAllContacts}
                onRejectContact={rejectContact}
                processingProposal={processingProposal} 
                storageStats={storageStats}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
