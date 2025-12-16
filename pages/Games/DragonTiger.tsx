import React, { useState, useEffect } from 'react';
import { auth } from '../../firebase';
import { getUserProfile, playDragonTiger } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, Info, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';

export const DragonTiger = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [dealing, setDealing] = useState(false);
    const [result, setResult] = useState<{dragon: number, tiger: number} | null>(null);
    
    // Betting State
    const [selectedZone, setSelectedZone] = useState<'dragon' | 'tiger' | 'tie' | null>(null);
    const [customAmount, setCustomAmount] = useState<string>('10');
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);

    useEffect(() => {
        const u = auth.currentUser;
        if (u) getUserProfile(u.uid).then(setUser);
    }, []);

    const handleBet = async () => {
        if (!user || !selectedZone || dealing) {
            if (!selectedZone) alert("Please select a betting zone (Dragon, Tiger, or Tie)");
            return;
        }
        
        const amount = parseInt(customAmount);
        
        // Validation
        if (isNaN(amount) || amount < 1) {
            alert("Minimum bet is ₹1");
            return;
        }
        if (amount > 10000) {
            alert("Maximum bet is ₹10,000");
            return;
        }
        if (user.balance < amount) {
            alert("Insufficient Balance");
            return;
        }

        setDealing(true);
        setResult(null);
        setPopup(null);

        const res = await playDragonTiger(user.uid, selectedZone, amount);

        if (!res.success || !res.dragonCard || !res.tigerCard) {
            setDealing(false);
            alert(res.error);
            return;
        }

        setUser(prev => prev ? {...prev, balance: res.newBalance || prev.balance} : null);

        // Animation Delay
        setTimeout(() => {
            setResult({ dragon: res.dragonCard!, tiger: res.tigerCard! });
            setDealing(false);
            
            if (res.winAmount && res.winAmount > 0) {
                setPopup({ type: 'win', amount: res.winAmount });
            } else {
                setPopup({ type: 'loss', amount: amount });
            }
        }, 2000);
    };

    const getCardDisplay = (val: number) => {
        const suits = ['♠', '♥', '♣', '♦'];
        const suit = suits[Math.floor(Math.random() * 4)];
        const names = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const isRed = suit === '♥' || suit === '♦';
        return (
            <div className={`w-16 h-24 md:w-20 md:h-28 bg-white rounded shadow-2xl flex flex-col items-center justify-center border border-gray-300 ${isRed ? 'text-red-600' : 'text-black'}`}>
                <span className="text-xl font-bold leading-none">{names[val-1]}</span>
                <span className="text-2xl leading-none">{suit}</span>
            </div>
        );
    };

    // Card Back for dealing animation
    const CardBack = () => (
        <div className="w-16 h-24 md:w-20 md:h-28 bg-blue-800 rounded border-2 border-white shadow-xl flex items-center justify-center">
            <div className="w-10 h-16 border border-white/30 rounded-sm"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black flex flex-col items-center overflow-hidden font-sans">
             {/* Header */}
             <div className="w-full bg-gradient-to-b from-gray-900 to-black p-2 flex justify-between items-center text-white border-b border-gray-800 z-30">
                <button onClick={() => navigate('/')} className="bg-gray-800 p-1.5 rounded-lg border border-gray-600"><ChevronLeft size={20}/></button>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-400">Balance</span>
                    <span className="font-mono font-bold text-green-400">₹{(user?.balance || 0).toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                    <Settings size={20} className="text-gray-400" />
                    <Info size={20} className="text-gray-400" />
                </div>
            </div>

            {/* Game Table Area */}
            <div className="relative flex-1 w-full bg-[#0a4725] flex flex-col items-center shadow-inner overflow-hidden">
                {/* Table Felt Texture/Vignette */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,255,255,0.1)_0%,_rgba(0,0,0,0.4)_100%)] pointer-events-none"></div>
                
                {/* Dealer Area */}
                <div className="w-full flex justify-center pt-8 pb-4 relative z-10">
                    <div className="w-64 h-24 bg-black/20 rounded-full border-4 border-yellow-600/30 flex items-center justify-center shadow-lg backdrop-blur-sm">
                         <span className="text-yellow-600/50 font-bold text-xl tracking-widest">DEALER</span>
                    </div>
                    {/* Deck */}
                    <div className="absolute top-4 right-10 -rotate-12">
                         <div className="w-16 h-24 bg-red-800 rounded-lg border-l-4 border-b-4 border-red-900 shadow-2xl"></div>
                         <div className="absolute top-0 left-0 w-16 h-24 bg-blue-700 rounded-lg border border-white flex items-center justify-center">
                            <span className="text-white/20 font-bold text-xs">CASINO</span>
                         </div>
                    </div>
                </div>

                {/* Main Bet Zones */}
                <div className="flex-1 w-full flex items-center justify-center gap-2 px-2 relative z-10">
                    
                    {/* DRAGON ZONE */}
                    <div 
                        onClick={() => !dealing && setSelectedZone('dragon')}
                        className={`flex-1 max-w-[150px] aspect-[3/4] rounded-xl border-4 transition-all cursor-pointer relative flex flex-col items-center justify-end p-2 pb-6 group ${selectedZone === 'dragon' ? 'border-yellow-400 bg-green-800 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'border-yellow-600/30 bg-black/10 hover:bg-black/20'}`}
                    >
                        {/* Card Placeholder / Result */}
                        <div className="absolute top-8 left-1/2 -translate-x-1/2">
                            {result ? getCardDisplay(result.dragon) : (dealing ? <div className="animate-slide-up"><CardBack /></div> : <div className="w-16 h-24 border-2 border-dashed border-white/10 rounded"></div>)}
                        </div>

                        {/* Zone Label */}
                        <div className="text-center mt-24">
                            <h2 className={`text-xl font-black uppercase tracking-wider ${selectedZone === 'dragon' ? 'text-yellow-400' : 'text-red-500'}`}>Dragon</h2>
                            <span className="text-4xl text-red-600 opacity-50 font-serif">龍</span>
                        </div>
                        
                        {/* Chip Marker if Selected */}
                        {selectedZone === 'dragon' && (
                            <div className="absolute bottom-2 w-8 h-8 rounded-full bg-white border-4 border-red-500 shadow-lg flex items-center justify-center z-20">
                                <span className="text-[10px] font-bold">Bet</span>
                            </div>
                        )}
                    </div>

                    {/* TIE ZONE (Middle) */}
                    <div className="flex flex-col gap-4 h-full justify-center">
                         <div className="text-center text-yellow-600/50 font-bold text-xs tracking-[0.2em] vertical-text opacity-50">VS</div>
                         
                         <div 
                            onClick={() => !dealing && setSelectedZone('tie')}
                            className={`w-20 h-24 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center relative ${selectedZone === 'tie' ? 'border-green-400 bg-green-900 shadow-[0_0_15px_rgba(74,222,128,0.4)]' : 'border-green-700/30 bg-black/10'}`}
                         >
                            <span className="text-green-400 font-bold text-lg">TIE</span>
                            <span className="text-green-300 text-xs">8:1</span>
                            
                            {selectedZone === 'tie' && (
                                <div className="absolute -bottom-3 w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow-lg z-20"></div>
                            )}
                         </div>
                    </div>

                    {/* TIGER ZONE */}
                    <div 
                        onClick={() => !dealing && setSelectedZone('tiger')}
                        className={`flex-1 max-w-[150px] aspect-[3/4] rounded-xl border-4 transition-all cursor-pointer relative flex flex-col items-center justify-end p-2 pb-6 group ${selectedZone === 'tiger' ? 'border-yellow-400 bg-green-800 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'border-yellow-600/30 bg-black/10 hover:bg-black/20'}`}
                    >
                        {/* Card Placeholder / Result */}
                        <div className="absolute top-8 left-1/2 -translate-x-1/2">
                             {result ? getCardDisplay(result.tiger) : (dealing ? <div className="animate-slide-up"><CardBack /></div> : <div className="w-16 h-24 border-2 border-dashed border-white/10 rounded"></div>)}
                        </div>

                        {/* Zone Label */}
                        <div className="text-center mt-24">
                            <h2 className={`text-xl font-black uppercase tracking-wider ${selectedZone === 'tiger' ? 'text-yellow-400' : 'text-yellow-500'}`}>Tiger</h2>
                            <span className="text-4xl text-yellow-500 opacity-50 font-serif">虎</span>
                        </div>

                         {/* Chip Marker if Selected */}
                         {selectedZone === 'tiger' && (
                            <div className="absolute bottom-2 w-8 h-8 rounded-full bg-white border-4 border-yellow-500 shadow-lg flex items-center justify-center z-20">
                                <span className="text-[10px] font-bold">Bet</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="w-full bg-[#1a1a1a] p-4 pb-8 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-20 border-t border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                        <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Bet Amount</label>
                        <div className="flex items-center bg-gray-800 rounded-lg border border-gray-600 overflow-hidden w-40">
                            <span className="pl-3 text-yellow-500 font-bold">₹</span>
                            <input 
                                type="number" 
                                value={customAmount}
                                onChange={(e) => setCustomAmount(e.target.value)}
                                className="w-full bg-transparent p-2 text-white font-bold outline-none"
                                placeholder="1-10000"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {[10, 50, 100, 500].map(amt => (
                             <button 
                                key={amt}
                                onClick={() => setCustomAmount(amt.toString())}
                                className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-600 text-xs font-bold text-gray-400 hover:bg-gray-700 hover:text-white transition"
                             >
                                 {amt}
                             </button>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleBet}
                    disabled={dealing}
                    className={`w-full py-4 rounded-xl font-black text-xl tracking-widest shadow-lg transition active:scale-95 ${dealing ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-black shadow-yellow-600/20'}`}
                >
                    {dealing ? 'DEALING...' : 'BET'}
                </button>
            </div>

            {popup && (
                <WinLossPopup 
                    type={popup.type} 
                    amount={popup.amount} 
                    onClose={() => setPopup(null)} 
                />
            )}
        </div>
    );
};
