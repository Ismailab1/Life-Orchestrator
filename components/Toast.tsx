
import React, { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onRemove }) => {
  useEffect(() => {
    if (toasts.length === 0) return;
    
    const timers = toasts.map(toast => {
      const duration = toast.duration || 5000;
      return setTimeout(() => onRemove(toast.id), duration);
    });
    
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [toasts, onRemove]);
  
  if (toasts.length === 0) return null;
  
  const getToastStyles = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };
  
  const getIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} px-4 py-3 rounded-lg border shadow-lg flex items-start gap-3 animate-slide-in`}
        >
          <span className="text-lg font-semibold flex-shrink-0">{getIcon(toast.type)}</span>
          <p className="flex-1 text-sm whitespace-pre-wrap">{toast.message}</p>
          <button
            onClick={() => onRemove(toast.id)}
            className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

// Helper hook to manage toast messages
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const addToast = (message: string, type: ToastMessage['type'] = 'info', duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  return {
    toasts,
    addToast,
    removeToast,
    showSuccess: (msg: string, duration?: number) => addToast(msg, 'success', duration),
    showError: (msg: string, duration?: number) => addToast(msg, 'error', duration),
    showWarning: (msg: string, duration?: number) => addToast(msg, 'warning', duration),
    showInfo: (msg: string, duration?: number) => addToast(msg, 'info', duration),
  };
};
