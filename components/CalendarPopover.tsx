import React, { useState } from 'react';
import { Task } from '../types';

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  tasks: Task[]; // Full task list to show indicators
}

export const CalendarPopover: React.FC<Props> = ({ selectedDate, onSelectDate, tasks }) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

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
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in ring-1 ring-black/5">
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
      
      <div className="bg-slate-50 p-2 text-[10px] text-slate-400 text-center border-t border-slate-100">
        Select a day to view chat history & tasks
      </div>
    </div>
  );
};