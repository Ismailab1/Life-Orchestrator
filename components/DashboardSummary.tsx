import React, { useMemo } from 'react';
import { Task, RelationshipLedger, ChatHistory, StorageStats, calculateRelationshipStatus } from '../types';

interface DashboardSummaryProps {
  currentDate: Date;
  dailyInventory: { fixed: Task[]; flexible: Task[] };
  ledger: RelationshipLedger;
  allMessages: ChatHistory;
  storageStats: StorageStats;
}

const CATEGORY_BAR: Record<string, string> = {
  Health: 'bg-emerald-400',
  Career: 'bg-indigo-400',
  Life: 'bg-orange-400',
  Family: 'bg-purple-400',
};

const formatTimeTo12Hour = (time?: string): string => {
  if (!time) return '';
  if (/am|pm/i.test(time)) return time;
  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${minutesStr || '00'} ${period}`;
};

const toDateString = (date: Date) => date.toLocaleDateString('en-CA');

const formatRelativeDate = (dateStr: string): string => {
  const today = new Date();
  const target = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.round((new Date(toDateString(today)).getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1) return `${diffDays} days ago`;
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const StatTile: React.FC<{ label: string; value: string | number; accent: string }> = ({ label, value, accent }) => (
  <div className="flex-1 min-w-[7rem] bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
    <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{label}</div>
  </div>
);

const CAPABILITIES = [
  { icon: '🗓️', title: 'Orchestrate your day', text: 'Ask the AI to balance fixed and flexible tasks into an optimal schedule.' },
  { icon: '❤️', title: 'Track relationships', text: 'The Kinship Ledger flags who needs a check-in based on priority and time.' },
  { icon: '📥', title: 'Import your calendar', text: 'Pull in Google Calendar events without leaving the app.' },
  { icon: '✅', title: 'Log check-ins', text: 'Mark tasks done to automatically update relationship status.' },
];

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({ currentDate, dailyInventory, ledger, allMessages, storageStats }) => {
  const dateLabel = currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const allTasks = useMemo(() => [...dailyInventory.fixed, ...dailyInventory.flexible], [dailyInventory]);
  const openTaskCount = useMemo(() => allTasks.filter(t => !t.completed).length, [allTasks]);
  const scheduledCount = dailyInventory.fixed.length;

  const attentionCount = useMemo(() => {
    return Object.values(ledger).filter(p => calculateRelationshipStatus(p.priority, p.last_contact) !== 'Stable').length;
  }, [ledger]);

  const schedulePreview = useMemo(() => {
    const sorted = [...dailyInventory.fixed].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const rest = dailyInventory.flexible.filter(t => !t.completed);
    return [...sorted, ...rest].slice(0, 4);
  }, [dailyInventory]);

  const remainingCount = Math.max(0, dailyInventory.fixed.length + dailyInventory.flexible.length - schedulePreview.length);

  const lastConversation = useMemo(() => {
    const dateKeys = Object.keys(allMessages).sort().reverse();
    for (const dateKey of dateKeys) {
      const msgs = allMessages[dateKey].filter(m => !m.isThinking && !m.isAction && m.text);
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        return { dateKey, text: last.text, role: last.role };
      }
    }
    return null;
  }, [allMessages]);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4 lg:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{greeting}</h2>
          <p className="text-sm text-slate-500">{dateLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <StatTile label="Open Tasks" value={openTaskCount} accent="text-indigo-600" />
        <StatTile label="Scheduled Today" value={scheduledCount} accent="text-slate-700" />
        <StatTile label="Need Attention" value={attentionCount} accent={attentionCount > 0 ? 'text-red-600' : 'text-emerald-600'} />
        <StatTile label="Storage Used" value={`${Math.round(storageStats.percentage)}%`} accent="text-slate-700" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Today's Schedule</h3>
          {schedulePreview.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nothing scheduled yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {schedulePreview.map(task => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-1.5 h-4 rounded-full shrink-0 ${task.category ? CATEGORY_BAR[task.category] || 'bg-slate-300' : 'bg-slate-300'}`} />
                  {task.time && <span className="font-mono text-xs text-slate-500 shrink-0">{formatTimeTo12Hour(task.time)}</span>}
                  <span className={`truncate ${task.completed ? 'text-emerald-600 line-through' : 'text-slate-700'}`}>{task.title}</span>
                </li>
              ))}
              {remainingCount > 0 && <li className="text-xs text-slate-400">+{remainingCount} more</li>}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Last Conversation</h3>
          {lastConversation ? (
            <div className="text-sm text-slate-700">
              <span className="text-xs text-slate-400 font-semibold">{formatRelativeDate(lastConversation.dateKey)} · {lastConversation.role === 'user' ? 'You' : 'AI'}</span>
              <p className="mt-1 line-clamp-2">{lastConversation.text}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No conversations yet — say hello below.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">What the assistant can do</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CAPABILITIES.map(c => (
            <div key={c.title} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-lg mb-1">{c.icon}</div>
              <div className="text-xs font-bold text-slate-700">{c.title}</div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
