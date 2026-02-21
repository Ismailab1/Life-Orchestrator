# Life Orchestrator: Harmony in Every Dimension

## Architecture & Design Decisions

This section documents the key architectural decisions that shaped Life Orchestrator. Each choice reflects trade-offs between competing concerns: performance, privacy, usability, and maintainability.

### 🏛️ **Core Architecture Philosophy: Local-First Privacy**
All user data lives exclusively in the browser's localStorage (with IndexedDB prepared for future migration). No backend server, no database, no data collection. AI processing happens via Google's Gemini API, but conversations are ephemeral—Google doesn't store them.

**Why local-first?**
- User sovereignty: Data never leaves your control
- Zero server costs: Deployment is static files
- Instant cold starts: No database initialization or authentication flows
- Privacy by design: GDPR/CCPA compliant by default

**Trade-offs:**
- 5MB localStorage quota requires aggressive storage management
- No cross-device sync (future: optional cloud backup)
- No collaborative features (single-user design)

---

### 🧠 **AI-Driven Design: Prompt Engineering as Application Logic**
The AI's behavior is defined by extensive system prompts (see `constants.ts: SYSTEM_INSTRUCTION`) rather than rigid algorithms. This "prompt-first" approach enables:

1. **Nuanced Decision-Making**: The AI balances competing priorities (career deadlines vs. family health) using natural language reasoning that code struggles to express.

2. **Transparent Reasoning**: Users see the AI's thought process. When it suggests moving a task, it explains *why* (e.g., "Thursday is overloaded, moved grocery run to Friday").

3. **Rapid Iteration**: Changing AI behavior is a prompt edit, not a code refactor. We can A/B test scheduling strategies by tweaking instructions.

4. **Self-Documenting**: The system prompt IS the documentation of AI behavior. New developers read the prompt to understand orchestration rules.

**Critical Design Choice: Temporal Modes**
The AI operates in three modes based on the date being viewed:
- **Reflection** (past): Retrospective analysis, no orchestration allowed
- **Active** (today): Real-time optimization, proactive suggestions
- **Planning** (future): Tentative schedules, contingency planning

This prevents logical impossibilities (like orchestrating yesterday) and ensures appropriate communication tone.

---

### 📊 **Data Model: Fixed vs Flexible Task Dichotomy**
Tasks are classified as:
- **Fixed**: Hard-scheduled appointments (meetings, interviews, PT sessions)
- **Flexible**: Time-blocks optimized by AI (gym, email, meal prep)

This binary split enables the core orchestration algorithm:
1. Fixed tasks anchor the day (immovable)
2. Flexible tasks flow into optimal energy windows
3. Overloads trigger proactive redistribution to future days

**Alternative considered:** Priority-only system (1-10 scale)
**Rejected because:** Priority alone doesn't capture "movability." A high-priority flexible task can shift; a medium-priority fixed task cannot.

---

### 💔 **Kinship Debt Algorithm: Quantifying Relationship Health**
Relationship status is calculated as:

**Kinship Debt = Priority × Days Since Last Contact**

Thresholds:
- < 5: Stable
- 5-10: Needs Attention
- 10-20: Critical
- \> 20: Overdue

**Why this formula?**
- Objective: No guesswork about "when did I last call?"
- Weighted: High-priority people (9-10) trigger alerts faster
- Actionable: Clear thresholds drive AI suggestions

**Example:**
- Mom (Priority 9): After 1 day: Debt = 9 (Critical warning)
- Colleague (Priority 3): After 3 days: Debt = 9 (same alert threshold)

This ensures important relationships get attention proportional to their significance.

---

### 🔄 **Recurrence Without Bloat**
Instead of creating 52 instances of "Weekly Team Sync," we store:
```typescript
{
  title: "Team Sync",
  recurrence: { frequency: 'weekly', weekDays: [1, 3] } // Monday & Wednesday
}
```

Client-side expansion happens on-demand per date. This:
- Saves 98% storage (one rule vs. N instances)
- Enables easy editing ("Change all future instances")
- Matches user mental model ("It's every Monday")

---

### 🎨 **Component Design: Inline Editing Pattern**
All components (Kinship Ledger, Inventory) use:
1. Click to expand/edit
2. Auto-save on blur
3. No "Edit Mode" toggle

**Why?**
- Reduces cognitive overhead (no mode switching)
- Optimistic UI (changes immediate)
- Matches user expectation (like spreadsheet cells)

**Alternative considered:** Modal dialogs for editing
**Rejected because:** Modals break flow and require explicit dismiss actions

---

### 🧩 **Dependency Strategy: Minimal, Purposeful**
Production dependencies:
- React: UI framework (unavoidable)
- @google/generative-ai: Gemini SDK (core feature)
- react-markdown: Render AI responses (security + formatting)
- idb: IndexedDB wrapper (future-proofing)

**Notably absent:**
- No Redux/Zustand: Props drilling sufficient at current scale
- No React Router: View state machine handles navigation
- No form library: Simple inline forms don't justify abstraction
- No CSS-in-JS: Tailwind's atomic classes are faster and smaller

**Philosophy:** Add dependencies when pain justifies complexity, not preemptively.

---

### 🔒 **Security: Function Calling as Safety Boundary**
The AI cannot execute arbitrary code. It can only call pre-defined functions (executors) with validated schemas.

**Tool Executor Pattern:**
```typescript
updateRelationshipStatus: async (args: UpdateRelationshipArgs) => {
  // Validation happens here
  if (!isValidPerson(args.person_name)) throw Error("Invalid person");
  // Safe state mutation
  updateLedger(args);
}
```

Even if the AI tries to inject SQL, execute shell commands, or access system APIs, the executor functions filter and sanitize all inputs.

**Defense in depth:**
1. Gemini schema validation (type checking)
2. TypeScript compile-time checks
3. Runtime validation in executors
4. localStorage isolation (no file system access)

---

### 📦 **Storage Management: Proactive Quota Awareness**
LocalStorage has a ~5MB hard limit. Hitting it breaks the app silently.

**Preventative measures:**
1. Real-time usage display (percentage bar)
2. Warnings at 80% (amber) and 90% (red)
3. Granular cleanup (delete specific dates, not nuclear reset)
4. Image compression (800x800 JPEG @ 70% quality = ~100KB)
5. Daily upload limits (5 images/day)

**Future:** IndexedDB migration removes quota concerns (~gigabytes available)

---

### 🚀 **Build System: Vite for Speed**
Vite chosen over Create React App because:
- Fast HMR (~50ms vs 5s): Save file → See changes instantly
- ES modules: No bundling in dev mode
- Code splitting: Automatic vendor chunk separation
- Minimal config: ~40 lines vs 200+ in CRA eject

**Trade-off:** Less opinionated (we configure more), but we gain control over:
- CORS headers (required for Google OAuth)
- Environment variable injection
- Build optimizations

---

### 🎯 **UX Philosophy: Conversational Over Forms**
Traditional productivity apps are form-heavy (fill title, date, time, priority, etc.).

Life Orchestrator uses chat:
> User: "Interview with Capital One tomorrow at 2pm"
> AI: "Added 'Interview with Capital One' on [date] at 2:00 PM. Should I block 1 hour before for prep?"

**Why chat?**
- Lower cognitive load (natural language vs. form fields)
- Context accumulates (AI remembers previous messages)
- Multimodal (text + images + voice)
- Explains decisions (AI shows reasoning)

**Trade-off:** Requires robust AI (prompting complexity) vs. deterministic forms

---

### 🔮 **Future-Proofing: IndexedDB Skeleton**
The `db.ts` service implements full IndexedDB schema but isn't used yet.

**Why build it now?**
- Smooth migration path when localStorage hits limits
- Prepared for vector embeddings (semantic search)
- Schema versioning system ready for future data migrations

**When to switch?**
- User hits 5MB quota regularly
- Vector search feature launches
- Multi-device sync implemented

---

## Inspiration
The inspiration for **Life Orchestrator** stems from the modern "productivity paradox." We have more tools than ever to manage our tasks, yet we feel more overwhelmed and disconnected. Traditional calendars treat our lives as a series of disconnected blocks, ignoring the emotional weight of a relationship "overdue" status or the energy required for "deep work." I wanted to build an agent that doesn't just list what you have to do, but *reasons* about how those things interact—a tool that prioritizes a 15-minute call with a recovering family member as highly as a corporate board meeting.

## Live Demo
Check out the live application here: [Life Orchestrator Live](https://life-orchestrator-662200881058.us-central1.run.app)

## What it does
Life Orchestrator acts as an autonomous Chief Operating Officer (COO) for your life. It combines a **Kinship Ledger** (tracking relationship health) with a **Life Inventory** (managing career and health tasks). Using **Gemini 3 Flash Preview**'s advanced reasoning, it proactively "orchestrates" your day—finding optimal windows for flexible tasks around your fixed anchors, ensuring you never miss a critical meeting or a vital connection with a loved one.

## Key Features
- **Smart Orchestration**: Automatically proposes optimal schedules based on your tasks and constraints.
- **Temporal Mode Switching**: AI adapts its behavior based on date context—Reflection mode for past dates, Active mode for today, Planning mode for future dates.
- **Kinship Ledger**: Tracks relationship health and proactively suggests times to connect.
- **Local-First Privacy**: All data is stored locally in your browser using localStorage.
- **Data Sovereignty**: Includes a comprehensive "Factory Reset" to wipe all data including tutorial status.
- **Storage Management**: Visualizes your local storage usage and content breakdown to stay within browser limits.
- **Token Awareness**: Displays real-time token usage for transparency.
- **Toast Notifications**: Real-time user feedback for actions, errors, and validations.

## How we built it
The application is built using a **Local-First Architecture** to ensure complete user sovereignty:
- **Frontend**: React 19 with TypeScript and Tailwind CSS for a world-class, responsive UI.
- **Logic Engine**: **Google Gemini 2.5 Pro** handles all real-time orchestration with temporal mode awareness. It utilizes advanced reasoning to deliberate over complex schedule conflicts and relationship dynamics.
- **State Management**: Data persistence is handled via browser `localStorage` with a streamlined architecture. I implemented a custom storage service to monitor and manage the 5MB quota.
- **Integration**: Real-time synchronization with **Google Calendar** via the GAPI/GSI libraries for bi-directional flow.
- **Temporal Intelligence**: Automatic detection of temporal context (past/present/future) to adapt AI behavior for reflection, active management, or planning.

## Challenges we ran into
The primary challenge was **Local Storage Constraints**. Storing a multi-day chat history with images within a $5 \text{ MB}$ limit is a significant technical hurdle. 
The storage formula implemented follows:
$$ \text{Total Usage} = \text{Text Content} + \sum_{i=1}^{n} (\text{Compressed Image}_i \times 1.33) $$
The $1.33$ multiplier accounts for Base64 encoding overhead. To overcome this, I built a surgical cleanup utility that allows users to delete data by date and implemented a mandatory image compression pipeline.

## Accomplishments that we're proud of
We are incredibly proud of the seamless **Tool-Calling Orchestration**. Seeing the model independently decide to update a relationship status, save a long-term memory, and then re-propose a 24-hour schedule in a single streaming turn is a massive win for agentic UX. We also successfully built a world-class interface that stays under the browser's storage limits without sacrificing the richness of a multimodal experience.

## What we learned
Building this project was a masterclass in **Agentic UX**. I learned that for an AI to be a true "orchestrator," it must be proactive rather than reactive. Users shouldn't have to ask "What should I do now?"; the agent should say, "I've moved your gym session to 4 PM because your 2 PM meeting ran long." I also deepened my understanding of token budgeting and recursive tool calling within the Gemini ecosystem.

## Recent Updates (Phase 1: February 2026)
We recently completed a comprehensive system hardening initiative addressing critical architecture and UX improvements:

### Temporal Mode Switching
The AI now adapts its behavior based on temporal context:
- **Reflection Mode** (Past Dates): Focuses on insights, lessons learned, and pattern recognition from completed activities
- **Active Mode** (Today): Emphasizes immediate action, real-time decision-making, and dynamic rescheduling
- **Planning Mode** (Future Dates): Concentrates on strategic planning, goal setting, and proactive scheduling

Visual mode badges in the date selector provide instant feedback on the current temporal context.

### Enhanced Validation & Error Handling
- **Temporal Validation**: Blocks orchestration of fixed tasks with specific times on past dates (prevents logical inconsistencies)
- **Task Deletion Precision**: Exact-match-only deletion to prevent accidental data loss
- **Memory Limits**: FIFO enforcement of 100-memory limit to manage context window efficiently
- **Toast Notification System**: Real-time user feedback for all major actions and errors

### Performance & Reliability
- **AbortController Integration**: Properly cancels in-flight AI streams when starting new sessions (prevents memory leaks)
- **Simplified Storage Architecture**: Consolidated to localStorage-only for improved reliability and reduced complexity
- **Tutorial Error Handling**: Async error handling with user-friendly notifications during onboarding

## What's next for Life Orchestrator
The roadmap focuses on three major pillars: **Data Intelligence**, **System Resilience**, and **User Experience**.

### Phase 2: Type Safety & Data Validation
- **Zod Schema Integration**: Runtime validation for all AI tool executor arguments to prevent malformed data
- **Proposal Validation**: Comprehensive null checks and schema validation before accepting orchestration proposals
- **Image Size Validation**: Pre- and post-compression size checks to prevent storage quota violations
- **Calendar Sync Recovery**: Retry queue implementation for failed Google Calendar synchronizations

### Phase 3: Enhanced Intelligence with Embeddings
The next major evolution involves migrating from localStorage to **IndexedDB** paired with a **semantic search layer**:

- **Vector Embeddings for Memories**: Instead of storing all memories in raw text, we'll use Gemini's embedding models to create vector representations. This enables:
  - **Semantic Retrieval**: Query "times I felt accomplished" to retrieve relevant memories even if they don't contain those exact words
  - **Context Compression**: Only inject the most relevant 10-20 memories for each conversation, dramatically reducing token usage
  - **Temporal Clustering**: Automatically identify life themes and patterns across months/years

- **IndexedDB for Scalability**: Migration from localStorage (5MB limit) to IndexedDB provides:
  - **Multimodal Blob Storage**: Store high-resolution images directly as binary Blobs without Base64 encoding overhead
  - **Asynchronous I/O**: Heavy data operations won't block the UI thread
  - **Unlimited Growth**: Accommodate years of memories, conversations, and media
  - **Advanced Querying**: Efficient indexing on dates, contacts, and task types

### Phase 4: Production Hardening
- **Timezone Consistency**: Unified timezone handling across all date operations
- **Recurrence Edge Cases**: Robust handling of DST transitions and month-end edge cases for recurring tasks
- **Demo Mode Fixed Date**: Reference date implementation (January 15, 2026) for consistent demonstration experiences
- **Loading States**: Skeleton screens and progress indicators for all async operations
- **Performance Optimizations**: Virtual scrolling for large memory/task lists, debounced API calls, and memoization strategies

### Phase 5: Native Audio Integration
Using the **Gemini Live API** for voice-first orchestration:
- Real-time voice commands for task creation and rescheduling
- Conversational briefing summaries ("Tell me about my day")
- Hands-free relationship check-ins during commutes

### Long-Term Vision: Lifelong Agent
The ultimate goal is a **Recursive Summary Engine** that maintains context across decades:
- **Semantic Tiering**: Recent interactions stored in full detail, older history recursively summarized into "Life Themes"
- **Multi-Year Context Window**: Efficient token management through vector search and hierarchical summarization
- **Privacy-First Architecture**: All embeddings and vectors remain local—no server-side data mining

## Built with
- **Languages**: TypeScript, JavaScript, HTML5, CSS3
- **Frameworks**: React 19
- **Styling**: Tailwind CSS
- **AI Platform**: Google Gemini 2.5 Pro (via @google/generative-ai SDK)
- **APIs**: Google Calendar API (GAPI/GSI)
- **Cloud Platforms**: Google Cloud Platform (GCP)
- **Deployment**: Google Cloud Run
