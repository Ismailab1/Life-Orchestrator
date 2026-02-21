
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
import { Toast, useToast } from './components/Toast';

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
  const toast = useToast();
  // Determine initial state based on tutorial completion
  const isFirstRun = !localStorage.getItem('life_tutorial_completed');

  const calendarService = useMemo(() => new GoogleCalendarService(GOOGLE_CLIENT_ID), []);
  
  const [inventory, setInventory] = useState<LifeInventory>(() => {
    // In demo mode, always load demo data and ignore localStorage
    if (mode === 'demo') {
        const today = new Date();
        const getDate = (offset: number) => {
            const d = new Date(today);
            d.setDate(d.getDate() + offset);
            return toDateString(d);
        };
        
        // Create dates for the full week (3 days ago to 3 days from now)
        const day_m3 = getDate(-3); // Monday (3 days ago)
        const day_m2 = getDate(-2); // Tuesday (2 days ago)
        const day_m1 = getDate(-1); // Wednesday (yesterday)
        const day_0 = getDate(0);   // Thursday (today)
        const day_p1 = getDate(1);  // Friday (tomorrow)
        const day_p2 = getDate(2);  // Saturday (day after tomorrow)
        const day_p3 = getDate(3);  // Sunday
        
        return {
            fixed: [
                // Monday - 3 days ago (REFLECTION - Completed)
                { id: 'w1_1', title: '✓ Team Standup (Engineering)', type: 'fixed', time: '9:30 AM', duration: '30m', priority: 'medium', category: 'Career', date: day_m3 },
                { id: 'w1_2', title: '✓ Sprint Planning Meeting', type: 'fixed', time: '2:00 PM', duration: '1.5h', priority: 'high', category: 'Career', date: day_m3 },
                
                // Tuesday - 2 days ago (REFLECTION - Completed)
                { id: 'w2_1', title: '✓ Call with Grandpa', type: 'fixed', time: '10:00 AM', duration: '30m', priority: 'high', category: 'Family', date: day_m2 },
                { id: 'w2_2', title: '✓ Product Demo Rehearsal', type: 'fixed', time: '3:00 PM', duration: '1h', priority: 'medium', category: 'Career', date: day_m2 },
                
                // Wednesday - Yesterday (REFLECTION - Completed)
                { id: 'w3_1', title: '✓ Strategy Review w/ Board', type: 'fixed', time: '11:00 AM', duration: '2h', priority: 'high', category: 'Career', date: day_m1 },
                { id: 'w3_2', title: '✓ Dinner with Mom', type: 'fixed', time: '6:30 PM', duration: '2h', priority: 'high', category: 'Family', date: day_m1 },
                
                // Thursday - Today (ACTIVE)
                { id: 'w4_1', title: 'Grandma Physical Therapy', type: 'fixed', time: '10:00 AM', duration: '1h', priority: 'high', category: 'Family', date: day_0 },
                { id: 'w4_2', title: 'Interview with Capital One', type: 'fixed', time: '2:00 PM', duration: '1h', priority: 'high', category: 'Career', date: day_0 },
                
                // Friday - Tomorrow (PLANNING - Tentative)
                { id: 'w5_1', title: '[PLANNED] Project Launch: Phase 1', type: 'fixed', time: '9:00 AM', duration: '3h', priority: 'high', category: 'Career', date: day_p1 },
                { id: 'w5_2', title: '[PLANNED] Team Retrospective', type: 'fixed', time: '4:00 PM', duration: '1h', priority: 'medium', category: 'Career', date: day_p1 },
                
                // Saturday - Day after tomorrow (PLANNING - Tentative)
                { id: 'w6_1', title: '[PLANNED] Hiking with Alex @ Redwood Trail', type: 'fixed', time: '8:00 AM', duration: '3h', priority: 'medium', category: 'Life', date: day_p2 },
                
                // Sunday (PLANNING - Tentative)
                { id: 'w7_1', title: '[PLANNED] Family Brunch', type: 'fixed', time: '11:00 AM', duration: '2h', priority: 'high', category: 'Family', date: day_p3 }
            ],
            flexible: [
                // Monday - 3 days ago (REFLECTION - Completed)
                { id: 'wf1_1', title: '✓ Morning Gym Session', type: 'flexible', duration: '1h', priority: 'medium', category: 'Health', date: day_m3 },
                { id: 'wf1_2', title: '✓ Code Review: Auth Module', type: 'flexible', duration: '1h', priority: 'medium', category: 'Career', date: day_m3 },
                
                // Tuesday - 2 days ago (REFLECTION - Completed)
                { id: 'wf2_1', title: '✓ Yoga Class', type: 'flexible', duration: '45m', priority: 'medium', category: 'Health', date: day_m2 },
                { id: 'wf2_2', title: '✓ Email Triage & Admin', type: 'flexible', duration: '45m', priority: 'low', category: 'Career', date: day_m2 },
                
                // Wednesday - Yesterday (REFLECTION - Completed)
                { id: 'wf3_1', title: '✓ Quick 5k Run', type: 'flexible', duration: '30m', priority: 'medium', category: 'Health', date: day_m1 },
                { id: 'wf3_2', title: '✓ Prep for Capital One Interview', type: 'flexible', duration: '1.5h', priority: 'high', category: 'Career', date: day_m1 },
                
                // Thursday - Today (ACTIVE)
                { id: 'wf4_1', title: 'Python Debugging Practice', type: 'flexible', duration: '2h', priority: 'medium', category: 'Career', date: day_0 },
                { id: 'wf4_2', title: 'Gym / Cardio', type: 'flexible', duration: '1h', priority: 'medium', category: 'Health', date: day_0 },
                
                // Friday - Tomorrow (PLANNING - To Be Scheduled)
                { id: 'wf5_1', title: 'Grocery Run (Meal Prep)', type: 'flexible', duration: '1h', priority: 'low', category: 'Life', date: day_p1 },
                { id: 'wf5_2', title: 'Documentation Write-up', type: 'flexible', duration: '1.5h', priority: 'low', category: 'Career', date: day_p1 },
                
                // Saturday - Day after tomorrow (PLANNING - To Be Scheduled)
                { id: 'wf6_1', title: 'Apartment Deep Clean', type: 'flexible', duration: '2h', priority: 'low', category: 'Life', date: day_p2 },
                { id: 'wf6_2', title: 'Read: "Range" by David Epstein', type: 'flexible', duration: '1h', priority: 'low', category: 'Life', date: day_p2 },
                
                // Sunday (PLANNING - To Be Scheduled)
                { id: 'wf7_1', title: 'Meal Prep for Next Week', type: 'flexible', duration: '2h', priority: 'medium', category: 'Health', date: day_p3 },
                { id: 'wf7_2', title: 'Review Weekly Goals', type: 'flexible', duration: '30m', priority: 'medium', category: 'Career', date: day_p3 }
            ]
        };
    }
    
    // In live mode, load from localStorage or return empty
    const saved = localStorage.getItem('life_inventory');
    if (saved) return JSON.parse(saved);
    return EMPTY_INVENTORY;
  });

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
          
          // Create dates for the full week
          const day_m3 = getDate(-3); // Monday
          const day_m2 = getDate(-2); // Tuesday
          const day_m1 = getDate(-1); // Wednesday
          const day_0 = getDate(0);   // Thursday (today)
          const day_p1 = getDate(1);  // Friday
          const day_p2 = getDate(2);  // Saturday
          const day_p3 = getDate(3);  // Sunday
          
          const day_m3_key = toDateString(day_m3);
          const day_m2_key = toDateString(day_m2);
          const day_m1_key = toDateString(day_m1);
          const day_0_key = toDateString(day_0);
          const day_p1_key = toDateString(day_p1);
          const day_p2_key = toDateString(day_p2);
          const day_p3_key = toDateString(day_p3);
          
          return {
              // Monday - 3 days ago (REFLECTION)
              [day_m3_key]: [
                  { id: 'm3_1', role: 'model', timestamp: createIso(day_m3, 8, 0), text: "📅 REFLECTION: Monday - Good morning! Starting the week strong. You have Team Standup at 9:30 AM and Sprint Planning at 2:00 PM. I've scheduled your gym session for 7:00 AM and code review after standup." },
                  { id: 'm3_2', role: 'user', timestamp: createIso(day_m3, 15, 45), text: "Sprint planning went great! We're launching Phase 1 on Friday. Can you help me prepare?" },
                  { id: 'm3_3', role: 'model', timestamp: createIso(day_m3, 15, 46), thought: "Major launch Friday. Need to block focus time and ensure family obligations are met before big push.", text: "Excellent news! I've noted Friday 9-12 PM for the launch. I'll make sure your family commitments are honored this week—Grandpa needs his call Tuesday, and Grandma has PT Thursday." }
              ],
              
              // Tuesday - 2 days ago (REFLECTION)
              [day_m2_key]: [
                  { id: 'm2_1', role: 'model', timestamp: createIso(day_m2, 8, 30), text: "📅 REFLECTION: Tuesday - Morning briefing: Call with Grandpa at 10:00 AM (he's best in mornings), Product Demo Rehearsal at 3:00 PM. I've slotted yoga at 12:30 PM to keep you sharp." },
                  { id: 'm2_2', role: 'user', timestamp: createIso(day_m2, 10, 35), text: "Grandpa seemed a bit confused today, but overall okay. Need to check in more often." },
                  { id: 'm2_3', role: 'model', timestamp: createIso(day_m2, 10, 36), thought: "Grandpa showing confusion symptoms. Updating ledger to 'Needs Attention' and will prioritize regular check-ins.", text: "I've updated Grandpa's status. I'll remind you to call him every 2-3 days during morning windows. Your care for him is crucial." },
                  { id: 'm2_4', role: 'user', timestamp: createIso(day_m2, 16, 20), text: "Demo rehearsal was solid. Feeling prepared for Friday! 💪" },
                  { id: 'm2_5', role: 'model', timestamp: createIso(day_m2, 16, 21), text: "That's the energy we need! Three more days to the launch. Tomorrow you have a Strategy Review with the board—I'll make sure you're ready." }
              ],
              
              // Wednesday - Yesterday (REFLECTION)
              [day_m1_key]: [
                  { id: 'm1_1', role: 'model', timestamp: createIso(day_m1, 8, 30), text: "📅 REFLECTION: Yesterday - Big day ahead. Strategy Review at 11:00 AM and Dinner with Mom at 6:30 PM. I've moved your 5k run to 4:00 PM to decompress between work and family time." },
                  { id: 'm1_2', role: 'user', timestamp: createIso(day_m1, 13, 15), text: "Board meeting went exceptionally well! They loved the roadmap. Feeling pumped for Friday's launch." },
                  { id: 'm1_3', role: 'model', timestamp: createIso(day_m1, 13, 16), thought: "User is on a roll. High confidence going into launch. Maintaining work-life balance will be key.", text: "Outstanding! This momentum is exactly what you need. Make sure to enjoy tonight's dinner with your mom—celebrate these wins with the people who matter." },
                  { id: 'm1_4', role: 'user', timestamp: createIso(day_m1, 18, 45), text: "Dinner with Mom was great! She seems much more energetic today.", media: 'https://picsum.photos/id/1062/400/300' },
                  { id: 'm1_5', role: 'model', timestamp: createIso(day_m1, 18, 46), thought: "Analyzing photo... Grandma looks mobile. Updating ledger status to Stable.", text: "That's wonderful to hear! She looks great in the photo. I've updated Grandma's status to 'Stable'. Tomorrow's PT session at 10 AM will keep her on track." },
                  { id: 'm1_6', role: 'user', timestamp: createIso(day_m1, 21, 0), text: "Quick reminder: I have that Capital One interview tomorrow at 2 PM. Want to make sure I'm prepped." },
                  { id: 'm1_7', role: 'model', timestamp: createIso(day_m1, 21, 1), thought: "Interview tomorrow! Already on schedule but user wants reassurance and prep time.", text: "Already on it! You have 1.5 hours blocked for interview prep tonight. I'll keep your morning clear after Grandma's PT so you can review notes. You're going to crush it." }
              ],
              
              // Thursday - Today (ACTIVE)
              [day_0_key]: [
                  { id: 'm0_1', role: 'model', timestamp: createIso(day_0, 8, 15), text: "📍 TODAY: Morning! Big day—Grandma's PT at 10:00 AM and Capital One Interview at 2:00 PM. I suggest Python practice right after lunch to warm up your technical thinking before the interview." },
                  { id: 'm0_2', role: 'user', timestamp: createIso(day_0, 9, 30), text: "The interview got moved to 3:30 PM. Can you re-orchestrate?" },
                  { id: 'm0_3', role: 'model', timestamp: createIso(day_0, 9, 31), thought: "Interview time shifted. Need to optimize the flow—move gym earlier to capitalize on new gap and ensure user doesn't skip health goals.", text: "No problem! I've shifted things around. Here's the new flow:", proposal: {
                      optimized_timeline: "10:00 AM - Grandma PT\n12:00 PM - Lunch & Quick Break\n1:00 PM - Gym (Moved Up)\n2:30 PM - Python Practice (Interview Warm-up)\n3:30 PM - Capital One Interview",
                      reasoning: "Moving the gym session earlier takes advantage of the new gap before your interview. This ensures you don't skip your health goals and gives you a focused Python session right before the interview to get your mind in technical mode. The gym session will also reduce any nervous energy.",
                      schedule: [
                        { id: 'w4_1', title: 'Grandma Physical Therapy', type: 'fixed', time: '10:00 AM', duration: '1h', priority: 'high', category: 'Family' },
                        { id: 'wf4_2', title: 'Gym / Cardio', type: 'fixed', time: '1:00 PM', duration: '1h', priority: 'medium', category: 'Health' },
                        { id: 'wf4_1', title: 'Python Debugging Practice', type: 'fixed', time: '2:30 PM', duration: '1h', priority: 'medium', category: 'Career' },
                        { id: 'w4_2', title: 'Interview with Capital One', type: 'fixed', time: '3:30 PM', duration: '1h', priority: 'high', category: 'Career' }
                      ]
                  }}
              ],
              
              // Friday - Tomorrow (PLANNING)
              [day_p1_key]: [
                  { id: 'p1_1', role: 'model', timestamp: createIso(day_p1, 7, 0), text: "🗓️ PLANNING: Tomorrow - Major launch day! I've blocked 9 AM-12 PM for Project Launch: Phase 1. This is the culmination of the week's prep. Team Retrospective at 4 PM will give you time to celebrate and decompress. Would you like me to adjust anything before tomorrow?" }
              ],
              
              // Saturday - Day after tomorrow (PLANNING)
              [day_p2_key]: [
                  { id: 'p2_1', role: 'model', timestamp: createIso(day_p2, 7, 0), text: "🗓️ PLANNING: Saturday - Weekend recovery time! I've tentatively scheduled hiking with Alex at Redwood Trail at 8 AM—it's been 2+ weeks since you connected, and this is perfect post-launch recovery. Afternoon is open for deep cleaning, reading, or pure relaxation. Flex the plan as needed!" }
              ],
              
              // Sunday (PLANNING)
              [day_p3_key]: [
                  { id: 'p3_1', role: 'model', timestamp: createIso(day_p3, 9, 0), text: "🗓️ PLANNING: Sunday - Wrapping up the victory week! Family Brunch at 11 AM (tentative) will close out your family connection goals. I'm planning to schedule meal prep for the afternoon so you walk into next Monday fully prepared. Weekly goal review (30 min) will help set intentions for the next sprint." }
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

  useEffect(() => {
         // In demo mode, do NOT save to localStorage to avoid polluting live data
         if (mode === 'demo') return;
         
         localStorage.setItem('life_ledger', JSON.stringify(ledger)); 
         localStorage.setItem('life_inventory', JSON.stringify(inventory)); 
         localStorage.setItem('life_messages', JSON.stringify(allMessages));
         localStorage.setItem('life_memories', JSON.stringify(memories));
         localStorage.setItem('life_last_active', Date.now().toString()); // update active time
         
        // safe update of stats
        storageService.getStats().then(stats => setStorageStats(stats)).catch(e => console.error("Stats error", e));

  }, [ledger, inventory, memories, allMessages, mode]);
  
  // Clean up any potential hydration mismatches
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('life_tutorial_completed'));
  const pendingProposalRef = useRef<OrchestrationProposal | null>(null);
  const pendingContactRef = useRef<Person | null>(null);
  const initializedDateRef = useRef<string>('');
  const justCompletedTutorialRef = useRef(false);

  const dailyInventory = useMemo(() => getTasksForDate(inventory, toDateString(currentDate)), [inventory, currentDate]);
  const messages = useMemo(() => allMessages[toDateString(currentDate)] || [], [allMessages, currentDate]);

  const handleDateChange = (date: Date) => setCurrentDate(date);

  const handleSendMessage = async (text: string, media: string | null, isHidden: boolean = false) => {
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
    } catch (error: any) { 
        console.error("SendMessage Error:", error);
        alert(`Failed to send message: ${error.message || "Unknown error"}`);
    } finally { setIsLoading(false); }
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

  const handleClearAllHistory = async () => {
      if (confirm("Are you sure? This will wipe ALL data, including the inventory, ledger, memories, and chat history. The app will reset to a fresh install state.")) {
          await storageService.clearAll();
          localStorage.clear();
          window.location.reload();
      }
  };

  const executors = {
    getRelationshipStatus: async () => ledgerRef.current,
    getLifeContext: async (args?: { date?: string }) => getTasksForDate(inventoryRef.current, args?.date || toDateString(currentDate)),
    proposeOrchestration: async (newProposal: OrchestrationProposal) => {
      // Tool permission validation: prevent orchestrating past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const viewDate = new Date(currentDate);
      viewDate.setHours(0, 0, 0, 0);
      
      if (viewDate < today) {
        return "❌ Cannot orchestrate past dates. Past dates are for reflection only. Please navigate to today or a future date to create new orchestrations.";
      }
      
      pendingProposalRef.current = newProposal;
      return "Proposal generated.";
    },
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const viewDate = new Date(currentDate);
        viewDate.setHours(0, 0, 0, 0);
        
        // Temporal mode validation: Block fixed tasks with time slots on past dates
        if (viewDate < today && task.type === 'fixed' && task.time) {
          return "❌ Cannot schedule fixed tasks with specific times on past dates. Past dates are for reflection only. For historical records, use flexible tasks without times, or navigate to today/future to schedule new tasks.";
        }
        
        const newTask: Task = { 
            ...task, 
            id: Math.random().toString(36).substr(2, 9), 
            date: isRecurring ? undefined : (task.date || toDateString(currentDate)) 
        };
        setInventory(prev => {
            const listKey = newTask.type === 'fixed' ? 'fixed' : 'flexible';
            return { ...prev, [listKey]: [...prev[listKey], newTask] };
        });
        
        // Provide context about where the task was added
        if (viewDate < today) {
          return `Added "${newTask.title}" to ${toDateString(currentDate)} as a historical record (reflection mode).`;
        } else if (viewDate > today) {
          return `Added "${newTask.title}" to future date ${toDateString(currentDate)} (planning mode).`;
        } else {
          return `Added task "${newTask.title}" to today's schedule.`;
        }
    },
    deleteTask: async (title: string) => {
        const normalize = (s: string) => s.toLowerCase().trim();
        const target = normalize(title);
        let deleted = false;
        let deletedTaskName = '';
        
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
            setInventory({ fixed: newFixed, flexible: newFlexible });
            return `Moved ${movedCount} tasks to ${targetDate}: ${movedNames.join(', ')}.`;
        }
        return "No tasks found to move.";
    }
  };

  useEffect(() => {
    const dateKey = toDateString(currentDate);
    if (initializedDateRef.current === dateKey) return;
    
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
            ? `${temporalContext} ${currentDate.toLocaleDateString()}. Compare with ${yesterdayStr}. IMPORTANT: Explicitly mention that you are assuming the context of 9:00 AM on this specific date for the simulation.`
            : `${temporalContext} ${currentDate.toLocaleDateString()}. Compare with ${yesterdayStr}.`;

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
  }, [currentDate, showTutorial]);

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
      
      geminiService.startNewSession(`
Session Context:
Target Date: ${currentDate.toLocaleDateString()}
Current Session Time: ${getModeTime()}
Is Future Date: ${currentDate > new Date()}
User Mode: ${mode}
User Timezone: ${timezone}
${memoryContext}`);
  };

  return (
    <div className="h-dvh w-full flex flex-col bg-slate-100 text-slate-800 font-sans overflow-hidden">
      <Toast toasts={toast.toasts} onRemove={toast.removeToast} />
      {showTutorial && <TutorialOverlay isDemo={mode === 'demo'} onComplete={handleTutorialComplete} onSkip={handleTutorialSkip} />}
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
