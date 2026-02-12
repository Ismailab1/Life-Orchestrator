
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LifeInventory, Task } from '../types';

interface Props {
  inventory: LifeInventory;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask?: (task: Task) => void; // Optional for backward compatibility, though App.tsx provides it
}

const InfoTooltip = ({ text }: { text: string }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Center vertically relative to the icon center, move to the right of the icon
      setCoords({
        top: rect.top + (rect.height / 2) + window.scrollY,
        left: rect.left + rect.width + 12 + window.scrollX
      });
    }
  };

  useEffect(() => {
    if (show) {
      updateCoords();
      // Use capture for scroll to handle scrolls inside containers
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [show]);

  return (
    <div 
      ref={triggerRef}
      className="relative inline-flex ml-1.5 group align-middle cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {show && createPortal(
        <div 
          style={{ 
            position: 'absolute', 
            top: `${coords.top}px`, 
            left: `${coords.left}px`,
            transform: 'translateY(-50%)',
            zIndex: 9999
          }}
          className="w-64 p-3 bg-slate-800 text-white text-xs leading-relaxed rounded-lg shadow-2xl animate-fade-in pointer-events-none border border-slate-700"
        >
          {text}
          {/* Arrow pointing left, centered on the icon */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-slate-800"></div>
        </div>,
        document.body
      )}
    </div>
  );
};

const RecurrenceControl: React.FC<{ 
    recurrence: Task['recurrence'], 
    onChange: (r: Task['recurrence']) => void 
}> = ({ recurrence, onChange }) => {
    const frequency = recurrence?.frequency || 'none';

    const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'none') {
            onChange(undefined);
        } else if (val === 'daily') {
            onChange({ frequency: 'daily' });
        } else if (val === 'weekly') {
            onChange({ frequency: 'weekly', weekDays: [1, 3, 5] }); // Default M,W,F
        } else if (val === 'monthly') {
            onChange({ frequency: 'monthly', dayOfMonth: new Date().getDate() });
        }
    };

    const toggleDay = (dayIndex: number) => {
        if (!recurrence || recurrence.frequency !== 'weekly') return;
        const currentDays = recurrence.weekDays || [];
        const newDays = currentDays.includes(dayIndex)
            ? currentDays.filter(d => d !== dayIndex)
            : [...currentDays, dayIndex].sort();
        onChange({ ...recurrence, weekDays: newDays });
    };

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="flex flex-col gap-2 mt-1 bg-slate-50 p-2 rounded border border-slate-100">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Repeat:</span>
                <select 
                    value={frequency}
                    onChange={handleFrequencyChange}
                    className="bg-white border border-slate-200 text-xs rounded px-2 py-1 focus:outline-none"
                >
                    <option value="none">Never (One-off)</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
            </div>
            
            {frequency === 'weekly' && (
                <div className="flex gap-1 justify-between">
                    {days.map((d, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => toggleDay(i)}
                            className={`w-6 h-6 rounded-full text-[10px] font-bold transition-colors ${
                                recurrence?.weekDays?.includes(i) 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-300'
                            }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            )}

            {frequency === 'monthly' && (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">Day of Month:</span>
                    <input 
                        type="number"
                        min="1"
                        max="31"
                        value={recurrence?.dayOfMonth || 1}
                        onChange={(e) => onChange({ ...recurrence!, frequency: 'monthly', dayOfMonth: parseInt(e.target.value) || 1 })}
                        className="w-12 bg-white border border-slate-200 text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
                    />
                </div>
            )}
        </div>
    );
};

const TaskItem: React.FC<{ task: Task; onUpdate: (t: Task) => void; onDelete: (id: string) => void }> = ({ task, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Task>(task);

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(task);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
        <div className="p-3 rounded-lg border border-indigo-200 bg-white shadow-sm mb-2 space-y-2">
            <input 
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full border-slate-200 bg-white rounded px-2 py-1 text-sm font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Task Title"
            />
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={formData.time || ''}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="flex-1 border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                    placeholder="Time (e.g. 10:00 AM)"
                />
                <input 
                    type="text" 
                    value={formData.duration}
                    onChange={(e) => setFormData({...formData, duration: e.target.value})}
                    className="flex-1 border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                    placeholder="Duration"
                />
            </div>
            <div className="flex gap-2">
                <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="flex-1 border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                >
                    <option value="fixed">Fixed</option>
                    <option value="flexible">Flexible</option>
                </select>
                <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                    className="flex-1 border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                >
                    <option value="Career">Career</option>
                    <option value="Life">Life</option>
                    <option value="Health">Health</option>
                    <option value="Family">Family</option>
                </select>
                 <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                    className="flex-1 border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>
            
            <RecurrenceControl 
                recurrence={formData.recurrence} 
                onChange={(r) => setFormData({ ...formData, recurrence: r })} 
            />

             <div className="flex justify-end space-x-2 pt-1 border-t border-slate-100 mt-2">
                <button onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <button onClick={handleSave} className="p-1 text-emerald-600 hover:text-emerald-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
            </div>
        </div>
    );
  }

  const isRecurring = !!task.recurrence;

  return (
    <div className={`group relative flex items-center justify-between p-3 rounded-lg border ${task.type === 'fixed' ? 'border-slate-200 bg-slate-50' : 'border-indigo-100 bg-indigo-50/50'} mb-2`}>
        {/* Action Buttons Group - Always visible on mobile, visible on hover for desktop */}
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity z-10">
            <button 
                onClick={() => setIsEditing(true)}
                className="p-1 bg-white hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 shadow-sm border border-slate-100"
                title="Edit"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button 
                onClick={() => {
                    if(window.confirm('Are you sure you want to delete this task?')) {
                        onDelete(task.id);
                    }
                }}
                className="p-1 bg-white hover:bg-red-50 rounded text-slate-400 hover:text-red-600 shadow-sm border border-slate-100"
                title="Delete"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>

      <div className="flex items-center">
        <div className={`w-1.5 h-8 rounded-full mr-3 ${
            task.category === 'Health' ? 'bg-emerald-400' :
            task.category === 'Career' ? 'bg-indigo-400' :
            task.category === 'Life' ? 'bg-orange-400' : 
            task.category === 'Family' ? 'bg-purple-400' : 'bg-slate-300'
        }`}></div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-800 pr-2">{task.title}</h4>
            {isRecurring && (
                <span className="text-[10px] bg-slate-200 text-slate-500 px-1 rounded flex items-center" title="Recurring Task">
                    <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    {task.recurrence?.frequency === 'daily' ? 'Daily' : task.recurrence?.frequency === 'weekly' ? 'Weekly' : 'Monthly'}
                </span>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center mt-0.5">
              {task.time ? <span className="font-mono bg-white px-1 rounded border border-slate-100 mr-2">{task.time}</span> : null}
              <span>{task.duration}</span>
              {task.category && (
                  <span className="ml-2 px-1.5 py-0.5 bg-white rounded border border-slate-100 text-[10px] uppercase text-slate-400">
                      {task.category}
                  </span>
              )}
          </div>
        </div>
      </div>
      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${task.type === 'fixed' ? 'text-slate-500' : 'text-indigo-500'}`}>
          {task.type}
      </span>
    </div>
  );
};

export const CareerInventoryView: React.FC<Props> = ({ inventory, onUpdateTask, onDeleteTask, onAddTask }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
      title: '',
      type: 'flexible',
      priority: 'medium',
      category: 'Career',
      duration: '1h',
      time: ''
  });

  const handleSaveNew = () => {
      if (!newTask.title) {
          alert("Task title is required");
          return;
      }
      if (onAddTask) {
          onAddTask({
              id: Math.random().toString(36).substr(2, 9),
              title: newTask.title,
              type: newTask.type as 'fixed' | 'flexible',
              priority: newTask.priority as 'high' | 'medium' | 'low',
              category: newTask.category as any,
              duration: newTask.duration || '1h',
              time: newTask.time,
              recurrence: newTask.recurrence
          });
      }
      setIsAdding(false);
      setNewTask({ title: '', type: 'flexible', priority: 'medium', category: 'Career', duration: '1h', time: '' });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between flex-none relative">
        <h2 className="text-lg font-bold text-slate-800 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          Life Inventory
          <InfoTooltip text="Your dynamic task list. The AI balances these items against your personal relationship context to ensure neither your career ambitions nor your loved ones are neglected." />
        </h2>
        {onAddTask && (
            <button 
                 onClick={() => setIsAdding(!isAdding)}
                 className="flex items-center gap-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 hover:border-indigo-300 text-xs font-bold px-3 py-1.5 rounded-md transition-all shadow-sm"
             >
                 <svg className={`w-3.5 h-3.5 transition-transform ${isAdding ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                 {isAdding ? 'Cancel' : 'Add Task'}
            </button>
        )}
      </div>
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
        
        {/* Add Task Form */}
        {isAdding && (
           <div className="p-4 rounded-xl border border-indigo-200 bg-white shadow-md animate-fade-in mb-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Add New Task</h3>
              <div className="space-y-3">
                  <input 
                      type="text" 
                      value={newTask.title}
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      className="w-full border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-sm font-medium border focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-colors"
                      placeholder="Task Title (Required)"
                  />
                  <div className="flex gap-2">
                       <select 
                          value={newTask.type}
                          onChange={(e) => setNewTask({...newTask, type: e.target.value as any})}
                          className="flex-1 border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none"
                      >
                          <option value="fixed">Fixed</option>
                          <option value="flexible">Flexible</option>
                      </select>
                       <input 
                          type="text" 
                          value={newTask.duration}
                          onChange={(e) => setNewTask({...newTask, duration: e.target.value})}
                          className="flex-1 border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none focus:bg-white"
                          placeholder="Duration (e.g. 1h)"
                      />
                  </div>
                  <div className="flex gap-2">
                       <input 
                          type="text" 
                          value={newTask.time}
                          onChange={(e) => setNewTask({...newTask, time: e.target.value})}
                          className="flex-1 border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none focus:bg-white"
                          placeholder="Time (Optional)"
                      />
                       <select 
                          value={newTask.category}
                          onChange={(e) => setNewTask({...newTask, category: e.target.value as any})}
                          className="flex-1 border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none"
                      >
                          <option value="Career">Career</option>
                          <option value="Life">Life</option>
                          <option value="Health">Health</option>
                          <option value="Family">Family</option>
                      </select>
                  </div>
                  <select 
                      value={newTask.priority}
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                      className="w-full border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none"
                  >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                  </select>

                  <RecurrenceControl 
                      recurrence={newTask.recurrence} 
                      onChange={(r) => setNewTask({ ...newTask, recurrence: r })} 
                  />

                  <div className="flex justify-end pt-1">
                      <button 
                          onClick={handleSaveNew} 
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center gap-1"
                      >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Save Task
                      </button>
                  </div>
              </div>
           </div>
        )}

        <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                Hard Anchors (Fixed)
                <InfoTooltip text="Immovable commitments (meetings, appointments, or fixed travel). These are treated as 'hard constraints' that the AI cannot shift, forming the structural skeleton of your daily schedule." />
            </h3>
            {inventory.fixed.map(task => (
                <TaskItem key={task.id} task={task} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
            ))}
            {inventory.fixed.length === 0 && (
                <p className="text-xs text-slate-400 italic pl-2">No fixed events for today.</p>
            )}
        </div>

        <div className="mt-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                Flexible Blocks (Soft)
                <InfoTooltip text="Outcome-oriented tasks (deep work, gym, chores, or social calls). These have no fixed time; the AI's 'Orchestration Engine' intelligently places these in your optimal energy windows based on priority and available gaps between anchors." />
            </h3>
            {inventory.flexible.map(task => (
                <TaskItem key={task.id} task={task} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
            ))}
            {inventory.flexible.length === 0 && (
                 <p className="text-xs text-slate-400 italic pl-2">No flexible tasks for today.</p>
            )}
        </div>
      </div>
    </div>
  );
};
