
import React, { useState, useEffect } from 'react';
import { Task, GoogleCalendarEvent, RelationshipLedger, Person } from '../types';
import { EventDetailModal } from './EventDetailModal';

interface Props {
  initialDate: Date;
  onImport: (tasks: Task[], importedPeopleCount: number) => void;
  onCancel: () => void;
  fetchEvents: (start: Date, end: Date) => Promise<GoogleCalendarEvent[]>;
  convertEventToTask: (event: GoogleCalendarEvent) => Task;
  getRecurrencePattern: (recurrence?: string[]) => string | null;
  existingLedger: RelationshipLedger;
  onImportPerson: (person: Person) => void;
}

export const CalendarImportModal: React.FC<Props> = ({ 
  initialDate, 
  onImport, 
  onCancel, 
  fetchEvents,
  convertEventToTask,
  getRecurrencePattern,
  existingLedger,
  onImportPerson,
}) => {
  const [rangeType, setRangeType] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [customStart, setCustomStart] = useState(initialDate.toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(initialDate.toISOString().split('T')[0]);
  const [fetchedEvents, setFetchedEvents] = useState<GoogleCalendarEvent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<GoogleCalendarEvent | null>(null);
  const [importedPeople, setImportedPeople] = useState<Person[]>([]);

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
    const toImport = fetchedEvents
      .filter(e => selectedIds.has(e.id))
      .map(e => convertEventToTask(e));
    onImport(toImport, importedPeople.length);
    setImportedPeople([]); // Reset for next import session
  };

  const handleCancel = () => {
    setImportedPeople([]); // Reset tracked people
    onCancel();
  };

  const handleImportPersonTracked = (person: Person) => {
    onImportPerson(person);
    setImportedPeople(prev => [...prev, person]);
  };

  const handleEventClick = (event: GoogleCalendarEvent, e: React.MouseEvent) => {
    // Don't open details if clicking the checkbox area
    const target = e.target as HTMLElement;
    if (target.closest('.checkbox-area')) {
      return;
    }
    setSelectedEventForDetails(event);
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
          <button onClick={handleCancel} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white transition-all">
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
              {fetchedEvents.map(event => {
                const start = event.start.dateTime || event.start.date;
                const startDate = new Date(start!);
                const time = event.start.dateTime 
                  ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'All day';
                const recurrencePattern = getRecurrencePattern(event.recurrence);
                
                return (
                  <div 
                    key={event.id}
                    onClick={(e) => handleEventClick(event, e)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${selectedIds.has(event.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                  >
                    <div 
                      className="checkbox-area w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 mt-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEvent(event.id);
                      }}
                      style={{
                        backgroundColor: selectedIds.has(event.id) ? '#4F46E5' : 'white',
                        borderColor: selectedIds.has(event.id) ? '#4F46E5' : '#CBD5E1',
                        color: 'white'
                      }}
                    >
                      {selectedIds.has(event.id) && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{event.summary}</p>
                      
                      {/* Event Badges */}
                      <EventBadges 
                        event={event} 
                        recurrencePattern={recurrencePattern}
                      />
                      
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">{event.start.date || startDate.toISOString().split('T')[0]}</span>
                        <span className="text-[10px] text-slate-500 font-bold bg-white/50 px-1.5 rounded border border-slate-200/50">{time}</span>
                      </div>
                      
                      {/* Details hint on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        <span className="text-[10px] text-indigo-600 font-medium">
                          Click for details →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          <button onClick={handleCancel} className="flex-1 py-3 px-4 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all shadow-lg ${
              selectedIds.size === 0
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'
            }`}
          >
            Import {selectedIds.size} {selectedIds.size === 1 ? 'Event' : 'Events'}
          </button>
        </div>
      </div>

      {/* Event Detail Modal */}
      <EventDetailModal 
        event={selectedEventForDetails}
        onClose={() => setSelectedEventForDetails(null)}
        existingLedger={existingLedger}
        onImportPerson={handleImportPersonTracked}
      />
    </div>
  );
};
/**
 * EventBadges Component: Display visual indicators for event metadata
 * Shows badges for recurring events, meetings, location, video links, duration, and organizer
 */
interface EventBadgesProps {
  event: GoogleCalendarEvent;
  recurrencePattern: string | null;
}

const EventBadges: React.FC<EventBadgesProps> = ({ event, recurrencePattern }) => {
  const start = event.start.dateTime || event.start.date;
  const end = event.end.dateTime || event.end.date;
  const startDate = new Date(start!);
  const endDate = new Date(end!);
  const duration = calculateDuration(startDate, endDate);
  
  const hasVideoLink = event.conferenceData?.entryPoints?.some(ep => ep.entryPointType === 'video');
  const attendeesCount = event.attendees?.length || 0;
  const showOrganizer = event.organizer && !event.organizer.self;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {/* Recurring Badge */}
      {recurrencePattern && (
        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {recurrencePattern}
        </span>
      )}

      {/* Meeting/Attendees Badge */}
      {attendeesCount > 0 && (
        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          {attendeesCount} {attendeesCount === 1 ? 'person' : 'people'}
        </span>
      )}

      {/* Video Link Badge */}
      {hasVideoLink && (
        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Video
        </span>
      )}

      {/* Location Badge */}
      {event.location && (
        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 max-w-[120px] truncate">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{event.location}</span>
        </span>
      )}

      {/* Duration Badge */}
      {duration && (
        <span className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {duration}
        </span>
      )}

      {/* Organizer Badge */}
      {showOrganizer && (
        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 max-w-[100px] truncate">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="truncate">{event.organizer.displayName || event.organizer.email.split('@')[0]}</span>
        </span>
      )}
    </div>
  );
};

// Helper function
function calculateDuration(start: Date, end: Date): string | null {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return null;
  
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.round((diffMs % 3600000) / 60000);
  
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  if (mins > 0) return `${mins}m`;
  return null;
}