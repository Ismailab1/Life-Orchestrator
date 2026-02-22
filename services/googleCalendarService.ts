/**
 * DESIGN DECISION: Google Calendar Integration Service
 * 
 * This service enables bidirectional sync between Life Orchestrator and Google Calendar:
 * - Import: Read user's calendar events into the app
 * - Export: Push orchestrated schedules back to Google Calendar
 * 
 * Key Design Choices:
 * 
 * 1. **OAuth 2.0 with User Consent**:
 *    Uses Google Identity Services (GIS) for secure, user-controlled authentication.
 *    Users explicitly grant calendar access. No backend server needed.
 * 
 * 2. **Client-Side Only**:
 *    All calendar operations happen in the browser. Privacy-first: no data
 *    passes through intermediary servers.
 * 
 * 3. **Error Categorization**:
 *    Google APIs return cryptic errors. The handleApiError method translates
 *    technical errors into actionable user instructions.
 * 
 * 4. **Recurrence Mapping**:
 *    Maps Google Calendar's RRULE format to our simplified RecurrenceRule format.
 *    Supports daily, weekly, and monthly patterns.
 * 
 * 5. **CSRF Protection**:
 *    Generates random state tokens to prevent cross-site request forgery attacks
 *    during OAuth flow.
 * 
 * Technical Dependencies:
 * - gapi.client: Google API client library (calendar v3 REST API)
 * - google.accounts.oauth2: Google Identity Services for OAuth
 * 
 * Both libraries are loaded dynamically to avoid blocking initial page load.
 */

import { Task, RecurrenceRule, GoogleCalendarEvent, EventAttendee, ConferenceData, ConferenceEntryPoint, EventOrganizer } from "../types";

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

export class GoogleCalendarService {
  private tokenClient: any = null;
  private gapiInited = false;
  private gsisInited = false;
  private accessToken: string | null = null;
  private currentClientId: string;

  constructor(clientId: string) {
    this.currentClientId = clientId;
  }

  /**
   * Categorizes technical errors into user-friendly instructions.
   * DESIGN DECISION: User-centric error messages
   * 
   * Google APIs return developer-oriented errors. Users don't know what
   * "403 insufficient_scope" means. This method maps technical codes to
   * actionable instructions:
   * 
   * - OAuth errors → "Check permissions"
   * - Network errors → "Check VPN/firewall"
   * - Rate limits → "Wait and retry"
   * 
   * This improves support burden and user trust.
   */
  private handleApiError(error: any): string {
    console.error("GCal Technical Error Details:", error);
    
    // Normalize error data across different Google SDK formats
    const resultError = error.result?.error;
    const message = (resultError?.message || error.message || error.error_description || "").toLowerCase();
    const status = error.status || resultError?.code;
    const errorType = error.error || resultError?.status || "";

    // 1. Client Configuration Errors (Developer level)
    if (errorType === 'invalid_client' || message.includes('invalid_client') || message.includes('client_id')) {
      return "OAuth Configuration Error: The Client ID is invalid or not authorized for this origin. Check Authorized JavaScript Origins in GCP.";
    }

    // 2. Permission / Auth Denial (User choice or scope issues)
    if (errorType === 'access_denied' || status === 403 || message.includes('permission') || message.includes('access_denied')) {
      if (message.includes('insufficient permission') || message.includes('scope')) {
        return "Permission Denied: This app needs permission to edit your calendar to sync orchestrations. Please try again and check the required boxes.";
      }
      return "Access Refused: You declined the request to access your calendar. Sync is disabled.";
    }

    // 3. Authentication Expiry / Revocation
    if (status === 401 || message.includes('unauthorized') || message.includes('expired') || message.includes('invalid_token')) {
      return "Session Expired: Your Google session has timed out. Please sign out and reconnect to restore sync capabilities.";
    }

    // 4. Resource / Quota Errors
    if (status === 429 || message.includes('rate limit') || message.includes('quota') || message.includes('limitexceeded')) {
      return "Rate Limit Exceeded: Google is currently limiting requests. Please wait a minute before attempting to sync again.";
    }

    // 5. Network / Environment Errors
    if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch') || message.includes('cross-origin')) {
      return "Network Failure: Could not establish a secure connection to Google Services. Ensure you aren't behind a firewall or VPN blocking Google APIs.";
    }

    // 6. Not Found
    if (status === 404 || message.includes('not found')) {
      return "Resource Not Found: The calendar or event could not be located in your Google account.";
    }

    // 7. Popup Blocked (GSI specific)
    if (message.includes('popup_closed_by_user')) {
      return "Sign-In Cancelled: The login window was closed before completion.";
    }

    return message ? `Sync Error: ${message}` : "An unexpected error occurred while communicating with Google Calendar.";
  }

  /**
   * Generates a random state string for CSRF protection.
   * COMPLIANCE: Secure Response Handling.
   */
  private generateState(): string {
    const array = new Uint32Array(8);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => dec.toString(16).padStart(2, '0')).join('');
  }

  public async initialize(): Promise<void> {
    if (!this.currentClientId) {
      throw new Error("Calendar service missing Client ID. Contact administrator.");
    }

    if (this.gapiInited && this.gsisInited) return;

    return new Promise((resolve, reject) => {
      const checkInited = () => {
        if (this.gapiInited && this.gsisInited) resolve();
      };

      if (!this.gapiInited) {
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onerror = () => reject(new Error("Failed to load Google API scripts. Ensure your browser is not blocking Google's domains."));
        gapiScript.onload = () => {
          window.gapi.load('client', async () => {
            try {
              await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
              this.gapiInited = true;
              checkInited();
            } catch (e) {
              reject(new Error(this.handleApiError(e)));
            }
          });
        };
        document.body.appendChild(gapiScript);
      }

      if (!this.gsisInited) {
        const gsiScript = document.createElement('script');
        gsiScript.src = 'https://accounts.google.com/gsi/client';
        gsiScript.onerror = () => reject(new Error("Failed to load Google Identity scripts. Check your content security policies."));
        gsiScript.onload = () => {
          this.gsisInited = true;
          checkInited();
        };
        document.body.appendChild(gsiScript);
      } else {
        checkInited();
      }
    });
  }

  /**
   * COMPLIANCE: Revoke token and clear local state.
   * This is required for User Control and Data Privacy.
   */
  public async signOut(): Promise<void> {
    if (this.accessToken) {
      try {
        if (window.google?.accounts?.oauth2) {
          window.google.accounts.oauth2.revoke(this.accessToken, () => {
            console.debug('OAuth token revoked via Google Identity Services.');
          });
        }
        window.gapi?.client?.setToken(null);
      } catch (e) {
        console.error("Revocation failed", e);
      }
    }
    this.accessToken = null;
    sessionStorage.removeItem('oauth_state');
  }

  private async ensureAuthenticated(): Promise<void> {
    try {
      await this.initialize();
    } catch (e: any) {
      throw new Error(this.handleApiError(e));
    }

    if (this.accessToken) return;

    return new Promise((resolve, reject) => {
      const state = this.generateState();
      sessionStorage.setItem('oauth_state', state);

      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.currentClientId,
        scope: SCOPES,
        state: state,
        callback: (resp: any) => {
          if (resp.error) {
            reject(new Error(this.handleApiError(resp)));
            return;
          }

          const savedState = sessionStorage.getItem('oauth_state');
          sessionStorage.removeItem('oauth_state');

          // CSRF VALIDATION
          if (!resp.state || resp.state !== savedState) {
            reject(new Error("Security Error: OAuth response state mismatch. Request blocked."));
            return;
          }

          if (resp.access_token) {
            this.accessToken = resp.access_token;
            window.gapi.client.setToken({ access_token: resp.access_token });
            resolve();
          } else {
            reject(new Error("Authentication failed: No access token returned."));
          }
        },
      });

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  /**
   * List Google Calendar events with full metadata
   * Returns GoogleCalendarEvent objects with all available properties
   */
  public async listEvents(startDate: Date, endDate: Date): Promise<GoogleCalendarEvent[]> {
    await this.ensureAuthenticated();
    
    const timeMin = new Date(startDate);
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(endDate);
    timeMax.setHours(23, 59, 59, 999);

    try {
      const response = await window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.result.items || []).map((event: any): GoogleCalendarEvent => ({
        id: event.id,
        summary: event.summary || 'Untitled',
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.start.dateTime,
          date: event.start.date,
          timeZone: event.start.timeZone,
        },
        end: {
          dateTime: event.end.dateTime,
          date: event.end.date,
          timeZone: event.end.timeZone,
        },
        attendees: event.attendees?.map((a: any): EventAttendee => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
          organizer: a.organizer,
          self: a.self,
        })),
        conferenceData: event.conferenceData ? {
          entryPoints: event.conferenceData.entryPoints?.map((ep: any): ConferenceEntryPoint => ({
            entryPointType: ep.entryPointType,
            uri: ep.uri,
            label: ep.label,
          })) || [],
          conferenceSolution: event.conferenceData.conferenceSolution ? {
            name: event.conferenceData.conferenceSolution.name,
            iconUri: event.conferenceData.conferenceSolution.iconUri,
          } : undefined,
        } : undefined,
        organizer: event.organizer ? {
          email: event.organizer.email,
          displayName: event.organizer.displayName,
          self: event.organizer.self,
        } : undefined,
        recurringEventId: event.recurringEventId,
        recurrence: event.recurrence,
        colorId: event.colorId,
        status: event.status,
      }));
    } catch (err) {
      throw new Error(this.handleApiError(err));
    }
  }

  /**
   * Convert GoogleCalendarEvent to Task for import
   * Simplifies the rich event data into our task structure
   */
  public convertEventToTask(event: GoogleCalendarEvent): Task {
    const start = event.start.dateTime || event.start.date;
    const startDateObj = new Date(start!);
    const end = event.end.dateTime || event.end.date;
    const endDateObj = new Date(end!);
    
    const duration = this.calculateDuration(startDateObj, endDateObj);
    const time = event.start.dateTime 
      ? startDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : undefined;

    return {
      id: event.id,
      gcal_id: event.id,
      gcal_recurring_id: event.recurringEventId,
      title: event.summary,
      type: 'fixed',
      time,
      date: startDateObj.toISOString().split('T')[0],
      duration,
      priority: 'medium',
      category: 'Life',
      description: event.description,
      location: event.location,
      attendees: event.attendees,
      conferenceData: event.conferenceData,
      organizer: event.organizer,
    };
  }

  /**
   * Calculate human-readable duration from start and end dates
   */
  private calculateDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.round((diffMs % 3600000) / 60000);
    
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  }

  /**
   * Get human-readable recurrence pattern from RRULE
   */
  public getRecurrencePattern(recurrence?: string[]): string | null {
    if (!recurrence || recurrence.length === 0) return null;
    
    const rrule = recurrence[0];
    if (rrule.includes('FREQ=DAILY')) return 'Daily';
    if (rrule.includes('FREQ=WEEKLY')) return 'Weekly';
    if (rrule.includes('FREQ=MONTHLY')) return 'Monthly';
    if (rrule.includes('FREQ=YEARLY')) return 'Yearly';
    
    return 'Recurring';
  }

  private mapRecurrenceToRRule(rule: RecurrenceRule): string {
    const freq = rule.frequency.toUpperCase();
    let rrule = `RRULE:FREQ=${freq}`;
    
    if (rule.frequency === 'weekly' && rule.weekDays) {
      const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDay = rule.weekDays.map(d => days[d]).join(',');
      rrule += `;BYDAY=${byDay}`;
    } else if (rule.frequency === 'monthly' && rule.dayOfMonth) {
      rrule += `;BYMONTHDAY=${rule.dayOfMonth}`;
    }
    
    return rrule;
  }

  public async exportTasks(tasks: Task[], date: Date): Promise<Task[]> {
    await this.ensureAuthenticated();
    const dateStr = date.toISOString().split('T')[0];
    const updatedTasks: Task[] = [];

    for (const task of tasks) {
      if (task.gcal_id) {
        updatedTasks.push(task);
        continue;
      }

      const [h, m] = this.parseTimeString(task.time || "09:00 AM");
      const start = new Date(`${dateStr}T${h}:${m}:00`);
      const end = new Date(start.getTime() + this.parseDurationToMs(task.duration));

      const resource: any = {
        summary: task.title,
        description: `Orchestrated by Life OS. Priority: ${task.priority}`,
        start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      };

      if (task.recurrence) {
        resource.recurrence = [this.mapRecurrenceToRRule(task.recurrence)];
      }

      try {
        const response = await window.gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: resource,
        });
        
        updatedTasks.push({
          ...task,
          gcal_id: response.result.id
        });
      } catch (err) {
        // Stop batch if a critical error occurs (e.g. auth revoked)
        const errorMsg = this.handleApiError(err);
        if (errorMsg.includes("Configuration") || errorMsg.includes("Expired") || errorMsg.includes("Denied")) {
          throw new Error(errorMsg);
        }
        console.error(`Failed to export task: ${task.title}`, err);
        updatedTasks.push(task);
      }
    }
    
    return updatedTasks;
  }

  private parseTimeString(time: string): [string, string] {
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return ['09', '00'];
    let h = parseInt(match[1]);
    const m = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return [h.toString().padStart(2, '0'), m.padStart(2, '0')];
  }

  private parseDurationToMs(duration: string): number {
    const h = duration.match(/(\d+)h/);
    const m = duration.match(/(\d+)m/);
    let ms = 0;
    if (h) ms += parseInt(h[1]) * 3600000;
    if (m) ms += parseInt(m[1]) * 60000;
    return ms || 3600000;
  }
}
