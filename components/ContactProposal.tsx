import React from 'react';
import { Person } from '../types';

interface Props {
  person: Person;
  onAccept: () => void;
  onReject: () => void;
}

export const ContactProposalView: React.FC<Props> = ({ person, onAccept, onReject }) => {
  return (
    <div className="bg-white rounded-xl p-4 border border-indigo-100 shadow-md mt-2 w-full max-w-md animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
        </div>
        <div>
           <h3 className="font-bold text-slate-800 text-sm">New Contact Detected</h3>
           <p className="text-xs text-slate-500">Should I add this person to your ledger?</p>
        </div>
      </div>
      
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3 space-y-1">
         <div className="flex justify-between">
            <span className="text-xs font-semibold text-slate-500">Name:</span>
            <span className="text-xs font-bold text-slate-800">{person.name}</span>
         </div>
         <div className="flex justify-between">
            <span className="text-xs font-semibold text-slate-500">Relation:</span>
            <span className="text-xs text-slate-700">{person.relation}</span>
         </div>
         <div className="flex justify-between">
            <span className="text-xs font-semibold text-slate-500">Category:</span>
            <span className="text-xs text-slate-700">{person.category}</span>
         </div>
         {person.notes && (
             <div className="pt-1 border-t border-slate-200 mt-1">
                 <p className="text-xs text-slate-600 italic">"{person.notes}"</p>
             </div>
         )}
      </div>

      <div className="flex gap-2">
         <button onClick={onAccept} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-xs font-bold transition-colors">
            Yes, Add Contact
         </button>
         <button onClick={onReject} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-bold transition-colors">
            No, Cancel
         </button>
      </div>
    </div>
  );
};
