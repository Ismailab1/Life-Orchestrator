
import React, { useState, useEffect } from 'react';
import { Task } from '../types';

interface Props {
  initialDate: Date;
  onImport: (tasks: Task[]) => void;
  onCancel: () => void;
  fetchEvents: (start: Date, end: Date) => Promise<Task[]>;
}

export const CalendarImportModal: React.FC<Props> = ({ initialDate, onImport, onCancel, fetchEvents }) => {
  const [rangeType, setRangeType] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [customStart, setCustomStart] = useState(initialDate.toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(initialDate.toISOString().split('T')[0]);
  const [fetchedEvents, setFetchedEvents] = useState<Task[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let start = new Date(initialDate);
      start.setHours(0, 0, 0, 0);
      
      let end = new Date(initialDate);
      end.setHours(23, 59, 59, 999);

      if (rangeType === 'week') {
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);
      } else if (rangeType === 'month') {
        end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setHours(23, 59, 59, 999);
      } else if (rangeType === 'custom') {
        // Parse from YYYY-MM-DD input correctly for local time
        const [sy, sm, sd] = customStart.split('-').map(Number);
        const [ey, em, ed] = customEnd.split('-').map(Number);
        start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      }

      const events = await fetchEvents(start, end);
      setFetchedEvents(events);
      setSelectedIds(new Set(events.map(e => e.id))); // Select all by default
    } catch (err: any) {
      setError(err.message || "Failed to fetch events.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEvent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    const toImport = fetchedEvents.filter(e => selectedIds.has(e.id));
    onImport(toImport);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Import Events</h2>
            <p className="text-xs text-slate-500 font-medium">Select a range and choose events to merge.</p>
          </div>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Range Selection */}
        <div className="p-6 space-y-4 border-b border-slate-50">
          <div className="flex flex-wrap gap-2">
            {(['day', 'week', 'month', 'custom'] as const).map(type => (
              <button
                key={type}
                onClick={() => setRangeType(type)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${rangeType === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'}`}
              >
                {type}
              </button>
            ))}
          </div>

          {rangeType === 'custom' && (
            <div className="flex gap-4 animate-fade-in">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Date</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            </div>
          )}

          <button
            onClick={handleFetch}
            disabled={isLoading}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 ${isLoading ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
            {fetchedEvents.length > 0 ? 'Refresh Results' : 'Search Calendar'}
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-[200px]">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 text-red-700">
               <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!isLoading && fetchedEvents.length === 0 && !error && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-12">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               </div>
               <p className="text-sm font-medium">No results fetched yet.</p>
               <p className="text-xs mt-1">Select a range and tap the button above.</p>
            </div>
          )}

          {fetchedEvents.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{fetchedEvents.length} Events Found</span>
                <button onClick={() => selectedIds.size === fetchedEvents.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(fetchedEvents.map(e => e.id)))} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
                  {selectedIds.size === fetchedEvents.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {fetchedEvents.map(event => (
                <div 
                  key={event.id} 
                  onClick={() => toggleEvent(event.id)}
                  className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${selectedIds.has(event.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedIds.has(event.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                    {selectedIds.has(event.id) && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-mono">{event.date}</span>
                      <span className="text-[10px] text-slate-500 font-bold bg-white/50 px-1.5 rounded border border-slate-200/50">{event.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 px-4 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all shadow-lg ${selectedIds.size === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'}`}
          >
            Import {selectedIds.size} {selectedIds.size === 1 ? 'Event' : 'Events'}
          </button>
        </div>
      </div>
    </div>
  );
};
