
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
              Last Updated: February 20, 2026
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
                  Life Orchestrator is designed as a "Local-First" application with zero server backend. All persistent data—including your Kinship Ledger (contacts with relationship notes and priority ratings), Life Inventory (tasks with duration estimates), conversation history, and Memory Bank (saved preferences)—are stored exclusively within your browser's <strong>Local Storage</strong> (5MB quota). We do not maintain any external databases, analytics services, or tracking pixels that store your personal identifiers or life data.
                </p>
                <p className="mt-4">
                  Your data remains on your device at all times. Clearing your browser's site data through Settings → Privacy will permanently delete all Life Orchestrator data from your device.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">2. Third-Party Services & Data Transmission</h2>
                <p>To provide AI-powered orchestration, we interact with the following third-party services:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Google Gemini 2.5 Pro API:</strong> Your conversation messages, uploaded images, and context about your tasks/relationships are sent to Google's Gemini models for real-time reasoning and orchestration proposals. This data is transmitted securely via HTTPS. Google processes this data according to their <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">Gemini API Terms of Service</a>. We do not store conversation logs on any server—all history remains in your browser's localStorage.</li>
                  <li><strong>Google Calendar API (Optional):</strong> If you choose to connect your Google Calendar, we fetch your event data via OAuth 2.0 to identify scheduling conflicts ("Fixed" anchors). Calendar data is processed in-memory during your session and is never stored in our systems. When you export orchestrations back to Google Calendar, event creation is performed directly between your browser and Google's servers.</li>
                  <li><strong>Google OAuth 2.0:</strong> Calendar integration uses Google's OAuth flow. Your access tokens are stored only in your browser's localStorage (never on our servers) and can be revoked at any time through your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">Google Account permissions</a>.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">3. Information Use & AI Processing</h2>
                <p>
                  Data sent to the Gemini API is used strictly to fulfill your orchestration requests—generating daily briefings, proposing optimized schedules, calculating Kinship Debt for relationship tracking, and providing capacity management recommendations. We do not use your data for:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Marketing or advertising purposes</li>
                  <li>Building user profiles for sale to third parties</li>
                  <li>Training our own AI models (we use Google's hosted Gemini service)</li>
                  <li>Analytics or usage tracking beyond Google's standard API rate limits</li>
                </ul>
                <p className="mt-4">
                  The AI processes your input to generate temporal-aware orchestrations (Reflection/Active/Planning modes), capacity warnings when daily workload exceeds 10 hours, and relationship completion verification when Kinship Debt thresholds are crossed.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">4. User Control & Data Deletion</h2>
                <p>
                  You have absolute control over your data:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Local Data:</strong> Use the Storage Manager (accessible from chat interface) to surgically delete individual conversation dates or clear all data. You can also wipe everything by clearing your browser's site data for this domain.</li>
                  <li><strong>Google Calendar Access:</strong> Revoke calendar permissions at any time through your Google Account settings. This will prevent future calendar reads/writes but does not affect data already stored in your browser.</li>
                  <li><strong>Memory Bank:</strong> Individual memories can be deleted through the chat interface. The system maintains a 100-memory FIFO limit automatically.</li>
                </ul>
                <p className="mt-4">
                  Once localStorage is cleared, that data is permanently deleted from your device. We cannot recover it because we never stored it on any server.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">5. Security Measures</h2>
                <p>
                  While we do not control localStorage security (this is managed by your browser), we implement the following protections:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>All API requests to Google services use HTTPS encryption</li>
                  <li>OAuth tokens are stored with httpOnly and secure flags where supported by browser APIs</li>
                  <li>We do not transmit localStorage data to any servers we control</li>
                  <li>No third-party analytics or tracking scripts are embedded in the application</li>
                </ul>
                <p className="mt-4">
                  <strong>Important:</strong> Because data is stored in localStorage, anyone with physical access to your device and browser can potentially access your Life Orchestrator data. Use device-level security (lock screens, encryption) to protect your information.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">6. Children's Privacy</h2>
                <p>
                  Life Orchestrator is not intended for users under 13 years of age. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">7. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. The "Last Updated" date at the top of this policy indicates when it was most recently revised. Continued use of Life Orchestrator after changes constitutes acceptance of the updated policy.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-8 pb-12">
              <section>
                <h2 className="text-xl font-bold text-indigo-400">1. Acceptance of Terms</h2>
                <p>
                  By checking the agreement box on the landing page and accessing or using Life Orchestrator, you agree to be bound by these Terms of Service. This application is an experimental agentic AI interface designed to aid life orchestration, productivity optimization, and relationship management through advanced reasoning powered by Google Gemini 2.5 Pro.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">2. AI Accuracy & Limitations</h2>
                <p>
                  Life Orchestrator utilizes Google's Gemini 2.5 Pro language model with structured tool calling. While highly advanced, AI models can sometimes:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Misinterpret complex scheduling constraints or ambiguous user requests</li>
                  <li>Generate orchestration proposals that don't perfectly match your preferences</li>
                  <li>Miscalculate task durations or capacity estimates</li>
                  <li>Provide relationship advice that may not align with cultural or personal contexts</li>
                </ul>
                <p className="mt-4">
                  <strong>You are solely responsible</strong> for verifying proposed schedules, relationship recommendations, and capacity assessments before committing to meetings, personal events, or important decisions. The AI is a decision support tool, not a replacement for human judgment.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">3. Google Calendar Integration</h2>
                <p>
                  Users who choose to connect Google Calendar must comply with <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">Google's Terms of Service</a> and <a href="https://www.google.com/calendar/terms.html" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">Google Calendar Additional Terms</a>. Life Orchestrator acts as a client-side OAuth application; any data modified on Google Calendar via this app is subject to Google's standard data recovery, version history, and storage policies.
                </p>
                <p className="mt-4">
                  Calendar sync is optional. Revoking access will prevent future calendar reads/writes but will not affect data already stored in your browser's localStorage.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">4. Capacity Management & Overload Warnings</h2>
                <p>
                  Life Orchestrator enforces a realistic daily capacity model (8-10 hours of productive work). When you schedule tasks exceeding 10 hours, the AI provides overload warnings. At 12+ hours, it may automatically recommend redistributing tasks. These are suggestions based on general productivity research and may not match your personal capacity or work requirements. Always verify your actual availability and commitments.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">5. Relationship Tracking & Kinship Debt</h2>
                <p>
                  The Kinship Ledger calculates "Kinship Debt" using Priority × Days Since Last Contact. Thresholds (&gt;5 = Needs Attention, &gt;10 = Critical) are guidelines, not prescriptive rules. The quality of relationships cannot be reduced to mathematical formulas. Use the AI's relationship insights as suggestions, not mandates, and always apply your own judgment about when and how to connect with others.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">6. Disclaimer of Warranty</h2>
                <p>
                  The service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, either express or implied, including but not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Uptime or availability of third-party APIs (Gemini, Google Calendar)</li>
                  <li>Persistence or reliability of browser localStorage (subject to browser limitations and user actions)</li>
                  <li>Accuracy of AI-generated orchestrations, capacity estimates, or relationship insights</li>
                  <li>Compatibility with all browsers, devices, or operating systems</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">7. Limitation of Liability</h2>
                <p>
                  To the maximum extent permitted by law, Life Orchestrator and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Missed meetings or appointments due to scheduling errors</li>
                  <li>Relationship issues arising from AI-suggested interactions or lack thereof</li>
                  <li>Lost data due to localStorage limitations or browser changes</li>
                  <li>Burnout, overwork, or health issues related to capacity management suggestions</li>
                  <li>Third-party service outages or API changes</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">8. User Responsibilities</h2>
                <p>
                  You agree to:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Verify all AI-generated schedules before committing to events</li>
                  <li>Maintain backups of critical data (the app provides export functionality)</li>
                  <li>Use device-level security (lock screens, encryption) to protect localStorage data</li>
                  <li>Not use the service for emergency situations or time-critical medical/legal decisions</li>
                  <li>Regularly review relationship recommendations with cultural and personal context</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">9. Modifications to Service</h2>
                <p>
                  We reserve the right to modify, suspend, or discontinue Life Orchestrator (or any features) at any time without prior notice. Given the local-first architecture, you can continue using the app offline with existing localStorage data even if we discontinue API support, but AI orchestration features will cease to function.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-indigo-400">10. Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the service operators reside, without regard to conflict of law principles. Any disputes shall be resolved through binding arbitration where permitted by law.
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
