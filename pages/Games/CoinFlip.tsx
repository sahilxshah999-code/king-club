
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, playCoinFlip } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, Info, Wallet, Coins, History, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue } from 'firebase/database';

type CoinSide = 'HEAD' | 'TAIL';

const IMG_HEAD = "https://uploads.onecompiler.io/43yf4q9cp/4487srcrt/1000134090.png";
const IMG_TAIL = "https://uploads.onecompiler.io/43yf4q9cp/4487srcrt/1000134089.png";

export const CoinFlip = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [loading, setLoading] = useState(false);
    const [onlinePlayers, setOnlinePlayers] = useState(5420);
    
    // Selection
    const [betAmount, setBetAmount] = useState(10);
    const [selectedSide, setSelectedSide] = useState<CoinSide | null>(null);
    
    // Animation State
    const [rotation, setRotation] = useState(0);
    const [resultSide, setResultSide] = useState<CoinSide | null>(null);
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

    useEffect(() => {
        // Fake Players
        setOnlinePlayers(Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000);
        const playerInterval = setInterval(() => {
            setOnlinePlayers(prev => {
                const change = Math.floor(Math.random() * 50) - 20; 
                let next = prev + change;
                if (next < 5000) next = 5000;
                if (next > 20000) next = 20000;
                return next;
            });
        }, 3000);

        const unsub = auth.onAuthStateChanged((u) => {
            if (u) {
                onValue(ref(db, `users/${u.uid}`), snap => {
                    if (snap.exists()) {
                        const val = snap.val();
                        setUser(val);
                        if (val.balance <= 1) {
                            setToast({ message: "Insufficient Access Balance (> ₹1 required)", type: 'error' });
                            setTimeout(() => navigate('/'), 2000);
                        }
                    }
                });
            } else navigate('/login');
        });
        return () => {
            unsub();
            clearInterval(playerInterval);
        };
    }, [navigate]);

    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ message: msg, type });
    };

    const handleFlip = async () => {
        if (!user || loading || isFlipping) return;
        if (!selectedSide) { showToast("Please select HEAD or TAIL"); return; }
        
        const MIN_BET = 5;
        const MAX_BET = 10000;

        if (betAmount < MIN_BET) { showToast(`Minimum balance was ${MIN_BET}`); return; }
        if (betAmount > MAX_BET) { showToast(`Maximum balance was ${MAX_BET}`); return; }
        if (user.balance < betAmount) { showToast("Insufficient Amount"); return; }
        
        setLoading(true);
        setPopup(null);

        // Use any to bypass union type property access errors
        const res: any = await playCoinFlip(user.uid, selectedSide, betAmount);
        
        if (res.success) {
            setIsFlipping(true);
            setResultSide(res.resultSide);
            
            // Logic: Calculate new rotation target
            setRotation(prev => {
                const cycle = 360;
                const extraSpins = 10 * cycle;
                const targetMod = res.resultSide === 'HEAD' ? 0 : 180;
                const currentMod = prev % cycle;
                let distance = targetMod - currentMod;
                if (distance < 0) distance += cycle; 
                return prev + extraSpins + distance;
            });

            // Finish animation after transition duration (1.5s)
            setTimeout(() => {
                setIsFlipping(false);
                if (res.isWin) {
                    setPopup({ type: 'win', amount: res.winAmount });
                } else {
                    setPopup({ type: 'loss', amount: betAmount });
                }
                setLoading(false);
            }, 1500); 
        } else {
            showToast(res.error || "Error");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050a12] text-white flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-[#0a0f1a] border-b border-gold-600/20 flex justify-between items-center shadow-2xl relative z-50">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full text-stone-400 transition-colors"><ChevronLeft/></button>
                <div className="flex flex-col items-center">
                    <h1 className="font-black italic text-lg tracking-widest text-gold-500 uppercase flex items-center gap-2">
                        <History size={16}/> COIN FLIP
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                        <User size={10} className="text-gold-500" />
                        <span className="text-[10px] font-bold text-gold-500">{onlinePlayers.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/60 px-4 py-1.5 rounded-xl border border-gold-500/30 text-gold-400 font-black text-sm shadow-inner flex items-center gap-2">
                        <Wallet size={14} /> ₹{(user?.balance || 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Game Canvas */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#050a12_100%)]">
                {/* 3D Coin Section with Perspective */}
                <div className="relative perspective-[1000px] w-64 h-64 flex items-center justify-center">
                    
                    {/* Outer Container: Handles the Jump/Toss Animation (TranslateY) */}
                    <div className={`relative w-48 h-48 ${isFlipping ? 'animate-coin-toss' : ''}`}>
                        
                        {/* Inner Container: Handles the Spin (RotateY) */}
                        <div 
                            className="w-full h-full transition-transform duration-[1.5s] ease-out"
                            style={{ 
                                transformStyle: 'preserve-3d',
                                transform: `rotateY(${rotation}deg)` 
                            }}
                        >
                            {/* HEADS (Front) */}
                            <div 
                                className="absolute inset-0 w-full h-full rounded-full backface-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                                style={{ 
                                    backfaceVisibility: 'hidden',
                                    WebkitBackfaceVisibility: 'hidden'
                                }}
                            >
                                <img src={IMG_HEAD} alt="HEAD" className="w-full h-full object-cover rounded-full" />
                            </div>

                            {/* TAILS (Back) */}
                            <div 
                                className="absolute inset-0 w-full h-full rounded-full backface-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                                style={{ 
                                    backfaceVisibility: 'hidden',
                                    WebkitBackfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)'
                                }}
                            >
                                <img src={IMG_TAIL} alt="TAIL" className="w-full h-full object-cover rounded-full" />
                            </div>
                        </div>
                    </div>

                    {/* Ground Shadow - Reacts to coin height */}
                    <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 w-48 h-10 bg-black/40 blur-2xl rounded-full scale-y-50 transition-all duration-300 ${isFlipping ? 'opacity-20 scale-50' : 'opacity-100 scale-100'}`}></div>
                </div>

                <div className="mt-16 text-center">
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mb-2">Winning Chance: 55%</p>
                    <p className="text-gold-500 font-black text-2xl drop-shadow-glow">1.9x PAYOUT</p>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-[#0a0f1a] p-6 rounded-t-[3rem] shadow-[0_-15px_60px_rgba(0,0,0,0.9)] border-t border-gold-600/20 relative z-[100]">
                <div className="space-y-6">
                    
                    {/* Selection Tabs */}
                    <div className="flex gap-4">
                        <button 
                            disabled={isFlipping}
                            onClick={() => setSelectedSide('HEAD')}
                            className={`flex-1 py-4 rounded-2xl flex flex-col items-center transition-all border-2 ${
                                selectedSide === 'HEAD' 
                                ? 'bg-gold-500 border-white text-black scale-105 shadow-[0_0_20px_rgba(234,179,8,0.4)]' 
                                : 'bg-black/40 border-gold-500/20 text-gold-500 hover:border-gold-500/50'
                            }`}
                        >
                            <img src={IMG_HEAD} className="w-12 h-12 mb-2 rounded-full shadow-md" alt="Head" />
                            <span className="font-black text-xl uppercase italic">HEAD</span>
                        </button>
                        <button 
                            disabled={isFlipping}
                            onClick={() => setSelectedSide('TAIL')}
                            className={`flex-1 py-4 rounded-2xl flex flex-col items-center transition-all border-2 ${
                                selectedSide === 'TAIL' 
                                ? 'bg-gold-500 border-white text-black scale-105 shadow-[0_0_20px_rgba(234,179,8,0.4)]' 
                                : 'bg-black/40 border-gold-500/20 text-gold-500 hover:border-gold-500/50'
                            }`}
                        >
                            <img src={IMG_TAIL} className="w-12 h-12 mb-2 rounded-full shadow-md" alt="Tail" />
                            <span className="font-black text-xl uppercase italic">TAIL</span>
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div className="bg-black/60 p-5 rounded-3xl border border-white/5 shadow-inner flex items-center justify-between">
                         <div className="flex flex-col">
                            <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">Enter Wager</label>
                            <div className="flex items-center gap-1">
                                <span className="text-gold-500 font-bold text-2xl">₹</span>
                                <input 
                                    type="number" 
                                    disabled={isFlipping}
                                    value={betAmount} 
                                    onChange={e => setBetAmount(Math.max(0, Number(e.target.value)))}
                                    className="bg-transparent text-left font-black text-2xl outline-none w-32 text-white" 
                                />
                            </div>
                         </div>
                         <div className="flex gap-2">
                            {[10, 50, 100, 500].map(v => (
                                <button 
                                    key={v} 
                                    disabled={isFlipping}
                                    onClick={() => setBetAmount(v)} 
                                    className="px-3 py-2 rounded-xl bg-white/5 text-[10px] font-black hover:bg-gold-500 hover:text-black transition border border-white/5 active:scale-90"
                                >
                                    {v}
                                </button>
                            ))}
                         </div>
                    </div>

                    {/* Start Button */}
                    <button 
                        onClick={handleFlip}
                        disabled={loading || isFlipping}
                        className="w-full bg-gradient-to-r from-gold-500 via-gold-400 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-black font-black text-2xl py-6 rounded-[2.2rem] shadow-[0_15px_40px_rgba(234,179,8,0.3)] active:scale-[0.98] transition-all flex flex-col items-center leading-none gap-2 border-b-4 border-gold-800 uppercase tracking-widest"
                    >
                        {isFlipping ? 'FLIPPING COIN...' : 'FLIP COIN'}
                    </button>
                </div>
            </div>

            {popup && (
                <WinLossPopup 
                    type={popup.type} 
                    amount={popup.amount} 
                    onClose={() => setPopup(null)} 
                />
            )}
            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type} 
                    onClose={() => setToast(null)} 
                />
            )}

            <style>{`
                .backface-hidden {
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }
                .drop-shadow-glow {
                    filter: drop-shadow(0 0 10px rgba(234,179,8,0.8));
                }
                @keyframes coin-toss {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-300px) scale(1.5); }
                }
                .animate-coin-toss {
                    animation: coin-toss 1.5s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
            `}</style>
        </div>
    );
};
                                  
