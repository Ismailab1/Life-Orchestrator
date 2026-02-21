
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

// --- Tool Definitions (Adapted for @google/generative-ai) ---
// Note: The schema format is slightly different (SchemaType vs Type) but structure is similar.

const getRelationshipStatusTool: FunctionDeclaration = {
  name: 'get_relationship_status',
  description: 'Retrieves the current status of family, friends, and network connections.',
};

const getLifeContextTool: FunctionDeclaration = {
  name: 'get_life_context',
  description: 'Gets the user\'s current schedule, tasks, and goals across career and personal life.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: { type: SchemaType.STRING, description: 'The date to check (YYYY-MM-DD).' },
    },
  },
};

const proposeOrchestrationTool: FunctionDeclaration = {
  name: 'propose_orchestration',
  description: 'Submits a restructured day plan.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      optimized_timeline: { type: SchemaType.STRING, description: 'The full hourly breakdown text.' },
      reasoning: { type: SchemaType.STRING, description: 'Why these specific shifts were made.' },
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
      relation: { type: SchemaType.STRING }
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
    description: 'Moves specific tasks to a new date.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        task_identifiers: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        target_date: { type: SchemaType.STRING }
      },
      required: ['task_identifiers', 'target_date']
    }
};

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

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private chat: ChatSession | null = null;
  private tools: FunctionDeclaration[];
  private currentTemporalMode: 'reflection' | 'active' | 'planning' = 'active';
  private abortController: AbortController | null = null;

  constructor() {
    const apiKey = process.env.API_KEY || '';
    if (!apiKey) console.warn("GeminiService: API Key is missing! Check .env and vite.config.ts.");
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    
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

    let accumulatedText = "";
    let accumulatedThought = "";

    try {
        const result = await this.chat!.sendMessageStream(parts);
        
        let functionCallParts: any[] = []; // Store function calls to execute

        for await (const chunk of result.stream) {
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
        
        // Wait for full response to properly handle function calls
        const finalResponse = await result.response;
        const finalCalls = finalResponse.functionCalls();

        if (finalCalls && finalCalls.length > 0) {
            const functionResponses = [];
            for (const call of finalCalls) {
                 let res: any = {};
                 try {
                     const args = call.args as any;
                     if (call.name === 'get_relationship_status') res = await executors.getRelationshipStatus();
                     else if (call.name === 'get_life_context') res = await executors.getLifeContext(args);
                     else if (call.name === 'propose_orchestration') res = { status: await executors.proposeOrchestration(args) };
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
            
            // Send function responses
            const functionResult = await this.chat!.sendMessageStream(functionResponses);
            
             for await (const chunk of functionResult.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    accumulatedText += chunkText;
                    onUpdate(accumulatedText, accumulatedThought);
                }
            }
        }
        
    } catch(e) {
        console.error("Stream error", e);
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
        while (functionCalls && functionCalls.length > 0) {
            const functionResponses = [];
            for (const call of functionCalls) {
                let res: any = {};
                try {
                     const args = call.args as any;
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

        return { text: response.text(), thought: accumulatedThought };
        
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
