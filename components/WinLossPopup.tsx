import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface WinLossPopupProps {
  type: 'win' | 'loss';
  amount: number;
  onClose: () => void;
}

export const WinLossPopup: React.FC<WinLossPopupProps> = ({ type, amount, onClose }) => {
  useEffect(() => {
    // Auto-close after 3 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isWin = type === 'win';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-72 p-6 rounded-3xl shadow-2xl text-center transform scale-100 animate-bounce-slow border-4 ${isWin ? 'bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-600 border-yellow-200' : 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 border-gray-300'}`}>
        
        {/* Manual Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-2 right-2 bg-black/20 hover:bg-black/30 text-white rounded-full p-1 transition"
        >
            <X size={16} />
        </button>

        {/* Header Icon/Emoji */}
        <div className="text-6xl mb-2 filter drop-shadow-md transform hover:scale-110 transition">
          {isWin ? '🤑' : '😢'}
        </div>

        {/* Title */}
        <h2 className={`text-2xl font-black uppercase italic tracking-wider mb-2 ${isWin ? 'text-white drop-shadow-md' : 'text-gray-700'}`}>
          {isWin ? 'You Won!' : 'You Lost'}
        </h2>

        {/* Amount */}
        <div className={`text-4xl font-black mb-4 ${isWin ? 'text-white drop-shadow-sm' : 'text-gray-800'}`}>
          {isWin ? '+' : '-'}₹{amount.toFixed(2)}
        </div>

        {/* Decorative elements */}
        {isWin && (
          <>
            <div className="absolute -top-4 -left-4 text-4xl animate-bounce delay-100">🎉</div>
            <div className="absolute -bottom-4 -right-4 text-4xl animate-bounce delay-300">💰</div>
            <div className="absolute top-1/2 left-2 text-2xl animate-pulse">✨</div>
            <div className="absolute top-1/2 right-2 text-2xl animate-pulse delay-75">✨</div>
          </>
        )}
        {!isWin && (
           <>
            <div className="absolute -top-6 -right-2 text-4xl animate-pulse">💸</div>
            <div className="absolute -bottom-2 -left-4 text-3xl">📉</div>
          </>
        )}
      </div>
    </div>
  );
};
