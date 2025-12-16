import React from 'react';
import { X, CheckCircle } from 'lucide-react';

interface PromoSuccessPopupProps {
  message: string;
  amount: number;
  onClose: () => void;
}

export const PromoSuccessPopup: React.FC<PromoSuccessPopupProps> = ({ message, amount, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in perspective-[1000px]">
      <div className="relative w-80 p-8 rounded-3xl text-center transform animate-bounce-slow"
           style={{
               background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
               border: '4px solid #FFD700',
               boxShadow: '0 20px 50px rgba(255, 215, 0, 0.3), inset 0 0 30px rgba(255, 215, 0, 0.2)',
               transformStyle: 'preserve-3d',
               transform: 'rotateX(5deg)'
           }}
      >
        {/* Floating Emojis Background Effect */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none opacity-20">
            <div className="absolute top-4 left-4 text-2xl animate-spin-slow">✨</div>
            <div className="absolute bottom-4 right-4 text-2xl animate-spin-slow">✨</div>
            <div className="absolute top-1/2 left-2 text-3xl animate-bounce">🎉</div>
            <div className="absolute top-10 right-10 text-xl animate-pulse">💰</div>
        </div>

        <button 
            onClick={onClose}
            className="absolute top-3 right-3 text-yellow-500 hover:text-white transition z-20"
        >
            <X size={24} />
        </button>

        <div className="relative z-10">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center shadow-lg mb-4 border-4 border-white/10">
                <CheckCircle size={40} className="text-white drop-shadow-md" />
            </div>

            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 mb-2 uppercase tracking-wider drop-shadow-sm">
                Code Redeemed!
            </h2>
            
            <p className="text-white font-medium text-lg mb-6 leading-relaxed text-shadow-sm">
                {message}
            </p>

            <div className="bg-white/10 p-3 rounded-xl border border-yellow-500/30 mb-2">
                <p className="text-xs text-yellow-500 font-bold uppercase mb-1">Reward Added</p>
                <p className="text-4xl font-black text-white">₹{amount}</p>
            </div>
        </div>
      </div>
    </div>
  );
};
