/**
 * EventDetailModal: Side panel for viewing complete Google Calendar event details
 * 
 * DESIGN DECISION: Side Panel over Center Modal
 * - Keeps the event list visible for context
 * - Dedicated space for detailed information
 * - Consistent with StorageManager pattern
 * 
 * Displays comprehensive event metadata:
 * - Title, date, time, and duration
 * - Full description with formatting
 * - Location information
 * - Attendee list with response status
 * - Video conference links (clickable)
 * - Recurrence pattern (human-readable)
 * - Organizer information
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GoogleCalendarEvent, RelationshipLedger, Person } from '../types';

interface EventDetailModalProps {
  event: GoogleCalendarEvent | null;
  onClose: () => void;
  existingLedger: RelationshipLedger;
  onImportPerson: (person: Person) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose, existingLedger, onImportPerson }) => {
  const [importedEmails, setImportedEmails] = useState<Set<string>>(new Set());
  
  if (!event) return null;

  const start = event.start.dateTime || event.start.date;
  const end = event.end.dateTime || event.end.date;
  const startDate = new Date(start!);
  const endDate = new Date(end!);
  
  const isAllDay = !event.start.dateTime;
  const duration = !isAllDay ? calculateDuration(startDate, endDate) : 'All day';
  const timeRange = !isAllDay 
    ? `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'All day event';

  const recurrencePattern = getRecurrencePattern(event.recurrence);
  const videoLink = event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video');

  // Helper: Check if email is a resource/room calendar
  const isResourceEmail = (email: string): boolean => {
    const lowerEmail = email.toLowerCase();
    const resourcePatterns = [
      'room', 'conference', 'resource', 'calendar', 'noreply', 
      'no-reply', 'equipment', 'projector', 'building', 'facility'
    ];
    return resourcePatterns.some(pattern => lowerEmail.includes(pattern));
  };

  // Helper: Check if person can be imported
  const canImportPerson = (email: string, name: string, isSelf?: boolean): boolean => {
    if (isSelf) return false;
    if (isResourceEmail(email)) return false;
    if (importedEmails.has(email.toLowerCase())) return false;
    
    // Check if already in ledger
    const alreadyInLedger = Object.values(existingLedger).some(
      p => p.name.toLowerCase() === name.toLowerCase()
    );
    return !alreadyInLedger;
  };

  // Handle import person
  const handleImportPerson = (email: string, name: string) => {
    const person: Person = {
      name: name,
      relation: 'Calendar Contact',
      category: 'Network' as const,
      priority: 3,
      notes: `Met in: ${event.summary}`,
      last_contact: new Date().toISOString().split('T')[0],
      status: 'Stable' as const,
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
    };
    
    onImportPerson(person);
    setImportedEmails(prev => new Set(prev).add(email.toLowerCase()));
  };

  const modalContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[110] transition-opacity"
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-[120] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-slate-900">{event.summary}</h2>
            <div className="mt-2 space-y-1">
              <div className="text-sm text-slate-600">
                {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="text-sm text-slate-600 font-mono">
                {timeRange}
              </div>
              <div className="text-xs text-slate-500">
                Duration: {duration}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close details"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Recurrence Badge */}
          {recurrencePattern && (
            <div className="flex items-center gap-2">
              <div className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {recurrencePattern}
              </div>
            </div>
          )}

          {/* Video Conference Link */}
          {videoLink && (
            <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {event.conferenceData?.conferenceSolution?.name || 'Video Meeting'}
                    </div>
                    <div className="text-xs text-slate-600">Click to join</div>
                  </div>
                </div>
                <a
                  href={videoLink.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Join
                </a>
              </div>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Location</h3>
              </div>
              <div className="text-sm text-slate-900 bg-slate-50 rounded-lg p-3">
                {event.location}
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Description</h3>
              </div>
              <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">
                {event.description}
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Attendees ({event.attendees.length})
                </h3>
              </div>
              <div className="space-y-2">
                {event.attendees.map((attendee, idx) => {
                  const name = attendee.displayName || attendee.email.split('@')[0];
                  const canImport = canImportPerson(attendee.email, name, attendee.self);
                  
                  return (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg p-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {attendee.displayName || attendee.email}
                          {attendee.organizer && (
                            <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                              Organizer
                            </span>
                          )}
                          {attendee.self && (
                            <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                        {attendee.displayName && (
                          <div className="text-xs text-slate-500 truncate">{attendee.email}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getResponseStatusBadge(attendee.responseStatus)}
                        {canImport && (
                          <button
                            onClick={() => handleImportPerson(attendee.email, name)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1"
                            title="Add to Kinship Ledger"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add
                          </button>
                        )}
                        {importedEmails.has(attendee.email.toLowerCase()) && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded font-medium">
                            ✓ Added
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Organizer (if not already shown in attendees) */}
          {event.organizer && !event.organizer.self && !event.attendees?.some(a => a.organizer) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Organized by</h3>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{event.organizer.displayName || event.organizer.email}</div>
                  {event.organizer.displayName && (
                    <div className="text-xs text-slate-500 truncate">{event.organizer.email}</div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {canImportPerson(
                    event.organizer.email, 
                    event.organizer.displayName || event.organizer.email.split('@')[0],
                    event.organizer.self
                  ) ? (
                    <button
                      onClick={() => handleImportPerson(
                        event.organizer.email, 
                        event.organizer.displayName || event.organizer.email.split('@')[0]
                      )}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1"
                      title="Add to Kinship Ledger"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  ) : importedEmails.has(event.organizer.email.toLowerCase()) ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded font-medium">
                      ✓ Added
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};

// Helper functions
function calculateDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.round((diffMs % 3600000) / 60000);
  
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function getRecurrencePattern(recurrence?: string[]): string | null {
  if (!recurrence || recurrence.length === 0) return null;
  
  const rrule = recurrence[0];
  if (rrule.includes('FREQ=DAILY')) return 'Repeats daily';
  if (rrule.includes('FREQ=WEEKLY')) return 'Repeats weekly';
  if (rrule.includes('FREQ=MONTHLY')) return 'Repeats monthly';
  if (rrule.includes('FREQ=YEARLY')) return 'Repeats yearly';
  
  return 'Recurring event';
}

function getResponseStatusBadge(status?: string) {
  switch (status) {
    case 'accepted':
      return (
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">
          ✓ Accepted
        </span>
      );
    case 'declined':
      return (
        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
          ✗ Declined
        </span>
      );
    case 'tentative':
      return (
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">
          ? Maybe
        </span>
      );
    case 'needsAction':
    default:
      return (
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium">
          Pending
        </span>
      );
  }
}
