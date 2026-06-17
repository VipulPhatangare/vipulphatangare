import { useState } from 'react';

export function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}${t.hiding ? ' toast-hide' : ''}`}>
          <i className={t.icon}></i>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', icon = 'fas fa-info-circle') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, icon, hiding: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, hiding: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
    }, 3000);
  };

  return { toasts, addToast };
}
