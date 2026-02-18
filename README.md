# Life Orchestrator: Harmony in Every Dimension

## Inspiration
The inspiration for **Life Orchestrator** stems from the modern "productivity paradox." We have more tools than ever to manage our tasks, yet we feel more overwhelmed and disconnected. Traditional calendars treat our lives as a series of disconnected blocks, ignoring the emotional weight of a relationship "overdue" status or the energy required for "deep work." I wanted to build an agent that doesn't just list what you have to do, but *reasons* about how those things interact—a tool that prioritizes a 15-minute call with a recovering family member as highly as a corporate board meeting.

## Live Demo
Check out the live application here: [Life Orchestrator Live](https://life-orchestrator-662200881058.us-central1.run.app)

## What it does
Life Orchestrator acts as an autonomous Chief Operating Officer (COO) for your life. It combines a **Kinship Ledger** (tracking relationship health) with a **Life Inventory** (managing career and health tasks). Using **Gemini 3 Flash Preview**'s advanced reasoning, it proactively "orchestrates" your day—finding optimal windows for flexible tasks around your fixed anchors, ensuring you never miss a critical meeting or a vital connection with a loved one.

## Key Features
- **Smart Orchestration**: Automatically proposes optimal schedules based on your tasks and constraints.
- **Kinship Ledger**: Tracks relationship health and proactively suggests times to connect.
- **Local-First Privacy**: All data is stored locally in your browser.
- **Storage Management**: Visualizes your local storage usage and content breakdown to stay within browser limits.
- **Token Awareness**: Displays real-time token usage for transparency.

## How we built it
The application is built using a **Local-First Architecture** to ensure complete user sovereignty:
- **Frontend**: React 19 with TypeScript and Tailwind CSS for a world-class, responsive UI.
- **Logic Engine**: **Google Gemini 3 Flash Preview** handles all real-time orchestration. It utilizes a `thinkingBudget` to deliberate over complex schedule conflicts and relationship dynamics.
- **State Management**: Data persistence is handled purely via browser `localStorage`. I implemented a custom storage service to monitor and manage the 5MB quota.
- **Integration**: Real-time synchronization with **Google Calendar** via the GAPI/GSI libraries for bi-directional flow.

## Challenges we ran into
The primary challenge was **Local Storage Constraints**. Storing a multi-day chat history with images within a $5 \text{ MB}$ limit is a significant technical hurdle. 
The storage formula implemented follows:
$$ \text{Total Usage} = \text{Text Content} + \sum_{i=1}^{n} (\text{Compressed Image}_i \times 1.33) $$
The $1.33$ multiplier accounts for Base64 encoding overhead. To overcome this, I built a surgical cleanup utility that allows users to delete data by date and implemented a mandatory image compression pipeline.

## Accomplishments that we're proud of
We are incredibly proud of the seamless **Tool-Calling Orchestration**. Seeing the model independently decide to update a relationship status, save a long-term memory, and then re-propose a 24-hour schedule in a single streaming turn is a massive win for agentic UX. We also successfully built a world-class interface that stays under the browser's storage limits without sacrificing the richness of a multimodal experience.

## What we learned
Building this project was a masterclass in **Agentic UX**. I learned that for an AI to be a true "orchestrator," it must be proactive rather than reactive. Users shouldn't have to ask "What should I do now?"; the agent should say, "I've moved your gym session to 4 PM because your 2 PM meeting ran long." I also deepened my understanding of token budgeting and recursive tool calling within the Gemini ecosystem.

## What's next for Life Orchestrator
The next phase involves **Native Audio Integration** using the Gemini Live API. On the technical roadmap, we are focusing on two major architectural migrations:

### 1. Migration to IndexedDB
While `localStorage` was perfect for our MVP, the $5 \text{ MB}$ limit is too restrictive for a lifelong agent. We are migrating to **IndexedDB**, which provides:
- **Unstructured Multimodal Storage**: Storing high-resolution context photos and audio logs directly as Blobs, avoiding Base64 overhead.
- **Asynchronous I/O**: Ensuring that heavy data operations don't block the main UI thread, keeping the orchestrator snappy even with years of data.

### 2. Sophisticated Token Management
As the context window grows to accommodate years of memories, we are implementing a **Recursive Summary Engine**:
- **Semantic Tiering**: Recent interactions are stored in full detail, while older history is recursively summarized by Gemini into "Life Themes" and "Key Preferences."
- **Surgical Context Injection**: Using a Vector Database (via IndexedDB) to only inject the most relevant historical tokens for the current task, maximizing the efficiency of Gemini's reasoning.

## Built with
- **Languages**: TypeScript, JavaScript, HTML5, CSS3
- **Frameworks**: React 19
- **Styling**: Tailwind CSS
- **AI Platform**: Google Gemini 3 Flash Preview (via @google/genai SDK v1.38)
- **APIs**: Google Calendar API (GAPI/GSI)
- **Cloud Platforms**: Google Cloud Platform (GCP)
- **Deployment**: Google Cloud Run
