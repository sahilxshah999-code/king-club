
import React, { useEffect } from 'react';
import { X, Rocket, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface WinLossPopupProps {
  type: 'win' | 'loss';
  amount: number;
  onClose: () => void;
  // Wingo Specific Props
  gameMode?: 'wingo';
  periodId?: string;
  result?: {
    number: number;
    color: string;
    size: string;
  };
}

export const WinLossPopup: React.FC<WinLossPopupProps> = ({ type, amount, onClose, gameMode, periodId, result }) => {
  useEffect(() => {
    // Auto-close after 3 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isWin = type === 'win';

  // --- WINGO SPECIFIC LAYOUT ---
  if (gameMode === 'wingo' && result && periodId) {
      const isGreen = result.color.includes('green');
      const isRed = result.color.includes('red');
      const isViolet = result.color.includes('violet');
      
      // Determine color classes for badges
      let colorBg = 'bg-gray-500';
      if (isGreen) colorBg = 'bg-[#28C76F]';
      if (isRed) colorBg = 'bg-[#EA5455]';
      if (isViolet) colorBg = 'bg-[#7367F0]';
      // Dual color handling (Gradient)
      if (isGreen && isViolet) colorBg = 'bg-gradient-to-r from-[#28C76F] to-[#7367F0]';
      if (isRed && isViolet) colorBg = 'bg-gradient-to-r from-[#EA5455] to-[#7367F0]';

      const sizeBg = result.size === 'big' ? 'bg-[#FF9F43]' : 'bg-[#4A90E2]';

      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
            <div className="w-full max-w-sm relative flex flex-col items-center animate-bounce-slow">
                
                {/* Header Graphic (Simulated) */}
                <div className={`relative z-20 w-32 h-32 rounded-full flex items-center justify-center -mb-16 border-4 border-white shadow-2xl ${isWin ? 'bg-gradient-to-b from-yellow-300 to-orange-500' : 'bg-gradient-to-b from-gray-200 to-blue-200'}`}>
                    {isWin ? (
                        <Rocket size={64} className="text-white drop-shadow-md" fill="currentColor" />
                    ) : (
                        <ShieldAlert size={64} className="text-gray-500 drop-shadow-md" fill="currentColor" />
                    )}
                </div>

                {/* Main Card */}
                <div className={`w-full rounded-[2rem] pt-20 pb-8 px-6 text-center shadow-2xl relative overflow-hidden ${isWin ? 'bg-gradient-to-b from-[#FFA048] to-[#FF4E2F]' : 'bg-white'}`}>
                    
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,_transparent_20%,_#000_20%)] bg-[length:10px_10px]"></div>

                    {/* Title */}
                    <h2 className={`text-3xl font-black uppercase italic tracking-wider mb-6 relative z-10 ${isWin ? 'text-white drop-shadow-md' : 'text-slate-500'}`}>
                        {isWin ? 'Congratulations' : 'Sorry'}
                    </h2>

                    {/* Result Row */}
                    <div className="flex items-center justify-between mb-6 relative z-10 bg-black/10 rounded-xl p-2 px-3">
                        <span className={`text-[10px] font-bold uppercase ${isWin ? 'text-white/80' : 'text-gray-500'}`}>Lottery Results</span>
                        <div className="flex gap-1.5">
                            {/* Color Badge */}
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-white shadow-sm ${colorBg}`}>
                                {isGreen ? 'Green' : isRed ? 'Red' : 'Violet'}
                            </div>
                            {/* Number Badge */}
                            <div className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-black text-white shadow-sm ${colorBg}`}>
                                {result.number}
                            </div>
                            {/* Size Badge */}
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-white shadow-sm ${sizeBg}`}>
                                {result.size}
                            </div>
                        </div>
                    </div>

                    {/* Ticket/Amount Card */}
                    <div className="relative z-10 bg-white rounded-xl p-6 shadow-lg mx-2 mb-4 border-b-4 border-black/5">
                        {/* Cutout visuals for ticket effect */}
                        <div className="absolute top-1/2 -left-3 w-6 h-6 bg-[#FF4E2F] rounded-full"></div>
                        <div className="absolute top-1/2 -right-3 w-6 h-6 bg-[#FF4E2F] rounded-full"></div>

                        {isWin ? (
                            <>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Bonus</p>
                                <p className="text-3xl font-black text-[#d93025]">₹{amount.toFixed(2)}</p>
                            </>
                        ) : (
                            <p className="text-3xl font-black text-gray-400 uppercase tracking-widest">Lose</p>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                            <p className="text-[10px] text-gray-400 font-medium">Period: WinGo 1 Min</p>
                            <p className="text-[10px] text-gray-500 font-mono font-bold">{periodId}</p>
                        </div>
                    </div>

                    {/* Auto Close Timer */}
                    <div className={`flex items-center justify-center gap-2 text-[10px] font-bold uppercase relative z-10 ${isWin ? 'text-white/80' : 'text-gray-400'}`}>
                        <CheckCircle2 size={14} />
                        <span>3 seconds auto close</span>
                    </div>
                </div>

                {/* Close Button */}
                <button onClick={onClose} className="mt-6 bg-white/20 hover:bg-white/30 p-2 rounded-full text-white transition backdrop-blur-md border border-white/30">
                    <X size={24} />
                </button>
            </div>
        </div>
      );
  }

  // --- DEFAULT LAYOUT (For other games) ---
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-72 p-6 rounded-3xl shadow-2xl text-center transform scale-100 animate-bounce-slow border-4 ${isWin ? 'bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-600 border-yellow-200' : 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 border-gray-300'}`}>
        
        <button 
            onClick={onClose}
            className="absolute top-2 right-2 bg-black/20 hover:bg-black/30 text-white rounded-full p-1 transition"
        >
            <X size={16} />
        </button>

        <div className="text-6xl mb-2 filter drop-shadow-md transform hover:scale-110 transition">
          {isWin ? '🤑' : '😢'}
        </div>

        <h2 className={`text-2xl font-black uppercase italic tracking-wider mb-2 ${isWin ? 'text-white drop-shadow-md' : 'text-gray-700'}`}>
          {isWin ? 'You Won!' : 'You Lost'}
        </h2>

        <div className={`text-4xl font-black mb-4 ${isWin ? 'text-white drop-shadow-sm' : 'text-gray-800'}`}>
          {isWin ? '+' : '-'}₹{amount.toFixed(2)}
        </div>

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
                      
