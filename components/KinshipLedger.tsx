/**
 * DESIGN DECISION: Kinship Ledger Component
 * 
 * This component visualizes and manages the user's relationship network.
 * 
 * Core Concepts:
 * 
 * 1. **Visual Relationship Health**:
 *    - Color-coded status badges (red=critical, amber=overdue, green=stable)
 *    - Priority indicators (1-10 scale, high numbers = more important)
 *    - Days since last contact (time decay visualization)
 * 
 * 2. **Kinship Debt Algorithm Display**:
 *    The UI reflects the mathematical health calculation (Priority × Days).
 *    Users see the formula in action, not just abstract "needs attention" labels.
 * 
 * 3. **Photo-Based Recognition**:
 *    Profile photos enable visual scanning (faster than reading names).
 *    Important for elderly relatives or large networks.
 * 
 * 4. **Zero-Friction Editing**:
 *    - Inline editing (click to modify)
 *    - Auto-save on blur (no "Save" button needed)
 *    - Drag-and-drop image upload
 * 
 * 5. **Category Organization**:
 *    Family / Friends / Network tabs enable mental model alignment:
 *    - Family: Immediate relatives, partners
 *    - Friends: Close personal relationships
 *    - Network: Professional connections, mentors
 * 
 * 6. **AI Integration Affordance**:
 *    "Analyze with AI" button enables photo-based relationship context extraction
 *    (future feature: AI extracts notes from photos of people)
 * 
 * Technical Details:
 * - InfoTooltip: Portal-based tooltips that escape parent overflow constraints
 * - Status config: Centralized styling for consistency
 * - Optimistic UI: Changes immediately visible, saved async
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RelationshipLedger, Person } from '../types';
import { compressImage } from '../services/imageService'; // Used only for profile avatar compression (does not go through handleSendMessage)

interface Props {
  ledger: RelationshipLedger;
  onUpdatePerson: (oldName: string, person: Person) => void;
  onAddPerson: (person: Person) => void;
  onDeletePerson: (name: string) => void;
  onAnalyzePhoto: (name: string, photo: string) => void;
}

const InfoTooltip = ({ text }: { text: string }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Center vertically relative to the icon, move to the right of the icon
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

const getStatusConfig = (status: Person['status']) => {
  switch (status) {
    case 'Critical':
    case 'Needs Attention':
      return {
        containerClass: 'border-red-200 bg-red-50/60 hover:bg-red-50',
        badgeClass: 'bg-white text-red-700 border-red-200 shadow-sm',
        icon: (
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        indicatorColor: 'bg-red-500 ring-red-200'
      };
    case 'Overdue':
      return {
        containerClass: 'border-amber-200 bg-amber-50/60 hover:bg-amber-50',
        badgeClass: 'bg-white text-amber-700 border-amber-200 shadow-sm',
        icon: (
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        indicatorColor: 'bg-amber-500 ring-amber-200'
      };
    case 'Stable':
    default:
      return {
        containerClass: 'border-slate-200 bg-white hover:border-indigo-200',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        icon: (
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        indicatorColor: 'bg-emerald-500 ring-emerald-200'
      };
  }
};

const PersonCard: React.FC<{ 
    person: Person; 
    onUpdate: (p: Person) => void;
    onDelete: () => void;
    onAnalyzePhoto: (name: string, photo: string) => void; 
}> = ({ person, onUpdate, onDelete, onAnalyzePhoto }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Person>(person);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  const config = getStatusConfig(person.status);
  const isUrgent = person.status === 'Critical' || person.status === 'Needs Attention';

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(person);
    setIsEditing(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Invalid file type. Please upload an image.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        // No compression here — handleSendMessage in App.tsx compresses all media
        // before storage and AI send (800×800 @ 0.7). Compressing here would double-compress.
        onAnalyzePhoto(person.name, reader.result);
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Invalid file type. Please upload an image.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) { // 20MB limit — compression handles the rest
      alert('Image is too large. Please upload an image smaller than 20 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (reader.result && typeof reader.result === 'string') {
        try {
          const compressed = await compressImage(reader.result, 400, 400, 0.8);
          setFormData(prev => ({ ...prev, image: compressed }));
        } catch {
          setFormData(prev => ({ ...prev, image: reader.result as string }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  if (isEditing) {
      return (
        <div className={`p-4 rounded-xl border shadow-sm bg-white border-indigo-200 mb-4`}>
            <div className="space-y-3">
                {/* Image Update Section */}
                <div className="flex items-center gap-4 pb-2 border-b border-slate-100">
                    <div className="relative group/img cursor-pointer" onClick={() => editImageInputRef.current?.click()}>
                        <img 
                            src={formData.image || `https://ui-avatars.com/api/?name=${formData.name}`}
                            alt="Preview"
                            className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 group-hover/img:border-indigo-400 transition-colors"
                        />
                        <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                             <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Update Photo</label>
                         <button 
                            onClick={() => editImageInputRef.current?.click()}
                            className="text-xs bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-md border border-slate-200 transition-colors"
                         >
                            Choose File...
                         </button>
                         <input 
                            type="file"
                            ref={editImageInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleProfileImageChange}
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="flex-1 border-slate-200 bg-white rounded px-2 py-1 text-sm font-bold border focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Name"
                    />
                    <select 
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                        className="border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                    >
                        <option value="Family">Family</option>
                        <option value="Friend">Friend</option>
                        <option value="Network">Network</option>
                    </select>
                </div>
                <input 
                    type="text" 
                    value={formData.relation}
                    onChange={(e) => setFormData({...formData, relation: e.target.value})}
                    className="w-full border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                    placeholder="Relation (e.g. Grandmother)"
                />
                <div className="flex gap-2">
                    <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                        className="flex-1 border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                    >
                        <option value="Stable">Stable</option>
                        <option value="Needs Attention">Needs Attention</option>
                        <option value="Critical">Critical</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                    <input 
                        type="number" 
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 3})}
                        className="w-16 border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none"
                        placeholder="Priority"
                        min="1"
                        max="10"
                    />
                </div>
                <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full border-slate-200 bg-white rounded px-2 py-1 text-xs border focus:outline-none resize-none h-16"
                    placeholder="Notes..."
                />
                <div className="flex justify-end space-x-2 pt-1">
                    <button onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <button onClick={handleSave} className="p-1 text-emerald-600 hover:text-emerald-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className={`group relative p-4 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md ${config.containerClass} mb-4`}>
      {/* Action Buttons - Always visible on mobile, visible on hover for desktop */}
      <div className="absolute bottom-2 left-2 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity z-10">
        <button 
            onClick={() => setIsEditing(true)}
            className="p-1.5 bg-white/80 hover:bg-white rounded-full text-slate-400 hover:text-indigo-600 shadow-sm"
            title="Edit Details"
        >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 bg-white/80 hover:bg-white rounded-full text-slate-400 hover:text-indigo-600 shadow-sm"
            title="Upload Photo for Analysis"
        >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 001.664-.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
        <button 
            onClick={() => {
                if(window.confirm(`Are you sure you want to remove ${person.name} from your ledger?`)) {
                    onDelete();
                }
            }}
            className="p-1.5 bg-white/80 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-600 shadow-sm"
            title="Remove Contact"
        >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handlePhotoUpload}
        />
      </div>

      <div className="flex items-start space-x-4">
        {/* Avatar Section */}
        <div className="relative flex-shrink-0">
          <img 
            src={person.image} 
            alt={person.name} 
            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
          />
          {/* Status Dot */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            {isUrgent && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.indicatorColor.split(' ')[0]}`}></span>
            )}
            <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-white ${config.indicatorColor.split(' ')[0]}`}></span>
          </span>
        </div>
        
        {/* Info Section */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1 gap-2">
            <div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">{person.name}</h3>
                <p className="text-slate-500 text-xs font-medium">{person.relation}</p>
            </div>
            
            <div className={`flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${config.badgeClass}`}>
              {config.icon}
              {person.status}
            </div>
          </div>
          
          <div className="mt-2 bg-white/50 rounded-lg p-2.5 border border-black/5">
            <p className="text-sm text-slate-700 leading-snug line-clamp-3">{person.notes}</p>
          </div>
          
          <div className="mt-3 flex items-center justify-between text-xs">
              <span className={`px-2 py-0.5 rounded-md font-semibold border ${
                person.category === 'Family' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                person.category === 'Friend' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100'
              }`}>
                 {person.category}
              </span>
              
              <div className="flex items-center text-slate-400 font-medium bg-white/50 px-2 py-0.5 rounded-full border border-slate-100">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {new Date(person.last_contact).toLocaleString(undefined, { month: 'short', day: 'numeric' })}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const KinshipLedgerView: React.FC<Props> = ({ ledger, onUpdatePerson, onAddPerson, onDeletePerson, onAnalyzePhoto }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newPerson, setNewPerson] = useState<Partial<Person>>({
      category: 'Network',
      status: 'Stable',
      priority: 3,
      relation: '',
      name: '',
      notes: ''
  });

  const handleSaveNew = () => {
    if (!newPerson.name || !newPerson.relation) {
        alert("Name and Relation are required");
        return;
    }
    onAddPerson({
        name: newPerson.name!,
        relation: newPerson.relation!,
        category: newPerson.category as any || 'Network',
        priority: newPerson.priority || 3,
        notes: newPerson.notes || '',
        status: newPerson.status as any || 'Stable',
        last_contact: new Date().toISOString(),
        image: `https://ui-avatars.com/api/?name=${newPerson.name}&background=random`
    });
    setIsAdding(false);
    setNewPerson({
        category: 'Network',
        status: 'Stable',
        priority: 3,
        relation: '',
        name: '',
        notes: ''
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between flex-none relative">
        <div className="flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              Kinship Ledger
              <InfoTooltip text="This active ledger tracks relationship health based on priority and recency. The AI uses this data to proactively suggest calls or visits during gaps in your schedule." />
            </h2>
            <div className="flex items-center space-x-1.5 mt-1 ml-7">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live Monitor</span>
            </div>
        </div>
        
        <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 hover:border-indigo-300 text-xs font-bold px-3 py-1.5 rounded-md transition-all shadow-sm"
        >
            <svg className={`w-3.5 h-3.5 transition-transform ${isAdding ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {isAdding ? 'Cancel' : 'Add Contact'}
        </button>
      </div>
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
        {/* Add New Contact Form */}
        {isAdding && (
           <div className="p-4 rounded-xl border border-indigo-200 bg-white shadow-md animate-fade-in mb-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Add New Contact</h3>
              <div className="space-y-3">
                  <div className="flex gap-2">
                      <input 
                          type="text" 
                          value={newPerson.name}
                          onChange={(e) => setNewPerson({...newPerson, name: e.target.value})}
                          className="flex-1 border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-sm font-medium border focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-colors"
                          placeholder="Name (Required)"
                      />
                      <select 
                          value={newPerson.category}
                          onChange={(e) => setNewPerson({...newPerson, category: e.target.value as any})}
                          className="border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none"
                      >
                          <option value="Family">Family</option>
                          <option value="Friend">Friend</option>
                          <option value="Network">Network</option>
                      </select>
                  </div>
                  <div className="flex gap-2">
                       <input 
                          type="text" 
                          value={newPerson.relation}
                          onChange={(e) => setNewPerson({...newPerson, relation: e.target.value})}
                          className="flex-[2] border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none focus:bg-white"
                          placeholder="Relation (e.g. Aunt, Coworker)"
                      />
                       <input 
                          type="number" 
                          value={newPerson.priority}
                          onChange={(e) => setNewPerson({...newPerson, priority: parseInt(e.target.value) || 3})}
                          className="flex-1 border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none focus:bg-white"
                          placeholder="Priority (1-10)"
                          min="1"
                          max="10"
                      />
                  </div>
                  <select 
                      value={newPerson.status}
                      onChange={(e) => setNewPerson({...newPerson, status: e.target.value as any})}
                      className="w-full border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none"
                  >
                      <option value="Stable">Stable</option>
                      <option value="Needs Attention">Needs Attention</option>
                      <option value="Critical">Critical</option>
                      <option value="Overdue">Overdue</option>
                  </select>
                  <textarea 
                      value={newPerson.notes}
                      onChange={(e) => setNewPerson({...newPerson, notes: e.target.value})}
                      className="w-full border-slate-200 bg-slate-50 rounded px-2 py-1.5 text-xs border focus:outline-none focus:bg-white resize-none h-20"
                      placeholder="Initial notes..."
                  />
                  <div className="flex justify-end pt-1">
                      <button 
                          onClick={handleSaveNew} 
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center gap-1"
                      >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Save Contact
                      </button>
                  </div>
              </div>
           </div>
        )}

        <div>
          {(Object.values(ledger) as Person[])
            .sort((a, b) => a.priority - b.priority)
            .map((person) => (
            <PersonCard 
              key={person.name} 
              person={person} 
              onUpdate={(updated) => onUpdatePerson(person.name, updated)}
              onDelete={() => onDeletePerson(person.name)}
              onAnalyzePhoto={onAnalyzePhoto}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
