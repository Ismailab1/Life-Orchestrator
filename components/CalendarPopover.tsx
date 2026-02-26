import React, { useState } from 'react';
import { Task } from '../types';

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  tasks: Task[]; // Full task list to show indicators
  embedded?: boolean; // When true, renders flat (no rounded/shadow) for sidebar use
}

export const CalendarPopover: React.FC<Props> = ({ selectedDate, onSelectDate, tasks, embedded = false }) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const handleToday = () => {
    const today = new Date();
    setViewDate(today);
    onSelectDate(today);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  // Helper to check if a specific day has tasks
  const hasTasks = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.some(t => t.date === dateStr);
  };

  const getTasksForDay = (day: number): Task[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => t.date === dateStr);
  };

  const isSelected = (day: number) => {
    return selectedDate.getDate() === day && 
           selectedDate.getMonth() === month && 
           selectedDate.getFullYear() === year;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year;
  };

  return (
    <div className={`bg-white overflow-hidden ${embedded ? 'flex flex-col h-full w-full' : 'w-72 rounded-xl shadow-2xl border border-slate-200 animate-fade-in ring-1 ring-black/5'}`}>
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <span className="font-bold text-slate-900">{monthName} {year}</span>
        <div className="flex items-center gap-1">
          <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-md text-slate-500 hover:text-indigo-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={handleToday} className="px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-indigo-600 hover:bg-white rounded border border-indigo-100 transition-colors">Today</button>
          <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-md text-slate-500 hover:text-indigo-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 mb-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
            <div key={index} className="text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => (
            <div key={idx} className="h-9 relative">
              {day && (
                <button
                  onClick={() => onSelectDate(new Date(year, month, day))}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`
                    w-full h-full rounded-lg flex items-center justify-center text-sm font-medium transition-all
                    ${isSelected(day) ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' : 'hover:bg-indigo-50 text-slate-700'}
                    ${isToday(day) && !isSelected(day) ? 'text-indigo-600 font-bold underline decoration-2 underline-offset-4' : ''}
                  `}
                >
                  {day}
                  {hasTasks(day) && (
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected(day) ? 'bg-white' : 'bg-indigo-400'}`}></span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="border-t border-slate-100 bg-slate-50 flex-shrink-0">
        {hoveredDay !== null ? (
          (() => {
            const dayTasks = getTasksForDay(hoveredDay).sort((a, b) => {
              if (!a.time && !b.time) return 0;
              if (!a.time) return 1;
              if (!b.time) return -1;
              return a.time.localeCompare(b.time);
            });
            const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
              Career:  { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Career' },
              Life:    { bg: 'bg-violet-100',  text: 'text-violet-700',  label: 'Life'   },
              Health:  { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Health' },
              Family:  { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Family' },
            };
            const PRIORITY_DOT: Record<string, string> = {
              high:   'bg-rose-400',
              medium: 'bg-amber-400',
              low:    'bg-slate-300',
            };
            const VISIBLE = 5;
            return dayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 gap-1">
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p className="text-[10px] text-slate-400">No tasks scheduled</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {dayTasks.slice(0, VISIBLE).map(t => {
                  const cat = CATEGORY_STYLES[t.category ?? ''];
                  return (
                    <div key={t.id} className={`flex items-start gap-1.5 rounded-md px-1.5 py-1 ${t.completed ? 'opacity-50' : 'bg-white shadow-sm border border-slate-100'}`}>
                      {/* priority dot */}
                      <span className={`mt-[3px] w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-semibold leading-tight text-slate-700 truncate ${t.completed ? 'line-through text-slate-400' : ''}`}>{t.title}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {t.time && (
                            <span className="text-[9px] text-slate-400 font-medium tabular-nums">{t.time}</span>
                          )}
                          {t.duration && (
                            <span className="text-[9px] text-slate-400">· {t.duration}</span>
                          )}
                          {t.type === 'flexible' && (
                            <span className="text-[9px] text-slate-300 italic">flexible</span>
                          )}
                        </div>
                      </div>
                      {cat && (
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full flex-shrink-0 ${cat.bg} ${cat.text}`}>{cat.label}</span>
                      )}
                    </div>
                  );
                })}
                {dayTasks.length > VISIBLE && (
                  <p className="text-[9px] text-slate-400 text-center pt-0.5">+{dayTasks.length - VISIBLE} more tasks</p>
                )}
              </div>
            );
          })()
        ) : (
          <div className="flex items-center justify-center py-3">
            <p className="text-[10px] text-slate-400">Hover a day to preview tasks</p>
          </div>
        )}
      </div>
    </div>
  );
};