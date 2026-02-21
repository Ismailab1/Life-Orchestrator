
import React from 'react';
import { StorageStats } from '../types';
import { storageService } from '../services/storageService';

interface Props {
  stats: StorageStats;
  onClose: () => void;
  onClearDate: (date: string) => void;
  onClearAllHistory: () => void;
}

export const StorageManager: React.FC<Props> = ({ stats, onClose, onClearDate, onClearAllHistory }) => {
  const isHigh = stats.percentage > 80;
  const isCritical = stats.percentage > 90;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden">
        
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Storage Management</h2>
            <p className="text-xs text-slate-500 font-medium">Manage your local-first data footprint.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
          {/* Main Stats */}
          <section className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Usage</span>
                <p className={`text-2xl font-bold ${isCritical ? 'text-red-600' : isHigh ? 'text-amber-600' : 'text-indigo-600'}`}>
                   {stats.percentage.toFixed(1)}% <span className="text-sm font-medium text-slate-400">of 5MB</span>
                </p>
              </div>
              <p className="text-xs font-bold text-slate-500">{storageService.formatBytes(stats.usedBytes)}</p>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
               <div className={`h-full transition-all duration-500 ${isCritical ? 'bg-red-500' : isHigh ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${stats.percentage}%` }}></div>
            </div>
            {isHigh && (
              <div className={`p-3 rounded-lg border text-xs leading-relaxed flex gap-3 ${isCritical ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <p><strong>Capacity Warning:</strong> Your browser storage is nearly full. New messages with images might fail to save soon. Consider clearing old history below.</p>
              </div>
            )}
          </section>

          {/* Breakdown List */}
          <section className="space-y-3">
             <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Category Breakdown</h3>
             {[
               { label: 'Chat History', bytes: stats.breakdown.messages, color: 'bg-indigo-400' },
               { label: 'Kinship Ledger', bytes: stats.breakdown.ledger, color: 'bg-emerald-400' },
               { label: 'Long-term Memory', bytes: stats.breakdown.memories, color: 'bg-amber-400' },
               { label: 'Life Inventory', bytes: stats.breakdown.inventory, color: 'bg-slate-400' }
             ].map(item => (
               <div key={item.label} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                    <span className="text-sm text-slate-700 font-medium">{item.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{storageService.formatBytes(item.bytes)}</span>
               </div>
             ))}
          </section>

          {/* Detailed History Cleanup */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">History by Date</h3>
              <button 
                onClick={onClearAllHistory}
                className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-widest"
              >
                Clear All History
              </button>
            </div>
            <div className="space-y-2">
               {/* Explicitly cast Object.entries to resolve the unknown type error for size */}
               {(Object.entries(stats.messagesByDate) as [string, number][])
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([date, size]) => (
                 <div key={date} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors group">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{storageService.formatBytes(size)}</p>
                    </div>
                    <button 
                      onClick={() => {
                        if (window.confirm(`Clear all chat messages from ${new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}? This cannot be undone.`)) {
                          onClearDate(date);
                        }
                      }}
                      className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Clear this day"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                 </div>
               ))}
               {Object.keys(stats.messagesByDate).length === 0 && (
                 <p className="text-center py-8 text-sm text-slate-400 italic">No chat history found.</p>
               )}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
           <button onClick={onClose} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-900/10">Done</button>
        </div>
      </div>
    </div>
  );
};
