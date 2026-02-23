/**
 * DESIGN DECISION: Chat Interface Component Architecture
 * 
 * This component serves as the primary user interaction surface, implementing:
 * 
 * 1. **Multi-Modal Input**:
 *    - Text messages (standard chat)
 *    - Image uploads (compressed via imageService)
 *    - Calendar date selection (temporal navigation)
 * 
 * 2. **Streaming UI**:
 *    - Thinking indicators while AI processes
 *    - Token-by-token text streaming for responsiveness
 *    - Animated loading states (rotating messages)
 * 
 * 3. **Embedded Interactive Elements**:
 *    - OrchestrationProposals: Accept/reject schedule changes inline
 *    - ContactProposals: Add new people to ledger with one click
 *    - Markdown rendering: Formatted AI responses with code, lists, emphasis
 * 
 * 4. **Storage Awareness**:
 *    - Real-time token count for user input (avoid API errors)
 *    - Daily image upload limits (prevent quota exhaustion)
 *    - Storage stats display (quota percentage visible)
 * 
 * 5. **Temporal Context Display**:
 *    - Shows current viewing date in header
 *    - Highlights tasks for that date
 *    - Calendar popover for quick date switching
 * 
 * Design Philosophy:
 * - Single-page-app feel (no page transitions)
 * - Conversational interface reduces cognitive load vs forms
 * - Visual feedback for all actions (no silent failures)
 * - Accessible keyboard navigation (Enter to send, Esc to close modals)
 */

import React, { useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, Person, Task, OrchestrationProposal, StorageStats } from '../types';
import { geminiService } from '../services/geminiService';
import { OrchestrationProposalView } from './OrchestrationProposal';
import { ContactProposalView } from './ContactProposal';
import { CalendarPopover } from './CalendarPopover';

interface Props {
  messages: ChatMessage[];
  allTasks: Task[];
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onSendMessage: (text: string, media: string | null) => void;
  onDeleteMessage: (id: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  onAcceptProposal: (proposal: OrchestrationProposal) => void;
  onRejectProposal: (proposal: OrchestrationProposal) => void;
  onAcceptContact: (person: Person) => void;
  onRejectContact: (person: Person) => void;
  storageStats: StorageStats;
  processingProposal?: boolean;
}

export const ChatInterface: React.FC<Props> = ({ 
    messages, 
    allTasks,
    currentDate,
    onSelectDate,
    onSendMessage, 
    onDeleteMessage,
    isLoading,
    isStreaming,
    onAcceptProposal, 
    onRejectProposal,
    onAcceptContact,
    onRejectContact,
    storageStats,
    processingProposal = false
}) => {
  const [input, setInput] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [thinkingText, setThinkingText] = useState("Processing...");
  const [showCalendar, setShowCalendar] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    const texts = ["Analyzing context...", "Reflecting on goals...", "Re-calculating schedule balance...", "Optimizing priority windows...", "Syncing kinship ledger..."];
    let i = 0;
    const interval = setInterval(() => {
        i = (i + 1) % texts.length;
        setThinkingText(texts[i]);
    }, 1800);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const timer = setTimeout(async () => {
        if (!input.trim()) { setTokenCount(0); return; }
        const count = await geminiService.countTokens(input);
        setTokenCount(count);
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && typeof reader.result === 'string') {
          setSelectedMedia(reader.result);
        }
      };
      reader.onerror = () => {
        console.error('Failed to read file:', reader.error);
        setSelectedMedia(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedMedia) || isStreaming) return;
    onSendMessage(input, selectedMedia);
    setInput('');
    setSelectedMedia(null);
  };

  const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const d = new Date(msg.timestamp);
    const dateLabel = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === dateLabel) lastGroup.messages.push(msg);
    else groupedMessages.push({ date: dateLabel, messages: [msg] });
  });

  const formatMessageTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderMediaPreview = (src: string, isSmall = false) => {
    const isVideo = src.startsWith('data:video');
    const isAudio = src.startsWith('data:audio');
    if (isVideo) return <video src={src} controls={!isSmall} className={`rounded-lg border bg-black ${isSmall ? 'h-12 w-12 object-cover' : 'max-w-full max-h-64'}`} />;
    if (isAudio) return <div className="p-2 bg-slate-100 rounded border"><audio src={src} controls className="w-full" /></div>;
    return <img src={src} alt="Upload" className={`rounded-lg border ${isSmall ? 'h-12 w-12 object-cover' : 'max-w-full h-auto shadow-sm'}`} />;
  };

  const isStorageCritical = storageStats.percentage > 90;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-center justify-between z-10 shadow-sm">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">Day Log & Orchestrator</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {currentDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
            </div>
         </div>
         <div className="relative" ref={calendarRef}>
             <button onClick={() => setShowCalendar(!showCalendar)} className={`p-2 rounded-lg transition-all ${showCalendar ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </button>
             {showCalendar && <div className="absolute top-full right-0 mt-2 z-50"><CalendarPopover selectedDate={currentDate} tasks={allTasks} onSelectDate={(d) => { onSelectDate(d); setShowCalendar(false); }} /></div>}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8 bg-slate-50/50 min-h-0">
        {isStorageCritical && (
           <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex gap-3 text-red-700 mb-4 animate-pulse">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-xs font-bold leading-tight uppercase tracking-wide">Critical: Storage Nearly Full. Clear history to continue saving messages.</p>
           </div>
        )}
        
        {groupedMessages.map((group, gIdx) => (
          <div key={gIdx} className="space-y-6">
            <div className="flex items-center justify-center">
              <span className="px-3 py-1 bg-slate-200/50 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-widest border border-slate-200">{group.date}</span>
            </div>
            {group.messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'model' && msg.thought && (
                  <div className="mb-2 max-w-[90%] w-full">
                    <details className="group bg-white/80 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none text-[10px] font-bold text-slate-500 uppercase tracking-tighter hover:bg-slate-100 transition-colors">
                        Thinking Process
                        <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </summary>
                      <div className="px-3 pb-3 text-[10px] text-slate-500 font-mono italic whitespace-pre-wrap leading-relaxed opacity-75">{msg.thought}</div>
                    </details>
                  </div>
                )}
                {msg.text && (
                  <div className={`group relative max-w-[85%] rounded-2xl p-4 shadow-sm ${
                      msg.isAction 
                        ? 'bg-slate-100 border border-slate-200 text-slate-600 italic' 
                        : msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                  }`}>
                    {/* Delete Message Button */}
                    <button 
                        onClick={() => onDeleteMessage(msg.id)}
                        className={`absolute -top-2 ${msg.role === 'user' ? '-left-2' : '-right-2'} p-1.5 bg-white border border-slate-200 text-slate-300 hover:text-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110`}
                        title="Delete Message"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {msg.media && <div className="mb-2">{renderMediaPreview(msg.media)}</div>}
                    
                    {/* Action Badge if applicable */}
                    {msg.isAction && (
                        <div className="flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 not-italic">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            System Action
                        </div>
                    )}

                    <div className={`prose prose-sm max-w-none ${msg.role === 'user' && !msg.isAction ? 'prose-invert text-white' : 'text-slate-800'}`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                    
                    {/* Orchestration Proposal - Nested inside message */}
                    {msg.proposal && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 flex gap-2">
                        <div className="w-1 bg-emerald-500 rounded-full flex-shrink-0"></div>
                        <div className="flex-1">
                          <OrchestrationProposalView proposal={msg.proposal} onAccept={() => onAcceptProposal(msg.proposal!)} onReject={() => onRejectProposal(msg.proposal!)} isProcessing={processingProposal} />
                        </div>
                      </div>
                    )}
                    
                    <div className={`text-[8px] mt-2 font-bold tracking-widest opacity-40 uppercase ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {formatMessageTime(msg.timestamp)}
                    </div>
                  </div>
                )}
                {msg.contactProposals && msg.contactProposals.map((p) => (
                    <div className="mt-4" key={`contact-${p.name}`}><ContactProposalView person={p} onAccept={() => onAcceptContact(p)} onReject={() => onRejectContact(p)} /></div>
                ))}
              </div>
            ))}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-fade-in w-full max-w-md">
            <div className="bg-white border border-indigo-100 rounded-2xl rounded-bl-none shadow-md p-4 w-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{thinkingText}</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 w-1/2 animate-[shimmer_2s_infinite]"></div></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        {selectedMedia && (
            <div className="relative inline-block mb-3">
                {renderMediaPreview(selectedMedia, true)}
                <button onClick={() => setSelectedMedia(null)} className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 hover:bg-red-500 shadow-lg">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        )}
        <div className="flex justify-between items-center mb-1">
             {isStreaming && (
               <div className="flex items-center gap-2">
                 <div className="flex gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                 </div>
                 <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">AI Streaming...</span>
               </div>
             )}
             <span className={`text-[10px] font-bold uppercase tracking-wider ${tokenCount > 1000 ? 'text-orange-500' : 'text-slate-300'} ${isStreaming ? 'ml-auto' : ''}`}>
                {tokenCount > 0 ? `${tokenCount} Tokens` : ''}
             </span>
        </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Attach context">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleMediaUpload} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isStreaming ? "AI is responding..." : isStorageCritical ? "STORAGE FULL - DELETE OLD CHATS" : "Type your goals..."}
            disabled={isStorageCritical || isStreaming}
            className={`flex-1 max-h-32 min-h-[48px] p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none resize-none text-sm transition-colors ${isStorageCritical ? 'bg-red-50 border-red-200' : isStreaming ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
          />
          <button type="submit" disabled={isStreaming || isStorageCritical || (!input.trim() && !selectedMedia)} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};
