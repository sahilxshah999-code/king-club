import React, { useEffect, useState } from 'react';
import { X, Sparkles, PartyPopper } from 'lucide-react';
import { UserProfile, SystemSettings } from '../types';
import { processPlaceholders, markWelcomeAsSeen } from '../services/userService';

interface WelcomePopupProps {
  user: UserProfile;
  settings: SystemSettings;
  onClose: () => void;
}

export const WelcomePopup: React.FC<WelcomePopupProps> = ({ user, settings, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = async () => {
    setIsVisible(false);
    await markWelcomeAsSeen(user.uid);
    onClose();
  };

  if (!isVisible || !settings.welcomeMessage) return null;

  const displayMessage = processPlaceholders(settings.welcomeMessage, user);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in px-6">
      <div className="relative w-full max-w-sm p-8 rounded-[2.5rem] text-center transform animate-slide-up border-4 border-gold-500 shadow-[0_0_50px_rgba(234,179,8,0.3)]"
           style={{
               background: 'linear-gradient(135deg, #0d0e10 0%, #1a1a1a 100%)'
           }}
      >
        {/* Decorative elements */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-24 h-24 bg-gold-500 rounded-full flex items-center justify-center shadow-lg border-4 border-[#0d0e10]">
             <PartyPopper size={48} className="text-white" />
        </div>

        <div className="mt-10">
            <h2 className="text-2xl font-black text-gold-500 mb-4 uppercase tracking-tighter italic">Welcome to King Club!</h2>
            <p className="text-white font-medium text-lg leading-relaxed mb-8">
                {displayMessage}
            </p>
            
            <button 
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-[#d93025] to-[#8a1414] text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest border-b-4 border-black/20"
            >
                CLOSE
            </button>
            <p className="mt-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-50">Auto-closing in 5 seconds...</p>
        </div>
        
        <div className="absolute top-4 right-4 text-gold-500/20 animate-pulse"><Sparkles size={32} /></div>
        <div className="absolute bottom-4 left-4 text-gold-500/20 animate-pulse delay-500"><Sparkles size={24} /></div>
      </div>
    </div>
  );
};
