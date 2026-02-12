
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
      answer: "We employ a 'Local-First' state management strategy. All persistent data—your Kinship Ledger, Life Inventory, and Chat History—resides exclusively in your browser's Local Storage. While we utilize Google Gemini 3 and Google Calendar APIs for real-time reasoning and synchronization, these are transient sessions. We do not maintain any centralized database of your personal life data."
    },
    {
      question: "What is the 'Kinship Ledger'?",
      answer: "Unlike a static address book, the Kinship Ledger is a dynamic status engine. It monitors relationship 'health' (Stable, Overdue, Critical) based on priority and contact frequency. The AI proactively monitors these states to suggest social check-ins whenever it identifies gaps in your professional schedule."
    },
    {
      question: "Hard Anchors vs. Flexible Flow?",
      answer: "Our orchestration engine distinguishes between 'Fixed' tasks (Hard Anchors like meetings or travel) and 'Flexible' tasks (Soft Flow like gym, deep work, or admin). The AI mathematically optimizes your day by slotting flexible blocks into the most appropriate energy windows around your fixed commitments."
    },
    {
      question: "How does the 'Memory Bank' work?",
      answer: "Life Orchestrator uses a dedicated 'save_memory' tool. When the AI identifies a recurring preference ('I prefer mornings for deep work') or a strategic decision, it persists this to a local Long-Term Memory bank. This context is injected into every future session, allowing the agent to grow more attuned to your personal life strategy over time."
    },
    {
      question: "Is Google Calendar integration required?",
      answer: "No, the system is fully functional as a standalone orchestrator. However, linking Google Calendar allows the agent to automatically respect professional anchors and export its proposed daily 'Orchestrations' back to your external devices with a single click."
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
                Life Orchestrator is a world-class autonomous agent designed to solve the modern crisis of burnout by harmonizing career goals with relationship health.
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
                        **Life Orchestrator** is your defensive shield against burnout. It offloads the mental burden of tracking *everything*, ensuring you maintain your health habits, keep your career on track, and never lose touch with the people who matter most.
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
            Life Orchestrator &copy; 2026. Built with Google Gemini 3.
          </p>
      </footer>
    </div>
  );
};
