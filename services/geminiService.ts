/**
 * DESIGN DECISION: Gemini AI Service Architecture
 * 
 * This service encapsulates all interactions with Google's Gemini AI model.
 * 
 * Core Design Principles:
 * 
 * 1. **Function Calling (Tool Use)**:
 *    The AI doesn't just generate text—it invokes structured functions to modify state.
 *    Tool definitions specify JSON schemas that Gemini uses to generate valid function calls.
 * 
 * 2. **Temporal Mode Awareness**:
 *    The AI's system instruction changes based on whether the user is viewing:
 *    - Past dates (reflection mode): No orchestration, retrospective analysis
 *    - Today (active mode): Full capabilities, real-time optimization
 *    - Future dates (planning mode): Tentative scheduling, preparation focus
 * 
 * 3. **Streaming Responses**:
 *    Text streams token-by-token for responsive UX. Function calls stream last
 *    (Gemini outputs reasoning, then tools).
 * 
 * 4. **Session State Management**:
 *    The chat session persists across messages for context continuity.
 *    It's reset when switching dates to prevent context bleed.
 * 
 * 5. **Abort Capability**:
 *    Users can cancel long-running AI requests. This prevents wasted API calls
 *    and allows quick correction when the AI goes off-track.
 * 
 * The tool definitions translate TypeScript interfaces into Gemini's schema format,
 * enabling type-safe AI function calling.
 */

import { 
  GoogleGenerativeAI, 
  GenerativeModel,
  ChatSession,
  Part,
  FunctionDeclaration,
  SchemaType
} from "@google/generative-ai";
import { SYSTEM_INSTRUCTION, REFLECTION_MODE_INSTRUCTION, ACTIVE_MODE_INSTRUCTION, PLANNING_MODE_INSTRUCTION } from "../constants";
import { LifeInventory, RelationshipLedger, OrchestrationProposal, UpdateRelationshipArgs, Task } from "../types";

/**
 * Timeout Utility - Wraps promises with timeout protection
 * Prevents indefinite hangs when Gemini API stalls
 */
const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage?: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage || `Request timed out after ${ms}ms`));
    }, ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
};

const STREAM_TIMEOUT = 30000; // 30 seconds for stream completion
const CHUNK_TIMEOUT = 30000; // 30 seconds between chunks
const ORCHESTRATION_STREAM_TIMEOUT = 60000; // 60 seconds for orchestration streams
const ORCHESTRATION_CHUNK_TIMEOUT = 45000; // 45 seconds between chunks during orchestration

/**
 * Generate fallback message when LLM response is missing after function calls
 */
const generateFallbackMessage = (functionCalls: any[]): string => {
  if (functionCalls.length === 0) return '';
  
  console.log('Generating fallback for function calls:', JSON.stringify(functionCalls, null, 2));
  
  const callCounts: Record<string, number> = {};
  const taskTitles: string[] = [];
  
  functionCalls.forEach(call => {
    callCounts[call.name] = (callCounts[call.name] || 0) + 1;
    if (call.name === 'add_task' && call.args?.title) {
      taskTitles.push(call.args.title);
    }
  });
  
  const messages: string[] = [];
  
  if (callCounts['add_task']) {
    if (taskTitles.length === 1) {
      messages.push(`I've added "${taskTitles[0]}" to your schedule.`);
    } else if (taskTitles.length > 1) {
      messages.push(`I've added ${taskTitles.length} events to your schedule: ${taskTitles.map(t => `"${t}"`).join(', ')}.`);
    } else {
      messages.push(`I've added ${callCounts['add_task']} task${callCounts['add_task'] > 1 ? 's' : ''} to your schedule.`);
    }
  }
  
  if (callCounts['delete_task']) {
    messages.push(`I've removed ${callCounts['delete_task']} task${callCounts['delete_task'] > 1 ? 's' : ''}.`);
  }
  
  if (callCounts['move_tasks']) {
    messages.push(`I've rescheduled tasks as requested.`);
  }
  
  if (callCounts['update_relationship_status']) {
    messages.push(`I've updated ${callCounts['update_relationship_status']} contact${callCounts['update_relationship_status'] > 1 ? 's' : ''} in your Kinship Ledger.`);
  }
  
  if (callCounts['propose_orchestration']) {
    messages.push(`I've prepared an orchestration for you.`);
  }
  
  // If only get_ functions were called (read-only), don't show "Done"
  const hasWriteOperations = Object.keys(callCounts).some(
    key => !key.startsWith('get_') && !key.startsWith('save_memory')
  );
  
  if (!hasWriteOperations) {
    console.log('Only read operations detected, skipping fallback message');
    return ''; // Let timeout/error handling show appropriate message
  }
  
  return messages.length > 0 ? messages.join(' ') : `Action completed (${Object.keys(callCounts).join(', ')}).`;
};

/**
 * Tool Definitions
 * DESIGN DECISION: Declarative function schemas for AI
 * 
 * Each tool definition tells Gemini:
 * - What the function does (description)
 * - What parameters it accepts (schema)
 * - Which parameters are required
 * 
 * The AI generates JSON matching these schemas, which we parse and execute.
 * This is safer than allowing the AI to write code directly.
 */

// --- Tool Definitions (Adapted for @google/generative-ai) ---
// Note: The schema format is slightly different (SchemaType vs Type) but structure is similar.

const getRelationshipStatusTool: FunctionDeclaration = {
  name: 'get_relationship_status',
  description: 'Retrieves the current status of family, friends, and network connections.',
};

const getLifeContextTool: FunctionDeclaration = {
  name: 'get_life_context',
  description: 'Returns the AUTHORITATIVE and COMPLETE list of ALL tasks for the given date. This is the ONLY source of truth. The schedule you propose in propose_orchestration MUST be built from these tasks — you may NOT add, invent, rename, or substitute any tasks. Break/meal slots may only be added if they do not already appear in the returned task list.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: { type: SchemaType.STRING, description: 'The date to check (YYYY-MM-DD). ALWAYS pass the exact Target Date from the Session Context.' },
    },
  },
};

const proposeOrchestrationTool: FunctionDeclaration = {
  name: 'propose_orchestration',
  description: 'Submits a restructured day plan using ONLY the tasks returned by get_life_context. CRITICAL ANTI-HALLUCINATION RULES: (1) Every item in the schedule array MUST correspond to an actual task from get_life_context. (2) Do NOT invent, rename, or substitute tasks. (3) Fixed tasks with a set time MUST keep that time. (4) Flexible tasks may be reordered within optimal windows. (5) You may add brief unlisted break slots (e.g., 15-min buffer) but NEVER fabricate full work blocks. If >10 hours total, recommend moving low-priority tasks to future days using move_tasks.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      optimized_timeline: { type: SchemaType.STRING, description: 'The full hourly breakdown text. Include warnings if schedule exceeds realistic capacity.' },
      reasoning: { type: SchemaType.STRING, description: 'Why these specific shifts were made. If overloaded, explain which tasks could be moved to future days and why.' },
      schedule: {
        type: SchemaType.ARRAY,
        description: 'The complete list of tasks.',
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            gcal_id: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            type: { type: SchemaType.STRING, enum: ['fixed', 'flexible'], format: 'enum' },
            time: { type: SchemaType.STRING },
            duration: { type: SchemaType.STRING },
            priority: { type: SchemaType.STRING, enum: ['high', 'medium', 'low'], format: 'enum' },
            category: { type: SchemaType.STRING, enum: ['Career', 'Life', 'Health', 'Family'], format: 'enum' },
            recurrence: {
              type: SchemaType.OBJECT,
              properties: {
                frequency: { type: SchemaType.STRING, enum: ['daily', 'weekly', 'monthly'], format: 'enum' },
                weekDays: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
                dayOfMonth: { type: SchemaType.NUMBER }
              }
            }
          },
          required: ['title', 'type', 'duration', 'priority', 'category']
        }
      }
    },
    required: ['optimized_timeline', 'reasoning', 'schedule'],
  },
};

const updateRelationshipStatusTool: FunctionDeclaration = {
  name: 'update_relationship_status',
  description: 'Updates a person\'s status in the ledger.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      person_name: { type: SchemaType.STRING },
      notes_update: { type: SchemaType.STRING },
      status_level: { type: SchemaType.STRING, enum: ['Stable', 'Needs Attention', 'Critical', 'Overdue'], format: 'enum' },
      category: { type: SchemaType.STRING, enum: ['Family', 'Friend', 'Network'], format: 'enum' },
      relation: { type: SchemaType.STRING },
      confirmed: { type: SchemaType.BOOLEAN, description: 'Set to true ONLY when the user has explicitly and directly instructed you to add this person (e.g., "add Timmy", "I want to track Sarah", "add both of them"). Set to false or omit when you are inferring/proposing based on conversation context alone.' }
    },
    required: ['person_name', 'notes_update', 'status_level'],
  },
};

const addTaskTool: FunctionDeclaration = {
    name: 'add_task',
    description: 'Adds a new task or event to the Life Inventory.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        type: { type: SchemaType.STRING, enum: ['fixed', 'flexible'], format: 'enum' },
        duration: { type: SchemaType.STRING },
        priority: { type: SchemaType.STRING, enum: ['high', 'medium', 'low'], format: 'enum' },
        category: { type: SchemaType.STRING, enum: ['Career', 'Life', 'Health', 'Family'], format: 'enum' },
        time: { type: SchemaType.STRING },
        date: { type: SchemaType.STRING, description: 'Date in YYYY-MM-DD format. Defaults to today if omitted.' },
        recurrence: {
            type: SchemaType.OBJECT,
            properties: {
                frequency: { type: SchemaType.STRING, enum: ['daily', 'weekly', 'monthly'], format: 'enum' },
                weekDays: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
                dayOfMonth: { type: SchemaType.NUMBER }
            }
        }
      },
      required: ['title', 'type', 'duration', 'priority', 'category'],
    },
};

const deleteTaskTool: FunctionDeclaration = {
    name: 'delete_task',
    description: 'Deletes a task from the inventory by title.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            title: { type: SchemaType.STRING }
        },
        required: ['title']
    }
};

const deleteRelationshipStatusTool: FunctionDeclaration = {
    name: 'delete_relationship_status',
    description: 'Removes a person from the Relationship Ledger.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            person_name: { type: SchemaType.STRING }
        },
        required: ['person_name']
    }
};

const saveMemoryTool: FunctionDeclaration = {
    name: 'save_memory',
    description: 'Persists a key fact, preference, or decision.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            content: { type: SchemaType.STRING },
            type: { type: SchemaType.STRING, enum: ['preference', 'decision', 'fact'], format: 'enum' }
        },
        required: ['content', 'type']
    }
};

const moveTasksTool: FunctionDeclaration = {
    name: 'move_tasks',
    description: 'Moves specific tasks to a new date. Use when detecting overload or user requests rescheduling.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        task_identifiers: { 
          type: SchemaType.ARRAY, 
          items: { type: SchemaType.STRING },
          description: 'Array of task titles or IDs to move'
        },
        target_date: { 
          type: SchemaType.STRING,
          description: 'Target date in YYYY-MM-DD format'
        }
      },
      required: ['task_identifiers', 'target_date']
    }
};

/**
 * ToolExecutors Interface
 * DESIGN DECISION: Type-safe executor contract
 * 
 * This interface ensures that the executors object passed to the service
 * implements all required functions with correct signatures.
 * 
 * The service doesn't implement state management—it delegates to these executors,
 * maintaining separation of concerns (AI logic vs. state management).
 */
interface ToolExecutors {
  getRelationshipStatus: () => Promise<RelationshipLedger>;
  getLifeContext: (args?: { date?: string }) => Promise<LifeInventory>;
  proposeOrchestration: (proposal: OrchestrationProposal) => Promise<string>;
  updateRelationshipStatus: (args: UpdateRelationshipArgs) => Promise<string>;
  addTask: (task: Omit<Task, 'id'>) => Promise<string>;
  deleteTask: (title: string) => Promise<string>;
  deleteRelationshipStatus: (name: string) => Promise<string>;
  saveMemory: (content: string, type: 'preference' | 'decision' | 'fact') => Promise<string>;
  moveTasks: (taskIdentifiers: string[], targetDate: string) => Promise<string>;
}

/**
 * GeminiService Class
 * DESIGN DECISION: Stateful service with session management
 * 
 * The service maintains:
 * - model: Configured GenerativeModel instance
 * - chat: Current ChatSession (maintains context across messages)
 * - currentTemporalMode: Used to inject mode-specific instructions
 * - abortController: Enables request cancellation
 * 
 * State is necessary here because:
 * 1. Chat sessions maintain conversation history in Gemini's memory
 * 2. Temporal mode affects system instructions but persists across messages
 * 3. Abort controllers must be accessible across async boundaries
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  chat: ChatSession | null = null; // Made public for session validation
  private tools: FunctionDeclaration[];
  private currentTemporalMode: 'reflection' | 'active' | 'planning' = 'active';
  private abortController: AbortController | null = null;

  /**
   * Reset the chat session - used when switching dates to prevent context bleed
   * The next sendMessage call will reinitialize with the correct date context
   */
  resetSession() {
    if (this.abortController) {
      this.abortController.abort();
      console.log('[GeminiService] Aborted session stream on reset');
    }
    this.chat = null;
    this.abortController = null;
    console.log('[GeminiService] Session reset - will reinitialize on next message');
  }

  constructor() {
    const apiKey = process.env.API_KEY || '';
    if (!apiKey) console.warn("GeminiService: API Key is missing! Check .env and vite.config.ts.");
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    /**
     * Tool Registration
     * DESIGN DECISION: All tools registered upfront
     * 
     * The model is configured with all available tools at initialization.
     * Gemini decides which tools to call based on the conversation context
     * and the tool descriptions.
     * 
     * Alternative considered: Dynamic tool registration per conversation
     * Rejected because: Adds complexity, and all tools are lightweight
     */
    this.tools = [
      getRelationshipStatusTool, 
      getLifeContextTool, 
      proposeOrchestrationTool,
      updateRelationshipStatusTool,
      addTaskTool,
      deleteTaskTool,
      deleteRelationshipStatusTool,
      saveMemoryTool,
      moveTasksTool
    ];
    
    // Initialize a default model to avoid undefined errors if used before session start,
    // though startNewSession should always be called.
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-pro" }); 
  }

  private detectTemporalMode(context: string): 'reflection' | 'active' | 'planning' {
    // Parse the session context to extract temporal information
    const isFutureDateMatch = context.match(/Is Future Date:\s*(true|false)/i);
    const targetDateMatch = context.match(/Target Date:\s*([^\n]+)/i);
    
    if (isFutureDateMatch && isFutureDateMatch[1].toLowerCase() === 'true') {
      return 'planning';
    }
    
    if (targetDateMatch) {
      try {
        const targetDateStr = targetDateMatch[1].trim();
        const targetDate = new Date(targetDateStr);
        const today = new Date();
        
        // Normalize to date-only comparison (ignore time)
        targetDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        if (targetDate < today) {
          return 'reflection';
        } else if (targetDate > today) {
          return 'planning';
        }
      } catch (e) {
        console.warn('Failed to parse target date for temporal mode detection:', e);
      }
    }
    
    // Default to active mode if we can't determine
    return 'active';
  }

  private getTemporalModeInstruction(mode: 'reflection' | 'active' | 'planning'): string {
    switch (mode) {
      case 'reflection':
        return REFLECTION_MODE_INSTRUCTION;
      case 'planning':
        return PLANNING_MODE_INSTRUCTION;
      case 'active':
      default:
        return ACTIVE_MODE_INSTRUCTION;
    }
  }

  private getTemporalModeReminder(): string {
    switch (this.currentTemporalMode) {
      case 'reflection':
        return '[REFLECTION MODE: This is a past date. Use past tense and focus on analysis.]';
      case 'planning':
        return '[PLANNING MODE: This is a future date. Use future tense and tentative language.]';
      case 'active':
      default:
        return '[ACTIVE MODE: This is today. Use present tense and action-oriented language.]';
    }
  }

  startNewSession(initialTimeContext?: string) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let context = initialTimeContext || "";
    
    // Safety Net: If no context is provided (e.g. implicit start), generate a default one using current system time.
    if (!context) {
        const now = new Date();
        context = `
Session Context:
Target Date: ${now.toLocaleDateString()}
Current Session Time: ${now.toLocaleTimeString()}
Is Future Date: false
User Mode: live
User Timezone: ${timezone}`;
        console.warn("GeminiService: startNewSession called without context. safe-guarding with current system time.");
    }
    
    if (!context.includes("User Timezone:")) {
        context += `\nUser Timezone: ${timezone}`;
    }

    // Abort any existing streams when starting new session (prevents memory leaks on date change)
    if (this.abortController) {
        this.abortController.abort();
        console.log('[GeminiService] Aborted previous session stream');
    }
    this.abortController = new AbortController();

    // Detect temporal mode and inject appropriate instructions
    this.currentTemporalMode = this.detectTemporalMode(context);
    const temporalInstruction = this.getTemporalModeInstruction(this.currentTemporalMode);
    
    console.log(`[Temporal Mode Detection] Mode: ${this.currentTemporalMode.toUpperCase()}`);

    // Initialize model HERE with the dynamic system instruction. 
    // Passing systemInstruction to getGenerativeModel allows the SDK to format it correctly as Content.
    const finalSystemInstruction = SYSTEM_INSTRUCTION + temporalInstruction + "\n\n" + context;
    console.log("Initializing Gemini Session with System Instruction:", finalSystemInstruction);
    
    this.model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-pro",
        systemInstruction: finalSystemInstruction,
        tools: [{ functionDeclarations: this.tools }],
    });

    this.chat = this.model.startChat({});
  }

  // Reuse retry logic
  private async retry<T>(operation: () => Promise<T>): Promise<T> {
    let attempts = 0;
    const maxRetries = 3;
    while (true) {
      try {
        return await operation();
      } catch (error: any) {
        // SDK error codes might differ slightly, but checking 503/429 is safe
        const msg = (error.message || "").toLowerCase();
        if (attempts < maxRetries && (msg.includes('503') || msg.includes('429') || msg.includes('fetch failed'))) {
          attempts++;
          await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000 + Math.random() * 1000));
          continue;
        }
        throw error;
      }
    }
  }

  async sendMessageStream(
    message: string, 
    media: string | null, 
    executors: ToolExecutors,
    onUpdate: (text: string, thought: string) => void,
    currentTimeString?: string,
    isOrchestration: boolean = false
  ): Promise<{ text: string, thought: string }> {
    // Ensure session exists - if not, throw error as session should be initialized by caller
    if (!this.chat) {
      console.error('[GeminiService] No active chat session when sendMessageStream called');
      throw new Error('Chat session not initialized. Please call startNewSession() first with proper context.');
    }

    const parts: Array<string | Part> = [];
    if (media) {
      const match = media.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
    
    const timeStr = currentTimeString || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const modeReminder = this.getTemporalModeReminder();
    parts.push(message + `\n\n[System Note: Current Local Time is ${timeStr}. ${modeReminder}]`);

    console.log('💬 Sending message to AI:', message.substring(0, 100) + '...');
    if (isOrchestration) {
      console.log('🎼 ORCHESTRATION MODE: Using extended timeout (60s stream, 45s chunks)');
    }
    
    // Use extended timeouts for orchestration
    const streamTimeout = isOrchestration ? ORCHESTRATION_STREAM_TIMEOUT : STREAM_TIMEOUT;
    const chunkTimeout = isOrchestration ? ORCHESTRATION_CHUNK_TIMEOUT : CHUNK_TIMEOUT;
    
    let accumulatedText = "";
    let accumulatedThought = "";
    let proposedOrchestration = false; // Track if propose_orchestration was successfully called

    try {
        const result = await this.chat!.sendMessageStream(parts);
        
        let functionCallParts: any[] = []; // Store function calls to execute
        let lastChunkTime = Date.now();

        for await (const chunk of result.stream) {
            // Check for chunk timeout
            if (Date.now() - lastChunkTime > chunkTimeout) {
                console.error(`⎰ Stream timeout: No chunks received for ${chunkTimeout/1000} seconds`);
                throw new Error(`Stream timeout: No chunks received for ${chunkTimeout/1000} seconds`);
            }
            lastChunkTime = Date.now();
            
            // Check for thoughts (if model supports it via specific output, otherwise assume standard text)
            // Note: Standard Gemini doesn't separate "thought" in the API response like the preview SDK might have simulated.
            // We'll treat all text as text for now, unless we prompt for explicit thought blocks.
            // However, existing logic parsed 'thought'. We will adapt.
            
            const chunkText = chunk.text();
            if (chunkText) {
                accumulatedText += chunkText;
                onUpdate(accumulatedText, accumulatedThought);
            }
            
            // Check for function calls in the chunk (aggregated at end usually, but inspecting)
            const calls = chunk.functionCalls();
            if (calls && calls.length > 0) {
                 functionCallParts.push(...calls);
            }
        }
        
        // Wait for full response to properly handle function calls (with timeout)
        console.log('✅ Text streaming complete. Checking for function calls...');
        const finalResponse = await withTimeout(
            result.response,
            streamTimeout,
            `Timed out waiting for complete response after ${streamTimeout/1000} seconds`
        );
        const finalCalls = finalResponse.functionCalls();

        if (finalCalls && finalCalls.length > 0) {
            console.log(`📞 AI called ${finalCalls.length} function(s):`, finalCalls.map(c => c.name).join(', '));
            
            const functionResponses = [];
            const executedCalls: any[] = []; // Track executed calls for fallback
            
            for (const call of finalCalls) {
                 let res: any = {};
                 try {
                     const args = call.args as any;
                     executedCalls.push({ name: call.name, args }); // Track this call
                     
                     if (call.name === 'get_relationship_status') res = await executors.getRelationshipStatus();
                     else if (call.name === 'get_life_context') res = await executors.getLifeContext(args);
                     else if (call.name === 'propose_orchestration') {
                         if (!isOrchestration) {
                             // Block auto-orchestration — only allowed on explicit user request
                             console.warn('🚫 Blocked propose_orchestration during non-orchestration interaction');
                             res = { status: 'not_executed: orchestration is only allowed when the user explicitly requests it. Recommend clicking Orchestrate Day instead.' };
                         } else {
                             res = { status: await executors.proposeOrchestration(args) };
                             proposedOrchestration = true;
                         }
                     }
                     else if (call.name === 'update_relationship_status') res = { status: await executors.updateRelationshipStatus(args) };
                     else if (call.name === 'add_task') res = { status: await executors.addTask(args) };
                     else if (call.name === 'delete_task') res = { status: await executors.deleteTask(args.title) };
                     else if (call.name === 'delete_relationship_status') res = { status: await executors.deleteRelationshipStatus(args.person_name) };
                     else if (call.name === 'save_memory') res = { status: await executors.saveMemory(args.content, args.type) };
                     else if (call.name === 'move_tasks') res = { status: await executors.moveTasks(args.task_identifiers, args.target_date) };
                 } catch(e) { res = { error: "Failed" }; }
                 
                 // Standard SDK expects specific response format
                 functionResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: { result: res }
                    }
                 });
            }
            
            // IMPORTANT: Force UI update after executing all functions to show pending contacts/proposals immediately
            console.log('✅ All functions executed. Triggering UI update for pending items...');
            onUpdate(accumulatedText, accumulatedThought);
            
            // Send function responses (with timeout protection)
            console.log('🔄 Sending function results back to AI for next action...');
            const functionResult = await this.chat!.sendMessageStream(functionResponses);
            
            lastChunkTime = Date.now();
            let secondStreamHadContent = false;
            
            for await (const chunk of functionResult.stream) {
                // Check for chunk timeout in second stream
                const timeout = isOrchestration ? chunkTimeout : CHUNK_TIMEOUT;
                if (Date.now() - lastChunkTime > timeout) {
                    console.warn(`Second stream timeout - using fallback message (waited ${timeout/1000}s)`);
                    break; // Exit gracefully
                }
                lastChunkTime = Date.now();
                
                const chunkText = chunk.text();
                if (chunkText) {
                    accumulatedText += chunkText;
                    onUpdate(accumulatedText, accumulatedThought);
                    secondStreamHadContent = true;
                }
            }
            
            // CRITICAL: Check if second stream ALSO has function calls (e.g., propose_orchestration after reading context)
            const secondResponse = await withTimeout(
                functionResult.response,
                streamTimeout,
                `Second stream timed out after ${streamTimeout/1000}s`
            );
            const secondCalls = secondResponse.functionCalls();
            
            if (secondCalls && secondCalls.length > 0) {
                console.log(`🔁 Second stream has ${secondCalls.length} MORE function call(s):`, secondCalls.map(c => c.name).join(', '));
                
                const secondFunctionResponses = [];
                const secondExecutedCalls: any[] = [];
                
                for (const call of secondCalls) {
                    let res: any = {};
                    try {
                        const args = call.args as any;
                        secondExecutedCalls.push({ name: call.name, args });
                        
                        if (call.name === 'get_relationship_status') res = await executors.getRelationshipStatus();
                        else if (call.name === 'get_life_context') res = await executors.getLifeContext(args);
                        else if (call.name === 'propose_orchestration') {
                            if (!isOrchestration) {
                                // Block auto-orchestration — only allowed on explicit user request
                                console.warn('🚫 Blocked propose_orchestration during non-orchestration interaction (second batch)');
                                res = { status: 'not_executed: orchestration is only allowed when the user explicitly requests it. Recommend clicking Orchestrate Day instead.' };
                            } else {
                                res = { status: await executors.proposeOrchestration(args) };
                                proposedOrchestration = true;
                            }
                        }
                        else if (call.name === 'update_relationship_status') res = { status: await executors.updateRelationshipStatus(args) };
                        else if (call.name === 'add_task') res = { status: await executors.addTask(args) };
                        else if (call.name === 'delete_task') res = { status: await executors.deleteTask(args.title) };
                        else if (call.name === 'delete_relationship_status') res = { status: await executors.deleteRelationshipStatus(args.person_name) };
                        else if (call.name === 'save_memory') res = { status: await executors.saveMemory(args.content, args.type) };
                        else if (call.name === 'move_tasks') res = { status: await executors.moveTasks(args.task_identifiers, args.target_date) };
                    } catch(e) { res = { error: "Failed" }; }
                    
                    secondFunctionResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: { result: res }
                        }
                    });
                }
                
                // IMPORTANT: Force UI update after second batch to show pending items
                console.log('✅ Second function batch executed. Triggering UI update...');
                onUpdate(accumulatedText, accumulatedThought);
                
                // Send second batch of function responses
                console.log('🔄 Sending second batch of function results back to AI...');
                const thirdResult = await this.chat!.sendMessageStream(secondFunctionResponses);
                
                lastChunkTime = Date.now();
                for await (const chunk of thirdResult.stream) {
                    const timeout = isOrchestration ? chunkTimeout : CHUNK_TIMEOUT;
                    if (Date.now() - lastChunkTime > timeout) {
                        console.warn(`Third stream timeout (waited ${timeout/1000}s)`);
                        break;
                    }
                    lastChunkTime = Date.now();
                    
                    const chunkText = chunk.text();
                    if (chunkText) {
                        accumulatedText += chunkText;
                        onUpdate(accumulatedText, accumulatedThought);
                        secondStreamHadContent = true;
                    }
                }
                
                // If still no content after second function batch, generate fallback
                if (!secondStreamHadContent || accumulatedText.trim().length < 10) {
                    const fallbackMsg = generateFallbackMessage(secondExecutedCalls);
                    if (fallbackMsg) {
                        console.log('Generating fallback after second function batch:', fallbackMsg);
                        accumulatedText = fallbackMsg;
                        onUpdate(accumulatedText, accumulatedThought);
                    }
                }
            } else if (!secondStreamHadContent || accumulatedText.trim().length < 10) {
                // No second function calls, check if we need fallback for first batch
                const fallbackMsg = generateFallbackMessage(executedCalls);
                if (fallbackMsg) {
                    console.log('Generating fallback message:', fallbackMsg);
                    accumulatedText = fallbackMsg;
                    onUpdate(accumulatedText, accumulatedThought);
                }
            }

            // ORCHESTRATION RESCUE: If orchestration was requested but propose_orchestration was
            // never called (AI acknowledged but forgot to propose), forcefully nudge it.
            if (isOrchestration && !proposedOrchestration) {
                console.warn('⚠️ ORCHESTRATION RESCUE: propose_orchestration was never called. Sending forced nudge...');
                const nudgeResult = await this.chat!.sendMessageStream(
                    ['[SYSTEM OVERRIDE: You acknowledged the orchestration request but did not call propose_orchestration. You MUST call propose_orchestration RIGHT NOW with a complete schedule for this day. This is mandatory — do not output any more text, just call propose_orchestration immediately.]']
                );

                for await (const chunk of nudgeResult.stream) {
                    if (Date.now() - lastChunkTime > chunkTimeout) break;
                    lastChunkTime = Date.now();
                    const chunkText = chunk.text();
                    if (chunkText) { accumulatedText += chunkText; onUpdate(accumulatedText, accumulatedThought); }
                }

                const nudgeResponse = await withTimeout(
                    nudgeResult.response,
                    ORCHESTRATION_STREAM_TIMEOUT,
                    'Orchestration rescue nudge timed out'
                );
                const nudgeCalls = nudgeResponse.functionCalls();

                if (nudgeCalls && nudgeCalls.length > 0) {
                    console.log(`🚨 ORCHESTRATION RESCUE: Got ${nudgeCalls.length} call(s):`, nudgeCalls.map(c => c.name).join(', '));
                    const nudgeResponses = [];

                    for (const call of nudgeCalls) {
                        let res: any = {};
                        try {
                            const args = call.args as any;
                            if (call.name === 'get_relationship_status') res = await executors.getRelationshipStatus();
                            else if (call.name === 'get_life_context') res = await executors.getLifeContext(args);
                            else if (call.name === 'propose_orchestration') { res = { status: await executors.proposeOrchestration(args) }; proposedOrchestration = true; }
                            else if (call.name === 'update_relationship_status') res = { status: await executors.updateRelationshipStatus(args) };
                            else if (call.name === 'add_task') res = { status: await executors.addTask(args) };
                            else if (call.name === 'delete_task') res = { status: await executors.deleteTask(args.title) };
                            else if (call.name === 'move_tasks') res = { status: await executors.moveTasks(args.task_identifiers, args.target_date) };
                            else if (call.name === 'save_memory') res = { status: await executors.saveMemory(args.content, args.type) };
                        } catch(e) { res = { error: 'Failed' }; }
                        nudgeResponses.push({ functionResponse: { name: call.name, response: { result: res } } });
                    }

                    onUpdate(accumulatedText, accumulatedThought);
                    const nudgeFinal = await this.chat!.sendMessageStream(nudgeResponses);
                    for await (const chunk of nudgeFinal.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) { accumulatedText += chunkText; onUpdate(accumulatedText, accumulatedThought); }
                    }
                } else {
                    console.warn('⚠️ ORCHESTRATION RESCUE: AI still did not call propose_orchestration after nudge.');
                }
            }
        } else {
            console.log('ℹ️ No function calls detected in response. AI provided text only.');
        }
        
    } catch(e) {
        console.error("🚨 Stream error:", e);
        // If it's a timeout during second stream and we have accumulated text, that's acceptable
        if (e instanceof Error && e.message.includes('timeout') && accumulatedText) {
            console.warn('⚠️ Stream timed out but returning partial content:', accumulatedText.substring(0, 100) + '...');
            return { text: accumulatedText, thought: accumulatedThought };
        }
        throw e;
    }

    return { text: accumulatedText, thought: accumulatedThought };
  }

  async sendMessage(
    message: string, 
    media: string | null, 
    executors: ToolExecutors,
    currentTimeString?: string
  ): Promise<{ text: string, thought: string }> {
    if (!this.chat) this.startNewSession();

    const parts: Array<string | Part> = [];
    if (media) {
      const match = media.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
    
    const timeStr = currentTimeString || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const modeReminder = this.getTemporalModeReminder();
    parts.push(message + `\n\n[System Note: Current Local Time is ${timeStr}. ${modeReminder}]`);

    let accumulatedThought = "";
    
    try {
        let result = await this.retry(() => this.chat!.sendMessage(parts));
        let response = await result.response;
        
        let functionCalls = response.functionCalls();
        const executedCalls: any[] = []; // Track executed calls for fallback
        
        while (functionCalls && functionCalls.length > 0) {
            const functionResponses = [];
            for (const call of functionCalls) {
                let res: any = {};
                try {
                     const args = call.args as any;
                     executedCalls.push({ name: call.name, args }); // Track this call
                     
                     if (call.name === 'get_relationship_status') res = await executors.getRelationshipStatus();
                     else if (call.name === 'get_life_context') res = await executors.getLifeContext(args);
                     else if (call.name === 'propose_orchestration') res = { status: await executors.proposeOrchestration(args) };
                     else if (call.name === 'update_relationship_status') res = { status: await executors.updateRelationshipStatus(args) };
                     else if (call.name === 'add_task') res = { status: await executors.addTask(args) };
                     else if (call.name === 'delete_task') res = { status: await executors.deleteTask(args.title) };
                     else if (call.name === 'delete_relationship_status') res = { status: await executors.deleteRelationshipStatus(args.person_name) };
                     else if (call.name === 'save_memory') res = { status: await executors.saveMemory(args.content, args.type) };
                     else if (call.name === 'move_tasks') res = { status: await executors.moveTasks(args.task_identifiers, args.target_date) };
                } catch (e) { res = { error: "Failed to execute tool" }; }
                
                functionResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: { result: res }
                    }
                });
            }
            result = await this.retry(() => this.chat!.sendMessage(functionResponses));
            response = await result.response;
            functionCalls = response.functionCalls();
        }

        let responseText = response.text();
        
        // If response is empty after function calls, generate fallback
        if (executedCalls.length > 0 && (!responseText || responseText.trim().length < 10)) {
            const fallbackMsg = generateFallbackMessage(executedCalls);
            if (fallbackMsg) {
                console.log('Generating fallback message (non-streaming):', fallbackMsg);
                responseText = fallbackMsg;
            }
        }

        return { text: responseText, thought: accumulatedThought };
        
    } catch(e) {
        console.error("Message Error", e);
        throw e;
    }
  }

  async countTokens(text: string): Promise<number> {
    try {
        const response = await this.model.countTokens(text);
        return response.totalTokens;
    } catch (e) {
        console.warn("Count tokens failed", e);
        return 0;
    }
  }
}

export const geminiService = new GeminiService();
