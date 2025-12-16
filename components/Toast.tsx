import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const getIcon = () => {
    switch (type) {
      case 'error': return <XCircle size={16} />;
      case 'info': return <Info size={16} />;
      default: return <CheckCircle size={16} />;
    }
  };

  const getBgColor = () => {
      switch (type) {
          case 'error': return 'bg-red-500';
          case 'info': return 'bg-blue-500';
          default: return 'bg-green-500';
      }
  }

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 animate-slide-up border border-white/10 min-w-max whitespace-nowrap">
        <div className={`${getBgColor()} rounded-full p-1 text-black`}>
            {getIcon()}
        </div>
        <span className="font-bold text-sm tracking-wide">{message}</span>
    </div>
  );
};
