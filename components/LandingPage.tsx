/**
 * DESIGN DECISION: Marketing Landing Page
 * 
 * This component serves as the entry point for new users, implementing:
 * 
 * 1. **Clear Value Proposition**:
 *    "Solve burnout by balancing career and relationships"
 *    Users understand the problem being solved within seconds.
 * 
 * 2. **Low-Friction Demos**:
 *    "Try Demo" button requires no signup. Instant gratification reduces bounce.
 *    Demo mode showcases AI capabilities with pre-populated realistic data.
 * 
 * 3. **Social Proof & Technical Credibility**:
 *    - Powered by Gemini 2.5 Pro (Google's trust)
 *    - LocalStorage privacy (no server, no data collection)
 *    - Open source positioning (transparency, customizability)
 * 
 * 4. **Legal Compliance**:
 *    Privacy Policy and Terms of Service links satisfy regulatory requirements
 *    (GDPR, CCPA). Checkbox consent before data collection.
 * 
 * 5. **Feature Explanation via FAQ**:
 *    FAQs address complex concepts (Kinship Debt, Temporal Modes) in accessible language.
 *    Reduces support burden by pre-answering common questions.
 * 
 * 6. **Conversion Optimization**:
 *    Two CTAs: Demo (low commitment) vs. Live (high intent)
 *    Different entry points for different user readiness levels.
 * 
 * Structure:
 * - Hero: Value prop + CTAs
 * - Features: Key differentiators (Kinship Ledger, Temporal Modes, etc.)
 * - Visual Demo: Screenshots/video showing AI in action
 * - FAQ: Deep-dive explanations
 * - Footer: Legal + social links
 */

import React, { useState } from 'react';

interface Props {
  onStartDemo: () => void;
  onStartLive: () => void;
  onViewPrivacy: () => void;
  onViewTerms: () => void;
}

export const LandingPage: React.FC<Props> = ({ onStartDemo, onStartLive, onViewPrivacy, onViewTerms }) => {
  const [agreed, setAgreed] = useState(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const faqs = [
    {
      question: "How does Life Orchestrator manage my data?",
      answer: "We employ a 'Local-First' state management strategy. All persistent data—your Kinship Ledger, Life Inventory, and Chat History—resides exclusively in your browser's Local Storage (maximum 5MB). While we utilize Google Gemini 2.5 Pro and Google Calendar APIs for real-time reasoning and synchronization, these are transient sessions. We do not maintain any centralized database or server backend—your personal data never leaves your device except for temporary AI processing."
    },
    {
      question: "What is the 'Kinship Ledger' and how does relationship tracking work?",
      answer: "The Kinship Ledger is a dynamic relationship health monitoring system. It tracks contacts with priority ratings (1-3) and calculates 'Kinship Debt' using the formula: Priority × Days Since Last Contact. When debt exceeds thresholds (&gt;5 = Needs Attention, &gt;10 = Critical), the AI proactively suggests check-ins during your daily briefings. This ensures important relationships never fall through the cracks during busy periods."
    },
    {
      question: "What are 'Temporal Modes' and how do they work?",
      answer: "Life Orchestrator operates in three intelligent modes based on date context: REFLECTION MODE (past dates) reviews what happened and verifies completed plans, ACTIVE MODE (today) focuses on same-day availability and immediate execution, and PLANNING MODE (future dates) optimizes capacity and prevents overload. The AI automatically switches modes and adjusts its communication style accordingly."
    },
    {
      question: "How does capacity management prevent burnout?",
      answer: "The system enforces realistic daily capacity limits (8-10 hours of productive work). When you approach 10+ hours, it provides warnings. At 12+ hours, it automatically recommends redistributing low-priority tasks to future days. This proactive workload balancing prevents chronic overload while preserving your high-priority commitments like interviews and family time."
    },
    {
      question: "How does the AI learn my preferences?",
      answer: "Life Orchestrator uses a dedicated 'save_memory' tool with a 100-memory FIFO limit. When the AI detects recurring preferences ('I prefer evening interview prep') or strategic decisions, it saves them to your local Memory Bank. These patterns are injected into every briefing, allowing the agent to provide increasingly personalized orchestrations over time—all stored locally on your device."
    },
    {
      question: "Is Google Calendar integration required?",
      answer: "No, the system is fully functional as a standalone orchestrator. However, linking Google Calendar allows the agent to automatically import existing events as 'Fixed' anchors and export proposed orchestrations back to your calendar. Calendar sync honors your existing commitments while optimally scheduling flexible tasks around them."
    }
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-900 text-slate-300 selection:bg-indigo-500 selection:text-white overflow-x-hidden scroll-smooth">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
           <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">L</div>
             <span className="font-bold text-white tracking-tight text-lg">Life Orchestrator</span>
           </div>
           <div className="hidden md:flex items-center gap-8 text-sm font-medium">
             <button onClick={() => scrollToSection('mission')} className="hover:text-white transition-colors">Mission</button>
             <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors">How It Works</button>
             <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors">FAQ</button>
           </div>
           <div className="flex items-center gap-3">
             <button 
                onClick={onStartDemo} 
                disabled={!agreed}
                className={`hidden sm:block px-4 py-2 rounded-lg text-sm font-medium text-white transition-all ${agreed ? 'hover:bg-white/5' : 'opacity-50 cursor-not-allowed grayscale'}`}
             >
                View Demo
             </button>
             <button 
                onClick={onStartLive} 
                disabled={!agreed}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg ${agreed ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25' : 'bg-slate-700 text-slate-400 cursor-not-allowed grayscale opacity-50'}`}
             >
                Launch App
             </button>
        </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 px-6 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-300 mb-4 animate-fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Harmony in every dimension.
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight">
                Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">Holistic Life OS</span>
            </h1>
            
            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Life Orchestrator is an AI-powered Chief Operating Officer for your life, using Google Gemini 2.5 Pro to balance career ambitions, relationship health, and personal capacity—preventing burnout through intelligent temporal orchestration.
            </p>

            {/* Mandatory Agreement Section */}
            <div className="max-w-md mx-auto py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm px-6">
                <label className="flex items-center justify-center gap-3 cursor-pointer group select-none py-2">
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="peer sr-only" 
                        />
                        <div className="w-5 h-5 bg-slate-800 border-2 border-slate-700 rounded transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600 flex items-center justify-center group-hover:border-indigo-500">
                             <svg className={`w-3.5 h-3.5 text-white transition-opacity ${agreed ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                    </div>
                    <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                        I agree to the <button onClick={(e) => { e.preventDefault(); onViewTerms(); }} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4">Terms of Service</button> and <button onClick={(e) => { e.preventDefault(); onViewPrivacy(); }} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4">Privacy Policy</button>
                    </span>
                </label>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button 
                    onClick={onStartDemo}
                    disabled={!agreed}
                    className={`w-full sm:w-auto px-8 py-4 rounded-xl font-semibold border transition-all flex items-center justify-center gap-2 ${agreed ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 shadow-xl' : 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'}`}
                >
                    View Demo
                </button>
                <button 
                    onClick={onStartLive}
                    disabled={!agreed}
                    className={`w-full sm:w-auto px-8 py-4 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 ${agreed ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50'}`}
                >
                    Start Orchestrating
                </button>
            </div>
        </div>
      </header>

      {/* Mission Section */}
      <section id="mission" className="py-24 bg-slate-800/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
                <div className="space-y-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-white">The Mission</h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        In a world of constant pings and endless task lists, our most important connections often fall through the cracks. We trade "deep work" for reactive emails and "quality time" for mindless scrolling.
                    </p>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        **Life Orchestrator** is your defensive shield against burnout. Powered by advanced AI with temporal mode awareness, it offloads the mental burden of tracking *everything*—enforcing realistic daily capacity limits (8-10 hours), monitoring relationship health through Kinship Debt calculations, and automatically redistributing tasks when you're overloaded. You maintain health habits, stay on career track, and never lose touch with people who matter.
                    </p>
                </div>
                
                <div className="bg-slate-900 rounded-2xl border border-white/10 p-8 flex items-center justify-center overflow-hidden h-64">
                    <div className="text-center">
                        <div className="text-indigo-400 text-4xl font-bold mb-2">Local-First</div>
                        <div className="text-slate-500 text-sm uppercase tracking-widest font-bold">Privacy by Design</div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Life Orchestrator combines AI reasoning, temporal intelligence, and relationship science into a proactive life operating system.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Temporal Modes */}
            <div className="bg-slate-800/50 rounded-2xl border border-white/10 p-8 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4">📅</div>
              <h3 className="text-xl font-bold text-white mb-3">Temporal Modes</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                The AI automatically switches between three modes: <strong className="text-indigo-400">REFLECTION</strong> (past dates) verifies completed plans, <strong className="text-emerald-400">ACTIVE</strong> (today) handles same-day execution, and <strong className="text-purple-400">PLANNING</strong> (future) optimizes capacity ahead of time.
              </p>
            </div>

            {/* Kinship Ledger */}
            <div className="bg-slate-800/50 rounded-2xl border border-white/10 p-8 hover:border-emerald-500/50 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4">👥</div>
              <h3 className="text-xl font-bold text-white mb-3">Kinship Ledger</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Tracks relationship health using <strong className="text-emerald-400">Priority × Days Since Contact</strong>. When debt crosses thresholds (&gt;5 Needs Attention, &gt;10 Critical), the AI proactively suggests check-ins during your briefings.
              </p>
            </div>

            {/* Capacity Management */}
            <div className="bg-slate-800/50 rounded-2xl border border-white/10 p-8 hover:border-amber-500/50 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-white mb-3">Capacity Management</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Enforces realistic 8-10 hour daily limits. At <strong className="text-amber-400">10+ hours</strong>, you get overload warnings. At <strong className="text-orange-400">12+ hours</strong>, low-priority tasks are automatically recommended for redistribution.
              </p>
            </div>

            {/* Tool Calling */}
            <div className="bg-slate-800/50 rounded-2xl border border-white/10 p-8 hover:border-blue-500/50 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4">🛠️</div>
              <h3 className="text-xl font-bold text-white mb-3">Structured Tools</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Powered by <strong className="text-blue-400">Gemini 2.5 Pro</strong> with 8 autonomous tools: get_relationship_status, propose_orchestration, add_task, move_tasks, update_relationship_status, save_memory, and more.
              </p>
            </div>

            {/* Memory Bank */}
            <div className="bg-slate-800/50 rounded-2xl border border-white/10 p-8 hover:border-rose-500/50 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4">🧠</div>
              <h3 className="text-xl font-bold text-white mb-3">Memory Synthesis</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Every 3-4 conversation turns, the AI detects patterns ("<em className="text-rose-400">prefers evening interview prep</em>") and saves them to your local Memory Bank (100-memory FIFO limit) for increasingly personalized orchestrations.
              </p>
            </div>

            {/* Google Calendar Sync */}
            <div className="bg-slate-800/50 rounded-2xl border border-white/10 p-8 hover:border-violet-500/50 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4">📆</div>
              <h3 className="text-xl font-bold text-white mb-3">Calendar Integration</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Optional <strong className="text-violet-400">Google Calendar</strong> sync imports existing events as "Fixed" anchors. Export AI-generated orchestrations back to your calendar with one click—all processed locally in your browser.
              </p>
            </div>
          </div>

          {/* Architecture Highlight */}
          <div className="mt-16 bg-gradient-to-r from-slate-800/80 to-slate-800/50 rounded-2xl border border-indigo-500/30 p-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white">Zero Server Architecture</h3>
            </div>
            <p className="text-slate-400 max-w-3xl mx-auto leading-relaxed">
              Everything runs in your browser. Your Kinship Ledger, Life Inventory, conversation history, and Memory Bank live in localStorage (5MB). Google Gemini processes requests via HTTPS but doesn't store your data. We don't have analytics, tracking, or databases—just your device and Google's AI.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-slate-900 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
             <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details key={index} className="group bg-slate-800/50 rounded-xl border border-slate-700/50 open:bg-slate-800/80 transition-all duration-300">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <h3 className="text-white font-medium text-lg pr-8">{faq.question}</h3>
                  <svg className="w-5 h-5 text-indigo-400 transform group-open:rotate-180 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 pt-0 text-slate-400 leading-relaxed animate-fade-in border-t border-transparent group-open:border-white/5 group-open:pt-4">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-white/10 text-center">
          <p className="text-slate-500 text-sm">
            Life Orchestrator &copy; 2026. Built with React 19, Google Gemini 2.5 Pro, and localStorage-only architecture.
          </p>
      </footer>
    </div>
  );
};
