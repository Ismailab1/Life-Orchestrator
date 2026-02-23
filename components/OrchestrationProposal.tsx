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
  isProcessing?: boolean;
}

export const OrchestrationProposalView: React.FC<Props> = ({ proposal, onAccept, onReject, isProcessing = false }) => {
  return (
    <div className="bg-slate-50 rounded-lg p-4 shadow-sm border border-slate-200 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center text-emerald-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          Proposed Orchestration
        </h3>
        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono border border-slate-300">GEMINI 3</span>
      </div>

      <div className="space-y-2">
        {/* Collapsible Strategic Reasoning */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <details className="group">
                <summary className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-50 transition-colors select-none">
                    <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                         <h4 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Strategic Reasoning</h4>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </summary>
                <div className="px-2.5 pb-2.5 pt-0">
                    <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-700 leading-relaxed italic">"{proposal.reasoning}"</p>
                    </div>
                </div>
            </details>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200">
            <h4 className="text-[10px] font-semibold text-slate-600 uppercase mb-1.5">Optimized Timeline</h4>
            <div className="text-xs font-mono text-emerald-700 whitespace-pre-wrap leading-relaxed">
                {proposal.optimized_timeline}
            </div>
        </div>

        <div className="flex space-x-2 mt-3 pt-2 border-t border-slate-200">
            <button 
                onClick={onAccept}
                disabled={isProcessing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white py-2 rounded-md font-medium text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
            >
                {isProcessing ? (
                    <>
                        <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Processing...</span>
                    </>
                ) : 'Confirm Schedule'}
            </button>
            <button 
                onClick={onReject}
                disabled={isProcessing}
                className="flex-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2 rounded-md font-medium text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
            >
                {isProcessing ? (
                    <>
                        <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Processing...</span>
                    </>
                ) : 'Revise'}
            </button>
        </div>
      </div>
    </div>
  );
};