
import React from 'react';
import { X, Megaphone } from 'lucide-react';
import { UserProfile } from '../types';
import { processPlaceholders } from '../services/userService';

interface LoginPopupProps {
  user: UserProfile;
  title?: string;
  message?: string;
  onClose: () => void;
}

export const LoginPopup: React.FC<LoginPopupProps> = ({ user, title, message, onClose }) => {
  const handleClose = () => {
    sessionStorage.setItem('seenLoginBanner', 'true');
    onClose();
  };

  const displayMessage = message ? processPlaceholders(message, user) : '';

  if (!displayMessage) return null;

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-fade-in">
      <div className="relative w-full max-w-sm rounded-[2.5rem] bg-white text-center shadow-2xl overflow-hidden transform animate-slide-up border-4 border-white/20">
        
        {/* Header Graphic */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 pt-8 pb-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle,_rgba(255,255,255,0.1)_1px,_transparent_1px)] bg-[length:10px_10px] opacity-30"></div>
            <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 shadow-lg border border-white/30 transform rotate-3">
                    <Megaphone size={32} className="text-white drop-shadow-md" fill="currentColor" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest drop-shadow-md">
                    {title || 'Announcement'}
                </h2>
            </div>
            
            {/* Decorative waves */}
            <div className="absolute bottom-0 left-0 w-full h-12 bg-white rounded-t-[50%] transform translate-y-6 scale-x-150"></div>
        </div>

        {/* Content Body */}
        <div className="px-8 pb-8 pt-2 relative z-10">
            <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
                <p className="text-gray-600 font-medium text-sm leading-relaxed whitespace-pre-line">
                    {displayMessage}
                </p>
            </div>

            <button 
                onClick={handleClose}
                className="mt-6 w-full bg-black text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition hover:bg-gray-900 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
                <X size={16} /> Close
            </button>
        </div>
      </div>
    </div>
  );
};
