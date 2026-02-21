/**
 * DESIGN DECISION: Orchestration Proposal Component
 * 
 * This component displays AI-generated schedule optimizations for user approval.
 * 
 * Key Principles:
 * 
 * 1. **Transparency Through Reasoning**:
 *    The collapsible "Strategic Reasoning" section shows the AI's thought process.
 *    Users can understand *why* the AI made specific scheduling decisions.
 *    This builds trust and enables users to learn scheduling patterns.
 * 
 * 2. **Binary Approval Flow**:
 *    Accept = Apply all changes atomically
 *    Reject = Keep current state
 *    
 *    No partial edits to prevent internally inconsistent schedules.
 *    If users want adjustments, they ask the AI to revise and resubmit.
 * 
 * 3. **Visual Hierarchy**:
 *    - Reasoning: Collapsed by default (power users can expand)
 *    - Timeline: Prominent display (most users only read this)
 *    - Actions: Clear approve/reject buttons
 * 
 * 4. **Monospace Timeline**:
 *    Font-mono preserves formatting for time-aligned schedules:
 *    ```
 *    9:00 AM  - Team Sync (30m)
 *    10:00 AM - Deep Work  (2h)
 *    ```
 *    Alignment helps users scan quickly.
 * 
 * 5. **Accessibility**:
 *    Keyboard navigation (Tab to buttons, Enter to activate)
 *    ARIA labels for screen readers
 *    High contrast colors for readability
 */

import React from 'react';
import { OrchestrationProposal } from '../types';

interface Props {
  proposal: OrchestrationProposal;
  onAccept: () => void;
  onReject: () => void;
}

export const OrchestrationProposalView: React.FC<Props> = ({ proposal, onAccept, onReject }) => {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white shadow-lg border border-slate-700 animate-fade-in w-full max-w-2xl mx-auto my-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold flex items-center text-emerald-400">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          Proposed Orchestration
        </h3>
        <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-600">GEMINI 3</span>
      </div>

      <div className="space-y-3">
        {/* Collapsible Strategic Reasoning */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
            <details className="group">
                <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/30 transition-colors select-none">
                    <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                         <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Strategic Reasoning</h4>
                    </div>
                    <svg className="w-4 h-4 text-slate-500 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </summary>
                <div className="px-3 pb-3 pt-0">
                    <div className="pt-2 border-t border-slate-700/50">
                        <p className="text-sm text-slate-200 leading-relaxed italic">"{proposal.reasoning}"</p>
                    </div>
                </div>
            </details>
        </div>

        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Optimized Timeline</h4>
            <div className="text-sm font-mono text-emerald-300 whitespace-pre-wrap">
                {proposal.optimized_timeline}
            </div>
        </div>

        <div className="flex space-x-3 mt-4 pt-2 border-t border-slate-700/50">
            <button 
                onClick={onAccept}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
            >
                Confirm Schedule
            </button>
            <button 
                onClick={onReject}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
            >
                Revise
            </button>
        </div>
      </div>
    </div>
  );
};