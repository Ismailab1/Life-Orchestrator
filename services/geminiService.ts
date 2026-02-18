
import { 
  GoogleGenAI, 
  FunctionDeclaration, 
  Type, 
  Chat,
  Part,
  GenerateContentResponse
} from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { LifeInventory, RelationshipLedger, OrchestrationProposal, UpdateRelationshipArgs, Task } from "../types";

// Tool Definitions
const getRelationshipStatusTool: FunctionDeclaration = {
  name: 'get_relationship_status',
  description: 'Retrieves the current status of family, friends, and network connections.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const getLifeContextTool: FunctionDeclaration = {
  name: 'get_life_context',
  description: 'Gets the user\'s current schedule, tasks, and goals across career and personal life.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: 'The date to check (YYYY-MM-DD).' },
    },
  },
};

const proposeOrchestrationTool: FunctionDeclaration = {
  name: 'propose_orchestration',
  description: 'Submits a restructured day plan. You MUST include the full structured list of tasks in the `schedule` argument to ensure the app updates correctly.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      optimized_timeline: { type: Type.STRING, description: 'The full hourly breakdown text.' },
      reasoning: { type: Type.STRING, description: 'Why these specific shifts were made.' },
      schedule: {
        type: Type.ARRAY,
        description: 'The complete list of tasks for the day, including fixed anchors and newly scheduled flexible tasks.',
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            gcal_id: { type: Type.STRING },
            title: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['fixed', 'flexible'] },
            time: { type: Type.STRING, description: 'Start time e.g. "2:00 PM"' },
            duration: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
            category: { type: Type.STRING, enum: ['Career', 'Life', 'Health', 'Family'] },
            recurrence: {
              type: Type.OBJECT,
              description: 'Optional recurrence rule if this task should become a routine.',
              properties: {
                frequency: { type: Type.STRING, enum: ['daily', 'weekly', 'monthly'] },
                weekDays: { 
                  type: Type.ARRAY, 
                  description: 'Array of numbers for weekly recurrence (0=Sunday, 1=Monday, etc.)',
                  items: { type: Type.NUMBER } 
                },
                dayOfMonth: { type: Type.NUMBER, description: 'Day of the month for monthly recurrence (1-31)' }
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
  description: 'Updates a person\'s status in the ledger. If the person does not exist, it PROPOSES a new entry for user approval.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      person_name: { type: Type.STRING, description: 'The name of the person (e.g., Grandma, Alex, Sarah).' },
      notes_update: { type: Type.STRING, description: 'New notes, health updates, or activity logs.' },
      status_level: { type: Type.STRING, enum: ['Stable', 'Needs Attention', 'Critical', 'Overdue'], description: 'The current status.' },
      category: { type: Type.STRING, enum: ['Family', 'Friend', 'Network'], description: 'Category (required if creating a new person).' },
      relation: { type: Type.STRING, description: 'Relationship descriptor (e.g. Aunt, Coworker) if known. Useful for new contacts.' }
    },
    required: ['person_name', 'notes_update', 'status_level'],
  },
};

const addTaskTool: FunctionDeclaration = {
    name: 'add_task',
    description: 'Adds a new task or event to the Life Inventory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Title of the task' },
        type: { type: Type.STRING, enum: ['fixed', 'flexible'], description: 'Type of task (fixed for specific time, flexible for any time)' },
        duration: { type: Type.STRING, description: 'Duration (e.g. "1h", "30m")' },
        priority: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: 'Priority level' },
        category: { type: Type.STRING, enum: ['Career', 'Life', 'Health', 'Family'], description: 'Category' },
        time: { type: Type.STRING, description: 'Specific time for fixed tasks (e.g. "2:00 PM"). Optional for flexible tasks.' },
        recurrence: {
            type: Type.OBJECT,
            description: 'Optional recurrence rule for repeating tasks',
            properties: {
                frequency: { type: Type.STRING, enum: ['daily', 'weekly', 'monthly'] },
                weekDays: { 
                    type: Type.ARRAY, 
                    description: 'Array of numbers for weekly recurrence (0=Sunday, 1=Monday, etc.)',
                    items: { type: Type.NUMBER } 
                },
                dayOfMonth: { type: Type.NUMBER, description: 'Day of the month for monthly recurrence (1-31)' }
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
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'The title of the task to delete. Attempts fuzzy matching.' }
        },
        required: ['title']
    }
};

const deleteRelationshipStatusTool: FunctionDeclaration = {
    name: 'delete_relationship_status',
    description: 'Removes a person from the Relationship Ledger.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            person_name: { type: Type.STRING, description: 'The name of the person to remove.' }
        },
        required: ['person_name']
    }
};

const saveMemoryTool: FunctionDeclaration = {
    name: 'save_memory',
    description: 'Persists a key fact, preference, or decision to Long-Term Memory. Use this to remember things across different days and sessions.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            content: { type: Type.STRING, description: 'The fact or decision to remember (e.g., "User prefers gym in the evenings", "Decided to move Strategy Review to Fridays").' },
            type: { type: Type.STRING, enum: ['preference', 'decision', 'fact'], description: 'Category of the memory.' }
        },
        required: ['content', 'type']
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
}

export class GeminiService {
  private ai: GoogleGenAI;
  private chat: Chat | null = null;
  private tools: FunctionDeclaration[];

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.tools = [
      getRelationshipStatusTool, 
      getLifeContextTool, 
      proposeOrchestrationTool,
      updateRelationshipStatusTool,
      addTaskTool,
      deleteTaskTool,
      deleteRelationshipStatusTool,
      saveMemoryTool
    ];
  }

  // Force creation of a new chat session to ensure no context leaks between logical sessions
  // Accepts an optional initial context string to support Demo Mode vs Live Mode
  startNewSession(initialTimeContext?: string) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let context = initialTimeContext || "";
    
    if (!context.includes("User Timezone:")) {
        context += `\nUser Timezone: ${timezone}`;
    }

    this.chat = this.ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\n\n" + context,
        tools: [{ functionDeclarations: this.tools }],
        thinkingConfig: { thinkingBudget: 1024 },
      },
    });
  }

  private async retry<T>(operation: () => Promise<T>): Promise<T> {
    let attempts = 0;
    const maxRetries = 3;
    
    while (true) {
      try {
        return await operation();
      } catch (error: any) {
        const errorCode = error.status || error.error?.code || error.response?.status;
        const errorMessage = (error.message || JSON.stringify(error)).toLowerCase();
        
        const isRateLimit = errorCode === 429 || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('resource_exhausted');
        const isServerBusy = errorCode === 503 || errorMessage.includes('503') || errorMessage.includes('overloaded');
        const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('failed to fetch');
        
        if (attempts < maxRetries && (isRateLimit || isServerBusy || isNetworkError)) {
          attempts++;
          const delay = Math.pow(2, attempts) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }

  private extractThoughts(response: any): string {
    let thoughts = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).thought) {
          thoughts += (part as any).text + "\n";
        }
      }
    }
    return thoughts;
  }

  async sendMessage(
    message: string, 
    media: string | null, 
    executors: ToolExecutors,
    currentTimeString?: string
  ): Promise<{ text: string, thought: string }> {
    if (!this.chat) this.startNewSession();

    const parts: Part[] = [];
    if (media) {
      const match = media.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
    
    const timeStr = currentTimeString || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    parts.push({ text: message + `\n\n[System Note: Current Local Time is ${timeStr}]` });

    let accumulatedThought = "";
    let response = await this.retry<GenerateContentResponse>(() => this.chat!.sendMessage({ message: parts }));
    accumulatedThought += this.extractThoughts(response);

    while (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = [];
        for (const call of response.functionCalls) {
            let result: any = {};
            try {
                if (call.name === 'get_relationship_status') result = await executors.getRelationshipStatus();
                else if (call.name === 'get_life_context') result = await executors.getLifeContext(call.args as any);
                else if (call.name === 'propose_orchestration') result = { status: await executors.proposeOrchestration(call.args as any) };
                else if (call.name === 'update_relationship_status') result = { status: await executors.updateRelationshipStatus(call.args as any) };
                else if (call.name === 'add_task') result = { status: await executors.addTask(call.args as any) };
                else if (call.name === 'delete_task') result = { status: await executors.deleteTask((call.args as any).title) };
                else if (call.name === 'delete_relationship_status') result = { status: await executors.deleteRelationshipStatus((call.args as any).person_name) };
                else if (call.name === 'save_memory') result = { status: await executors.saveMemory((call.args as any).content, (call.args as any).type) };
            } catch (e) { result = { error: "Failed to execute tool" }; }
            functionResponses.push({ id: call.id, name: call.name, response: { result } });
        }
        response = await this.retry<GenerateContentResponse>(() => this.chat!.sendMessage({ message: functionResponses.map(resp => ({ functionResponse: resp })) }));
        accumulatedThought += this.extractThoughts(response);
    }

    let finalText = "";
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (!(part as any).thought && part.text) finalText += part.text;
        }
    }
    return { text: finalText || response.text || "Processed.", thought: accumulatedThought.trim() };
  }

  async sendMessageStream(
    message: string, 
    media: string | null, 
    executors: ToolExecutors,
    onUpdate: (text: string, thought: string) => void,
    currentTimeString?: string
  ): Promise<{ text: string, thought: string }> {
    if (!this.chat) this.startNewSession();

    const parts: Part[] = [];
    if (media) {
      const match = media.match(/^data:(.+);base64,(.+)$/);
      if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    
    const timeStr = currentTimeString || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    parts.push({ text: message + `\n\n[System Note: Current Local Time is ${timeStr}]` });

    let currentParts = parts;
    let accumulatedText = "";
    let accumulatedThought = "";

    while (true) {
        const stream = await this.retry<AsyncIterable<GenerateContentResponse>>(() => this.chat!.sendMessageStream({ message: currentParts }));
        let functionCalls: any[] = [];

        for await (const chunk of stream) {
             const c = chunk as any;
             if (c.candidates?.[0]?.content?.parts) {
                 for (const part of c.candidates[0].content.parts) {
                     if (part.thought) accumulatedThought += part.text;
                     else if (part.text) accumulatedText += part.text;
                 }
                 onUpdate(accumulatedText, accumulatedThought.trim());
             }
             if (c.functionCalls && c.functionCalls.length > 0) functionCalls.push(...c.functionCalls);
        }

        const uniqueFunctionCalls = Array.from(new Map(functionCalls.map(fc => [fc.id, fc])).values());
        if (uniqueFunctionCalls.length > 0) {
             const functionResponses = [];
             for (const call of uniqueFunctionCalls) {
                 let res: any = {};
                 try {
                     if (call.name === 'get_relationship_status') res = await executors.getRelationshipStatus();
                     else if (call.name === 'get_life_context') res = await executors.getLifeContext(call.args as any);
                     else if (call.name === 'propose_orchestration') res = { status: await executors.proposeOrchestration(call.args as any) };
                     else if (call.name === 'update_relationship_status') res = { status: await executors.updateRelationshipStatus(call.args as any) };
                     else if (call.name === 'add_task') res = { status: await executors.addTask(call.args as any) };
                     else if (call.name === 'delete_task') res = { status: await executors.deleteTask((call.args as any).title) };
                     else if (call.name === 'delete_relationship_status') res = { status: await executors.deleteRelationshipStatus((call.args as any).person_name) };
                     else if (call.name === 'save_memory') res = { status: await executors.saveMemory((call.args as any).content, (call.args as any).type) };
                 } catch(e) { res = { error: "Failed" }; }
                 functionResponses.push({ id: call.id, name: call.name, response: { result: res } });
             }
             currentParts = functionResponses.map(r => ({ functionResponse: r }));
        } else break;
    }
    return { text: accumulatedText, thought: accumulatedThought.trim() };
  }

  async countTokens(text: string): Promise<number> {
    try {
        const response = await this.ai.models.countTokens({
            model: 'gemini-1.5-flash',
            contents: [ { role: 'user', parts: [ { text } ] } ] 
        });
        return response.totalTokens || 0;
    } catch (e) {
        console.warn("Count tokens failed", e);
        return 0;
    }
  }
}

export const geminiService = new GeminiService();
