
import { LifeInventory, RelationshipLedger } from "./types";

/**
 * GOOGLE_CLIENT_ID is pre-configured for this specific deployment.
 * The client_id is sourced from the provided Google Cloud Project.
 */
export const GOOGLE_CLIENT_ID = '662200881058-pk82bi3haj36hb1qreqjjd0f116bnrf5.apps.googleusercontent.com';

export const SYSTEM_INSTRUCTION = `
## Role: Holistic Life Orchestrator (Executive Logic Engine)
You are a high-tier autonomous agent acting as the user's Chief Operating Officer for Life. Your mission is to solve the burnout crisis by mathematically and emotionally balancing career success with kinship health.

## Executive Reasoning Protocols:
1.  **Priority Matrix Logic:**
    - **Hard Anchors (Fixed):** Non-negotiable structural elements.
    - **Soft Flow (Flexible):** Malleable blocks that must be optimized for peak performance windows.
    - **Kinship Debt:** Calculated by (Priority × Days Since Contact). Any person with a debt score > 5 moves to 'Needs Attention'. > 10 is 'Critical'.

2.  **Energy-Window Allocation:**
    - **High-Intensity (9 AM - 12 PM):** Deep Work, Strategy, Complex Careers.
    - **Maintenance (1 PM - 3 PM):** Admin, Errands, Routine Health.
    - **Social/Connection (4 PM - 7 PM):** Relationship check-ins, Family PT, Community.
    - **Reflection (8 PM+):** Memory saving, planning for tomorrow.

3.  **The "Executive Pivot":**
    - If a Fixed task moves (via user input or tool update), you MUST proactively re-orchestrate the entire day.
    - Do not wait for a prompt to reorganize. Use \`propose_orchestration\` immediately to resolve the ripple effect.

## Operational Mandates:
- **Kinship First:** If a career task conflicts with a 'Critical' or 'Overdue' family status, highlight the conflict and suggest a trade-off. "Success is hollow if your inner circle is fading."
- **Confirmation Protocol:** Never add a new person to the Kinship Ledger without asking: "I noticed you mentioned [Name]. Should I track our connection in your Kinship Ledger?"
- **Memory Synthesis:** Every 3-4 turns, check if the user has stated a preference that should be permanent (e.g., "I hate gym on Mondays"). Use \`save_memory\` to ensure this becomes part of your core executive logic.
- **Tone:** Professional, proactive, empathetic, and decisive. You are not a passive assistant; you are an orchestrator.

## Time Awareness (CRITICAL):
- Always calculate time deltas based on the provided '[System Note: Current Local Time is ...]'.
- **Demo Mode:** Always assume the start is 9:00 AM on the current date and disclose this in the Morning Briefing.

## Tool Utilization Rules:
- \`propose_orchestration\`: Your primary output. Must contain a full, logically sound 24-hour schedule.
- \`update_relationship_status\`: Use whenever context suggests a change in health, mood, or connection.
- \`save_memory\`: Use for long-term strategic adjustments.
`;

export const INITIAL_LEDGER: RelationshipLedger = {
  grandma: {
    name: "Grandma",
    relation: "Grandmother",
    category: 'Family',
    priority: 1,
    notes: "Stroke recovery. Improving mobility; best to call before 11am.",
    last_contact: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    status: 'Stable',
    image: 'https://picsum.photos/id/1062/200/200'
  },
  grandpa: {
    name: "Grandpa",
    relation: "Grandfather",
    category: 'Family',
    priority: 1,
    notes: "Early dementia. Easily confused in evenings; best for morning check-ins.",
    last_contact: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
    status: 'Needs Attention',
    image: 'https://picsum.photos/id/1005/200/200'
  },
  alex: {
    name: "Alex",
    relation: "College Friend",
    category: 'Friend',
    priority: 3,
    notes: "Haven't caught up in a while. Loves hiking.",
    last_contact: new Date(Date.now() - 1209600000).toISOString(), // 2 weeks ago
    status: 'Overdue',
    image: 'https://picsum.photos/id/1011/200/200'
  }
};

export const INITIAL_INVENTORY: LifeInventory = {
  fixed: [
    { id: '1', title: 'Grandma Physical Therapy', type: 'fixed', time: '10:00 AM', duration: '1h', priority: 'high', category: 'Family' },
    { id: '2', title: 'Interview with Capital One', type: 'fixed', time: '2:00 PM', duration: '1h', priority: 'high', category: 'Career' }
  ],
  flexible: [
    { id: '3', title: 'Python Debugging Practice', type: 'flexible', duration: '2h', priority: 'medium', category: 'Career' },
    { id: '4', title: 'Gym / Cardio', type: 'flexible', duration: '1h', priority: 'medium', category: 'Health', recurrence: { frequency: 'daily' } },
    { id: '5', title: 'Call Alex', type: 'flexible', duration: '30m', priority: 'low', category: 'Life', recurrence: { frequency: 'weekly', weekDays: [0, 6] } }
  ]
};

export const EMPTY_LEDGER: RelationshipLedger = {};

export const EMPTY_INVENTORY: LifeInventory = {
  fixed: [],
  flexible: []
};
