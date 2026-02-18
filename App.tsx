
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { INITIAL_INVENTORY, INITIAL_LEDGER, EMPTY_INVENTORY, EMPTY_LEDGER, GOOGLE_CLIENT_ID } from './constants';
import { LifeInventory, RelationshipLedger, ChatMessage, OrchestrationProposal, UpdateRelationshipArgs, Person, Task, Memory, ChatHistory, StorageStats } from './types';
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

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

interface AppProps {
  mode: 'demo' | 'live';
  onBack: () => void;
}

const MAX_IMAGES_PER_DAY = 5;
const toDateString = (date: Date) => date.toLocaleDateString('en-CA');

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
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
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

  const [ledger, setLedger] = useState<RelationshipLedger>(() => {
    if (mode === 'live') {
      const saved = localStorage.getItem('life_ledger');
      return saved ? JSON.parse(saved) : EMPTY_LEDGER;
    }
    return INITIAL_LEDGER;
  });

  const calendarService = useMemo(() => new GoogleCalendarService(GOOGLE_CLIENT_ID), []);
  
  const [inventory, setInventory] = useState<LifeInventory>(() => {
    if (mode === 'live') {
      const saved = localStorage.getItem('life_inventory');
      return saved ? JSON.parse(saved) : EMPTY_INVENTORY;
    }
    
    if (mode === 'demo') {
        const todayStr = toDateString(new Date());
        const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yStr = toDateString(yesterdayDate);
        const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tStr = toDateString(tomorrowDate);
        
        return {
            fixed: [
                { id: 'hist_1', title: 'Strategy Review w/ Board', type: 'fixed', time: '11:00 AM', duration: '2h', priority: 'high', category: 'Career', date: yStr },
                { id: 'hist_2', title: 'Dinner with Mom', type: 'fixed', time: '6:30 PM', duration: '2h', priority: 'high', category: 'Family', date: yStr },
                ...INITIAL_INVENTORY.fixed.map(t => ({...t, date: t.recurrence ? undefined : todayStr})),
                { id: 'plan_1', title: 'Project Launch: Phase 1', type: 'fixed', time: '9:00 AM', duration: '3h', priority: 'high', category: 'Career', date: tStr }
            ],
            flexible: [
                { id: 'hist_3', title: 'Quick 5k Run', type: 'flexible', duration: '30m', priority: 'medium', category: 'Health', date: yStr },
                ...INITIAL_INVENTORY.flexible.map(t => ({...t, date: t.recurrence ? undefined : todayStr})),
                { id: 'plan_2', title: 'Grocery Run (Meal Prep)', type: 'flexible', duration: '1h', priority: 'low', category: 'Life', date: tStr }
            ]
        };
    }
    return INITIAL_INVENTORY;
  });

  const [memories, setMemories] = useState<Memory[]>(() => {
      const saved = localStorage.getItem('life_memories');
      return saved ? JSON.parse(saved) : [];
  });

  const [allMessages, setAllMessages] = useState<ChatHistory>(() => {
      if (mode === 'live') {
          const saved = localStorage.getItem('life_messages');
          let history: ChatHistory = saved ? JSON.parse(saved) : {};
          
          const now = Date.now();
          const lastActive = parseInt(localStorage.getItem('life_last_active') || '0');
          const inactivityPeriod = now - lastActive;
          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
          const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

          if (lastActive > 0 && inactivityPeriod > SEVEN_DAYS_MS) {
              history = {};
          }

          const cutoffDate = new Date(now - FOURTEEN_DAYS_MS);
          const filteredHistory: ChatHistory = {};
          Object.entries(history).forEach(([dateStr, msgs]) => {
              if (new Date(dateStr) >= cutoffDate) {
                  filteredHistory[dateStr] = msgs;
              }
          });
          history = filteredHistory;

          return history;
      }
      
      if (mode === 'demo') {
          const today = new Date();
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
          const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
          const yKey = toDateString(yesterday);
          const todayKey = toDateString(today);
          const tKey = toDateString(tomorrow);
          const createIso = (baseDate: Date, hours: number, mins: number) => {
              const d = new Date(baseDate); d.setHours(hours, mins, 0, 0);
              return d.toISOString();
          };
          return {
              [yKey]: [
                  { id: 'dm1', role: 'model', timestamp: createIso(yesterday, 8, 30), text: "Good morning! You've got a Strategy Review at 11:00 AM and Dinner with Mom at 6:30 PM today. I've slotted a 5k run into your 4:00 PM gap." },
                  { id: 'dm2', role: 'user', timestamp: createIso(yesterday, 18, 45), text: "Dinner with Mom was great! She seems much more energetic today.", media: 'https://picsum.photos/id/1062/400/300' },
                  { id: 'dm3', role: 'model', timestamp: createIso(yesterday, 18, 46), thought: "Analyzing photo... Grandma looks mobile. Updating ledger status.", text: "That's wonderful to hear. I've updated her status to 'Stable'." }
              ],
              [todayKey]: [
                  { id: 'dm4', role: 'model', timestamp: createIso(today, 8, 15), text: "Briefing for Today: You have Grandma's PT at 10:00 AM and the Capital One Interview at 2:00 PM. I suggest focusing on Python Debugging practice right after PT." },
                  { id: 'dm5', role: 'user', timestamp: createIso(today, 9, 30), text: "The interview got moved to 3:30 PM. Can you re-orchestrate?" },
                  { id: 'dm6', role: 'model', timestamp: createIso(today, 9, 31), thought: "Recalculating slots.", text: "No problem. I've shifted the Python practice to follow the interview. Here's the new flow:", proposal: {
                      optimized_timeline: "10:00 AM - Grandma PT\n12:00 PM - Lunch & Recap\n1:00 PM - Gym (Moved Up)\n3:30 PM - Capital One Interview\n4:30 PM - Python Practice",
                      reasoning: "Moving the Gym session earlier takes advantage of the new gap before your interview, ensuring you don't skip your health goals due to the late finish.",
                      schedule: [
                        { id: '1', title: 'Grandma Physical Therapy', type: 'fixed', time: '10:00 AM', duration: '1h', priority: 'high', category: 'Family' },
                        { id: '4', title: 'Gym / Cardio', type: 'fixed', time: '1:00 PM', duration: '1h', priority: 'medium', category: 'Health', recurrence: { frequency: 'daily' } },
                        { id: '2', title: 'Interview with Capital One', type: 'fixed', time: '3:30 PM', duration: '1h', priority: 'high', category: 'Career' },
                        { id: '3', title: 'Python Debugging Practice', type: 'fixed', time: '4:30 PM', duration: '2h', priority: 'medium', category: 'Career' },
                        { id: '5', title: 'Call Alex', type: 'flexible', duration: '30m', priority: 'low', category: 'Life', recurrence: { frequency: 'weekly', weekDays: [0, 6] } }
                      ]
                  }}
              ],
              [tKey]: [
                  { id: 'dm7', role: 'user', timestamp: createIso(tomorrow, 9, 0), text: "Starting to think about tomorrow. Big launch phase starting." },
                  { id: 'dm8', role: 'model', timestamp: createIso(tomorrow, 9, 1), text: "I've noted the 'Project Launch' anchor. I recommend clearing the morning. I've added a flexible 'Grocery Run' for the afternoon." }
              ]
          };
      }
      return {};
  });

  useEffect(() => {
    localStorage.setItem('life_last_active', Date.now().toString());
  }, [allMessages, ledger, inventory]);

  useEffect(() => { 
    if (mode === 'live') {
        localStorage.setItem('life_ledger', JSON.stringify(ledger)); 
        localStorage.setItem('life_inventory', JSON.stringify(inventory)); 
        localStorage.setItem('life_messages', JSON.stringify(allMessages));
    }
    localStorage.setItem('life_memories', JSON.stringify(memories));
    
    // safe update of stats
    storageService.getStats().then(stats => setStorageStats(stats)).catch(e => console.error("Stats error", e));

  }, [ledger, inventory, memories, allMessages, mode]);

  const ledgerRef = useRef<RelationshipLedger>(ledger);
  useEffect(() => { ledgerRef.current = ledger; }, [ledger]);
  const inventoryRef = useRef<LifeInventory>(inventory);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);

  const [isLoading, setIsLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const pendingProposalRef = useRef<OrchestrationProposal | null>(null);
  const pendingContactRef = useRef<Person | null>(null);
  const initializedDateRef = useRef<string>('');

  const dailyInventory = useMemo(() => getTasksForDate(inventory, toDateString(currentDate)), [inventory, currentDate]);
  const messages = useMemo(() => allMessages[toDateString(currentDate)] || [], [allMessages, currentDate]);

  const getModeTime = () => mode === 'demo' ? "9:00 AM" : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const handleDateChange = (date: Date) => setCurrentDate(date);

  const updateCurrentDayMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      const key = toDateString(currentDate);
      setAllMessages(prev => ({ ...prev, [key]: updater(prev[key] || []) }));
  };

  const handleSendMessage = async (text: string, media: string | null) => {
    const currentDayMessages = messages;
    const imagesToday = currentDayMessages.filter(m => !!m.media).length;

    if (media && imagesToday >= MAX_IMAGES_PER_DAY) {
        alert(`Storage Limit: Maximum of ${MAX_IMAGES_PER_DAY} images per day allowed to preserve browser space. Please clear some history or try tomorrow.`);
        return;
    }

    const compressedMedia = media ? await compressImage(media) : null;
    const userMsgId = Math.random().toString(36).substr(2, 9);
    const modelMsgId = Math.random().toString(36).substr(2, 9);

    updateCurrentDayMessages(prev => [...prev, { id: userMsgId, role: 'user', text, timestamp: new Date().toISOString(), media: compressedMedia || undefined }]);
    updateCurrentDayMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', thought: '', timestamp: new Date().toISOString() }]);
    
    setIsLoading(true);
    try {
      await geminiService.sendMessageStream(text, compressedMedia, executors, (streamText, streamThought) => {
          updateCurrentDayMessages(prev => {
              const newArr = [...prev]; const last = newArr[newArr.length - 1];
              if (last && last.role === 'model' && last.id === modelMsgId) { last.text = streamText; last.thought = streamThought; }
              return newArr;
          });
          if (streamText || streamThought) setIsLoading(false);
      }, getModeTime());
      updateCurrentDayMessages(prev => {
          const newArr = [...prev]; const last = newArr[newArr.length - 1];
          if (last && last.role === 'model' && last.id === modelMsgId) {
              if (pendingProposalRef.current) last.proposal = pendingProposalRef.current;
              if (pendingContactRef.current) last.contactProposals = [pendingContactRef.current];
          }
          pendingProposalRef.current = null; pendingContactRef.current = null;
          return newArr;
      });
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
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
  };

  const handleClearAllHistory = () => {
      setAllMessages({});
  };

  const executors = {
    getRelationshipStatus: async () => ledgerRef.current,
    getLifeContext: async (args?: { date?: string }) => getTasksForDate(inventoryRef.current, args?.date || toDateString(currentDate)),
    proposeOrchestration: async (newProposal: OrchestrationProposal) => { pendingProposalRef.current = newProposal; return "Proposal generated."; },
    updateRelationshipStatus: async (args: UpdateRelationshipArgs) => {
        const currentLedger = ledgerRef.current;
        const normalize = (s: string) => s.toLowerCase().trim();
        const targetName = normalize(args.person_name);
        const matchedKey = Object.keys(currentLedger).find(k => normalize((currentLedger[k] as Person).name) === targetName || normalize(k) === targetName);

        if (!matchedKey) {
            const newPerson: Person = {
                name: args.person_name, relation: args.relation || "New Contact", category: args.category || 'Network',
                priority: 3, notes: args.notes_update, status: args.status_level, last_contact: new Date().toISOString(),
                image: `https://ui-avatars.com/api/?name=${args.person_name}&background=random`
            };
            pendingContactRef.current = newPerson;
            return `Proposal to add ${args.person_name} prepared.`;
        } else {
            setLedger(prev => ({ ...prev, [matchedKey]: { ...(prev[matchedKey] as Person), notes: args.notes_update, status: args.status_level, last_contact: new Date().toISOString() } }));
            return `Updated ${args.person_name}'s ledger.`;
        }
    },
    addTask: async (task: Omit<Task, 'id'>) => {
        const isRecurring = !!task.recurrence;
        const newTask: Task = { ...task, id: Math.random().toString(36).substr(2, 9), date: isRecurring ? undefined : toDateString(currentDate) };
        setInventory(prev => {
            const listKey = newTask.type === 'fixed' ? 'fixed' : 'flexible';
            return { ...prev, [listKey]: [...prev[listKey], newTask] };
        });
        return `Added task "${newTask.title}".`;
    },
    deleteTask: async (title: string) => {
        const normalize = (s: string) => s.toLowerCase().trim();
        const target = normalize(title);
        let deleted = false;
        
        setInventory(prev => {
            // Find in fixed
            const fMatch = prev.fixed.find(t => normalize(t.title) === target); // Exact match first
            if (fMatch) { 
                deleted = true; 
                return { ...prev, fixed: prev.fixed.filter(t => t.id !== fMatch.id) }; 
            }
            
            // Find in flexible
            const flexMatch = prev.flexible.find(t => normalize(t.title) === target);
            if (flexMatch) { 
                deleted = true; 
                return { ...prev, flexible: prev.flexible.filter(t => t.id !== flexMatch.id) }; 
            }

            // Fuzzy fallback if no exact match
            const fFuzzy = prev.fixed.find(t => normalize(t.title).includes(target));
            if (fFuzzy) {
                deleted = true;
                return { ...prev, fixed: prev.fixed.filter(t => t.id !== fFuzzy.id) };
            }
             const flexFuzzy = prev.flexible.find(t => normalize(t.title).includes(target));
            if (flexFuzzy) {
                deleted = true;
                return { ...prev, flexible: prev.flexible.filter(t => t.id !== flexFuzzy.id) };
            }

            return prev;
        });
        return deleted ? `Deleted task matching "${title}".` : "No task found.";
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
        setMemories(prev => [ ...prev, { id: Math.random().toString(36).substr(2, 9), content, type, date: new Date().toLocaleDateString() } ]);
        return `Saved to memory: "${content}"`;
    }
  };

  useEffect(() => {
    const dateKey = toDateString(currentDate);
    if (initializedDateRef.current === dateKey) return;
    initializedDateRef.current = dateKey;
    if (allMessages[dateKey] && allMessages[dateKey].length > 0) return;
    const yesterday = new Date(currentDate); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateString(yesterday);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let memoryContext = memories.length > 0 ? `\n\n== LONG-TERM MEMORY BANK ==\n${memories.map(m => `- [${m.date}] (${m.type}): ${m.content}`).join('\n')}` : "";
    
    geminiService.startNewSession(`
Session Context:
Target Date: ${currentDate.toLocaleDateString()}
Current Session Time: ${getModeTime()}
Is Future Date: ${currentDate > new Date()}
User Mode: ${mode}
User Timezone: ${timezone}
${memoryContext}`);

    const startBriefing = async () => {
      const timestamp = new Date().toISOString();
      const modelId = Math.random().toString(36).substr(2, 9);
      updateCurrentDayMessages(() => [{ id: modelId, role: 'model', text: '', thought: '', timestamp }]);
      setIsLoading(true);
      try {
        const briefingPrompt = mode === 'demo' 
            ? `Generate briefing for ${currentDate.toLocaleDateString()}. Compare with ${yesterdayStr}. IMPORTANT: Explicitly mention that you are assuming the context of 9:00 AM on this specific date for the simulation.`
            : `Generate briefing for ${currentDate.toLocaleDateString()}. Compare with ${yesterdayStr}.`;

        await geminiService.sendMessageStream(briefingPrompt, null, executors, (text, thought) => {
            updateCurrentDayMessages(prev => {
                const newArr = [...prev]; const last = newArr[newArr.length - 1];
                if (last && last.role === 'model' && last.id === modelId) { last.text = text; last.thought = thought; }
                return newArr;
            });
            if (text || thought) setIsLoading(false);
        }, getModeTime());
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    startBriefing();
  }, [currentDate]);

  const handleUpdateTask = (task: Task) => setInventory(prev => {
      const fixed = prev.fixed.filter(t => t.id !== task.id);
      const flexible = prev.flexible.filter(t => t.id !== task.id);
      if (task.type === 'fixed') return { fixed: [...fixed, task], flexible };
      else return { fixed, flexible: [...flexible, task] };
  });
  
  const handleManualAddTask = (task: Task) => {
    const isRecurring = !!task.recurrence;
    const taskToAdd = { ...task, date: isRecurring ? undefined : task.date };
    setInventory(prev => ({ ...prev, [taskToAdd.type]: [...prev[taskToAdd.type], taskToAdd] }));
    handleSendMessage(`CRITICAL UPDATE: I've just manually added the task "${taskToAdd.title}" (${taskToAdd.type}, ${taskToAdd.duration}). Based on my existing anchors and the current time of ${getModeTime()}, what is the optimal placement for this? Use the propose_orchestration tool to update my schedule immediately.`, null);
  };

  const handleDeleteTask = (id: string) => setInventory(prev => ({ fixed: prev.fixed.filter(t => t.id !== id), flexible: prev.flexible.filter(t => t.id !== id) }));
  
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
    handleSendMessage(`RELATIONSHIP UPDATE: I've just added "${p.name}" (${p.relation}) to my Kinship Ledger. My goal is to maintain this connection. Please look at my current schedule for today and tomorrow and propose a specific time slot to reach out to them. Use propose_orchestration if you find a gap today.`, null);
  };

  const handleDeletePerson = (name: string) => setLedger(prev => { const newL = { ...prev }; const key = Object.keys(newL).find(k => (newL[k] as Person).name === name); if (key) delete newL[key]; return newL; });

  const acceptContact = (person: Person) => {
    handleAddPerson(person); // Add to ledger
    handleSendMessage(`Confirmed: Added ${person.name}.`, null); 
    updateCurrentDayMessages(prev => prev.map(msg => msg.contactProposals?.includes(person) ? { ...msg, contactProposals: undefined } : msg));
  };
  const rejectContact = (person: Person) => { 
      handleSendMessage(`Understood.`, null); 
      updateCurrentDayMessages(prev => prev.map(msg => msg.contactProposals?.includes(person) ? { ...msg, contactProposals: undefined } : msg)); 
  };
  
  const acceptProposal = (proposal: OrchestrationProposal) => {
    setInventory(prev => {
        const todayStr = toDateString(currentDate);
        const fixed = prev.fixed.filter(t => t.date !== todayStr);
        const flexible = prev.flexible.filter(t => t.date !== todayStr);
        const newFixed: Task[] = [];
        const newFlexible: Task[] = [];
        proposal.schedule.forEach(t => {
            const taskWithDate = { ...t, date: todayStr };
            if (t.type === 'fixed') newFixed.push(taskWithDate);
            else newFlexible.push(taskWithDate);
        });
        return { fixed: [...fixed, ...newFixed], flexible: [...flexible, ...newFlexible] };
    });
    handleSendMessage(`I accept the orchestration proposal for today. The timeline looks solid: \n\n${proposal.optimized_timeline}`, null);
    updateCurrentDayMessages(prev => prev.map(msg => msg.proposal === proposal ? { ...msg, proposal: undefined } : msg));
  };

  const handleExportToGoogle = async () => {
    if (mode === 'demo') {
        setSyncStatus('exporting');
        setTimeout(() => { setSyncStatus('idle'); setShowSyncInfo({ type: 'export', visible: true }); }, 1800);
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

  const handleImportSelected = (tasks: Task[]) => {
    setInventory(prev => {
        const existingGcalIds = new Set(prev.fixed.map(t => t.gcal_id).filter(id => !!id));
        const existingRecurringIds = new Set(prev.fixed.map(t => t.gcal_recurring_id).filter(id => !!id));
        const filteredNew = tasks.filter(t => !existingGcalIds.has(t.gcal_id) && !(t.gcal_recurring_id && existingRecurringIds.has(t.gcal_recurring_id)));
        return { ...prev, fixed: [...prev.fixed, ...filteredNew] };
    });
    setShowImportModal(false); setShowSyncInfo({ type: 'import', visible: true });
    if (tasks.length > 0) handleSendMessage(`I've just imported ${tasks.length} specific events from my Google Calendar. Please analyze these anchors and re-orchestrate if there are better ways to flow my days.`, null);
  };

  return (
    <div className="h-dvh w-full flex flex-col bg-slate-100 text-slate-800 font-sans overflow-hidden">
      {showTutorial && <TutorialOverlay isDemo={mode === 'demo'} onComplete={() => setShowTutorial(false)} onSkip={() => setShowTutorial(false)} />}
      {showImportModal && <CalendarImportModal initialDate={currentDate} onCancel={() => setShowImportModal(false)} onImport={handleImportSelected} fetchEvents={(start, end) => calendarService.listEvents(start, end)} />}
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
                 <span className="px-3 text-xs font-bold text-slate-700 min-w-[90px] text-center">{currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
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
                  <CareerInventoryView inventory={dailyInventory} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onAddTask={handleManualAddTask} />
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
                onAcceptProposal={acceptProposal} 
                onRejectProposal={() => {}} 
                onAcceptContact={acceptContact} 
                onRejectContact={rejectContact} 
                storageStats={storageStats}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
