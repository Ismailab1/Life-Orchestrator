
import React, { useEffect } from 'react';

interface Props {
  type: 'privacy' | 'terms';
  onBack: () => void;
}

export const LegalView: React.FC<Props> = ({ type, onBack }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const isPrivacy = type === 'privacy';

  return (
    <div className="fixed inset-0 bg-slate-900 text-slate-300 font-sans z-[100] flex items-center justify-center p-0 sm:p-6 lg:p-12">
      <div className="bg-slate-800 w-full h-full sm:max-w-4xl sm:h-[90vh] sm:rounded-3xl border border-white/5 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        
        {/* Sticky Header */}
        <header className="p-6 lg:p-8 border-b border-white/5 flex items-center justify-between bg-slate-800/95 backdrop-blur-md z-20 shrink-0">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">
              {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
            </h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">
              Last Updated: February 17, 2026
            </p>
          </div>
          <button 
            onClick={onBack}
            className="p-2.5 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-all border border-white/10"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-12 prose prose-invert max-w-none text-slate-400 leading-relaxed">
          {isPrivacy ? (
            <div className="space-y-8 pb-12">
              <section>
                <h2 className="text-xl font-bold text-indigo-400">1. Data Storage & Local Sovereignty</h2>
                <p>
                  Life Orchestrator is designed as a "Local-First" application. All persistent data, including your Kinship Ledger (contacts and relationship notes), Life Inventory (tasks), and local chat history, are stored exclusively within your browser's <strong>Local Storage</strong>. We do not maintain any external databases that store your personal identifiers or life data.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">2. Third-Party Services</h2>
                <p>To provide advanced orchestration, we interact with the following third parties:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Google Gemini API:</strong> Your chat messages and media are sent to Google's Gemini models for real-time reasoning. This data is transmitted securely via HTTPS and is not stored by us.</li>
                  <li><strong>Google Calendar API:</strong> If you choose to sync, we fetch your event data to identify "Hard Anchors." This data is processed in-memory. We do not store your calendar data on our own servers.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">3. Information Use</h2>
                <p>
                  Data sent to the Gemini API is used strictly to fulfill your orchestration requests. We do not use your data for marketing, profile building, or third-party tracking. The AI models process your input to generate schedules and relationship insights as requested.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">4. User Control & Data Deletion</h2>
                <p>
                  You have absolute control over your data. You can wipe your entire Life Orchestrator state at any time by clearing your browser's site data or revoking the app's access in your Google Account settings. Once Local Storage is cleared, that data is permanently deleted from your device.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-8 pb-12">
              <section>
                <h2 className="text-xl font-bold text-indigo-400">1. Acceptance of Terms</h2>
                <p>
                  By checking the agreement box on the landing page and accessing or using Life Orchestrator, you agree to be bound by these Terms of Service. This application is an experimental agentic interface designed to aid productivity and social connection through advanced AI reasoning.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">2. AI Accuracy & Limitations</h2>
                <p>
                  Life Orchestrator utilizes Google's Gemini models. While highly advanced, AI models can sometimes misinterpret complex scheduling constraints. You are solely responsible for verifying your final schedule before committing to meetings or personal events.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">3. Google Calendar Integration</h2>
                <p>
                  Users must comply with Google's Acceptable Use Policies when syncing with Google Calendar. Life Orchestrator acts as a client-side bridge; any data modified on Google Calendar via this app is subject to Google's standard data recovery and storage policies.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">4. Disclaimer of Warranty</h2>
                <p>
                  The service is provided "as is" and "as available." We make no warranties regarding the uptime of third-party APIs (Gemini, GCal) or the persistence of browser-level Local Storage.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <footer className="p-6 lg:p-8 border-t border-white/5 bg-slate-900/30 flex justify-center shrink-0">
          <button 
            onClick={onBack}
            className="px-10 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 border border-white/10"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
