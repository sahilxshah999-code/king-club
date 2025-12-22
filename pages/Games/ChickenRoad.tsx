
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, startChickenRoadGame, advanceChickenRoad, cashOutChickenRoad } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, Info, Menu, ShieldAlert, Zap, History, Bird, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue, remove } from 'firebase/database';

const DIFFICULTY_MAP = {
    EASY: [1.05, 1.15, 1.30, 1.50, 1.80, 2.20, 2.80, 3.50],
    MEDIUM: [1.20, 1.45, 1.80, 2.30, 3.00, 4.00, 5.50, 8.00],
    HARD: [1.50, 2.20, 3.50, 5.50, 9.00, 15.00, 25.00, 50.00],
    HARDCORE: [2.00, 5.00, 12.00, 30.00, 80.00, 200.00, 500.00, 1000.00]
};

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Hardcore'];

// Provided Images
const IMG_CHICKEN_PLAYING = "https://uploads.onecompiler.io/43yf4q9cp/4482kdrxk/1000133802.webp";
const IMG_CHICKEN_DEAD = "https://uploads.onecompiler.io/43yf4q9cp/4482kdrxk/1000133805.png";
const IMG_BACKGROUND = "chicken-road.png";

export const ChickenRoad = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [isDead, setIsDead] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Game State
    const [betAmount, setBetAmount] = useState(5);
    const [stage, setStage] = useState(0); 
    const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | 'HARDCORE'>('EASY');
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    
    // Fake Active Players State
    const [activePlayers, setActivePlayers] = useState(4812);

    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setActivePlayers(Math.floor(Math.random() * (5500 - 4200 + 1)) + 4200);

        const playerInterval = setInterval(() => {
            setActivePlayers(prev => {
                const change = Math.floor(Math.random() * 41) - 20; 
                let next = prev + change;
                if (next < 4005) next = 4005 + Math.floor(Math.random() * 50); 
                return next;
            });
        }, 3000);

        const unsubAuth = auth.onAuthStateChanged((u) => {
            if (u) {
                const userRef = ref(db, `users/${u.uid}`);
                onValue(userRef, (snap) => { 
                    if (snap.exists()) {
                        const val = snap.val();
                        setUser(val); 
                        if (val.balance <= 1) {
                            setToast({ message: "Insufficient Access Balance (> ₹1 required)", type: 'error' });
                            setTimeout(() => navigate('/'), 2000);
                        }
                    }
                });
                
                const gameRef = ref(db, `active_games/chickenroad/${u.uid}`);
                onValue(gameRef, (snap) => {
                    const val = snap.val();
                    if(val) {
                        if (val.status === 'ACTIVE') {
                            setIsActive(true);
                            setIsDead(false);
                            setBetAmount(val.betAmount);
                            setStage(val.stage);
                            setDifficulty(val.difficulty || 'EASY');
                        } else if (val.status === 'LOST') {
                            setIsActive(false);
                            setIsDead(true);
                            setStage(val.stage);
                        }
                    } else {
                        setIsActive(false);
                        setIsDead(false);
                        setStage(0);
                    }
                });
            } else { navigate('/login'); }
        });
        return () => {
            unsubAuth();
            clearInterval(playerInterval);
        };
    }, [navigate]);

    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ message: msg, type });
    };

    useEffect(() => {
        if (trackRef.current) {
            const chickenPos = stage * 96; 
            const containerWidth = trackRef.current.parentElement?.clientWidth || 300;
            const centerOffset = containerWidth / 2 - 48; 
            
            let scrollPos = chickenPos - centerOffset;
            scrollPos = Math.max(0, scrollPos);
            
            trackRef.current.parentElement?.scrollTo({
                left: scrollPos,
                behavior: 'smooth'
            });
        }
    }, [stage]);

    const handleStart = async () => {
        if (!user || loading) return;
        const MIN_BET = 5;
        const MAX_BET = 10000;

        if (betAmount < MIN_BET) { showToast(`Minimum balance was ${MIN_BET}`); return; }
        if (betAmount > MAX_BET) { showToast(`Maximum balance was ${MAX_BET}`); return; }
        if (user.balance < betAmount) { showToast("Insufficient Amount"); return; }

        setLoading(true);
        if (isDead) {
            await remove(ref(db, `active_games/chickenroad/${user.uid}`));
        }

        try {
            const res = await startChickenRoadGame(user.uid, betAmount, difficulty);
            if (!res.success) showToast((res as any).error || "Failed to start");
        } catch (e: any) {
            showToast(e.message);
        }
        setLoading(false);
    };

    const handleNext = async () => {
        if (!user || !isActive || loading) return;
        setLoading(true);
        const res: any = await advanceChickenRoad(user.uid);
        if (res.success) {
            if (res.hit) {
                setPopup({ type: 'loss', amount: betAmount });
            } else {
                const newStage = res.newStage;
                setStage(newStage);

                const maxStages = DIFFICULTY_MAP[difficulty].length;
                if (newStage >= maxStages) {
                    setTimeout(async () => {
                        const finalMult = DIFFICULTY_MAP[difficulty][newStage - 1];
                        const cashoutRes = await cashOutChickenRoad(user.uid, finalMult);
                        if (cashoutRes.success && cashoutRes.amount) {
                            setPopup({ type: 'win', amount: cashoutRes.amount });
                        }
                    }, 800); 
                }
            }
        } else {
            showToast(res.error);
        }
        setLoading(false);
    };

    const handleCashout = async () => {
        if (!user || !isActive || loading || stage === 0) return;
        setLoading(true);
        const currentMult = DIFFICULTY_MAP[difficulty][stage - 1] || 1;
        const res = await cashOutChickenRoad(user.uid, currentMult);
        if (res.success && res.amount) {
            setPopup({ type: 'win', amount: res.amount });
        }
        setLoading(false);
    };

    const currentMultipliers = DIFFICULTY_MAP[difficulty];

    return (
        <div className="min-h-screen bg-[#050a12] flex flex-col font-sans text-white pb-6 overflow-hidden">
            {/* Top Bar */}
            <div className="flex justify-between items-center px-4 py-3 bg-[#0a0f1a] border-b border-gold-600/20 shadow-2xl relative z-[100]">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="p-1 hover:bg-white/10 rounded-full transition text-gray-400"><ChevronLeft size={24}/></button>
                    <h1 className="text-xl font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
                        CHICKEN <span className="text-gold-500">ROAD</span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-black/60 px-4 py-1.5 rounded-xl border border-gold-500/30 text-gold-400 font-black text-sm shadow-inner flex items-center gap-2">
                        <Wallet size={14} /> ₹{(user?.balance || 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Game Canvas Container */}
            <div className="flex-1 relative flex flex-col justify-center overflow-hidden">
                
                {/* Moving Background Layer */}
                <div 
                    className="absolute inset-0 transition-all duration-1000 ease-out z-0"
                    style={{
                        backgroundImage: `url(${IMG_BACKGROUND})`,
                        backgroundSize: 'auto 100%',
                        backgroundPosition: `${50 - (stage * 5)}% bottom`, // Parallax effect
                        filter: 'brightness(0.5) saturate(1.2)'
                    }}
                ></div>

                <div className="absolute top-4 left-4 right-4 z-[50] flex justify-between opacity-80">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-red bg-black/40 px-3 py-1 rounded-full border border-white/5">
                        <div className="w-2 h-2 rounded-full bg-brand-red animate-pulse"></div> Live
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-green-500 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                        Players: {activePlayers.toLocaleString()}
                    </div>
                </div>

                <div className="relative z-20 w-full overflow-x-auto no-scrollbar py-20 px-4 flex items-center" style={{ scrollBehavior: 'smooth' }}>
                    
                    <div ref={trackRef} className="relative flex items-end gap-4 mx-auto min-w-max px-[50vw]">
                        
                        <div className="flex flex-col items-center gap-4 relative w-20">
                             <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-500 bg-white/10 border-white/20 ${stage === 0 ? 'scale-110 shadow-[0_0_30px_rgba(255,255,255,0.2)]' : 'opacity-50'}`}>
                                <span className="font-black text-xs text-white">START</span>
                             </div>
                             <div className="h-24 w-px border-l-2 border-dashed border-white/10"></div>
                             <div className="w-16 h-4 rounded-full bg-white/10"></div>
                        </div>

                        {currentMultipliers.map((m, i) => {
                            const isCurrent = stage === (i + 1);
                            const isPast = stage > (i + 1);
                            return (
                                <div key={i} className="flex flex-col items-center gap-4 relative w-20">
                                    <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-500 ${
                                        isCurrent ? 'border-gold-500 bg-gold-500/20 shadow-[0_0_30px_rgba(234,179,8,0.5)] scale-110 z-20' :
                                        isPast ? 'border-green-500 bg-green-500/10 opacity-50' : 'border-white/5 bg-white/5 opacity-40'
                                    }`}>
                                        <span className={`font-black text-sm ${isCurrent ? 'text-white' : 'text-gray-400'}`}>{m}x</span>
                                        {isCurrent && <span className="text-[8px] font-bold text-gold-500 uppercase">Target</span>}
                                    </div>
                                    
                                    <div className={`h-24 w-px border-l-2 border-dashed ${isCurrent ? 'border-gold-500/50' : 'border-white/10'}`}></div>

                                    <div className={`w-16 h-12 rounded-t-2xl border-t-2 border-x-2 flex flex-col justify-end p-1 gap-1 ${
                                        isCurrent ? 'border-gold-500/50 bg-gold-500/10' : 'border-white/10 bg-black/40'
                                    }`}>
                                        <div className={`h-1.5 w-full rounded-full ${isCurrent ? 'bg-gold-500/40' : 'bg-white/10'}`}></div>
                                        <div className={`h-1.5 w-full rounded-full opacity-50 ${isCurrent ? 'bg-gold-500/40' : 'bg-white/10'}`}></div>
                                    </div>
                                </div>
                            );
                        })}

                        <div 
                            className="absolute bottom-[2rem] left-0 transition-transform duration-700 ease-in-out z-30 pointer-events-none"
                            style={{ 
                                width: '80px',
                                transform: `translateX(${stage * 96}px)` 
                            }}
                        >
                             <div className="relative flex flex-col items-center">
                                <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${isDead ? 'bg-brand-red/60' : 'bg-gold-500/40'}`}></div>
                                
                                <img 
                                    src={isDead ? IMG_CHICKEN_DEAD : IMG_CHICKEN_PLAYING} 
                                    className={`w-28 h-28 object-contain drop-shadow-2xl ${isDead ? 'animate-shake' : 'animate-bounce-slow'}`} 
                                    alt="Chicken" 
                                />
                                
                                {stage > 0 && !isDead && (
                                    <div className="absolute -top-4 bg-gold-500 text-black px-2 py-0.5 rounded-full text-[8px] font-black uppercase shadow-lg border border-white animate-fade-in whitespace-nowrap">
                                        Level {stage}
                                    </div>
                                )}
                                {isDead && (
                                    <div className="absolute -top-6 bg-brand-red text-white px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-xl border-2 border-white animate-bounce">
                                        CRASHED
                                    </div>
                                )}
                             </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Game Control Panel */}
            <div className="bg-[#0a0f1a] p-5 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-gold-600/20 relative z-[100]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Amount Input */}
                    <div className="bg-black/40 p-4 rounded-3xl border border-white/5 flex items-center justify-between shadow-inner">
                         <div className="flex items-center gap-3">
                            <button onClick={() => setBetAmount(5)} className="bg-white/5 p-2.5 rounded-xl text-[10px] font-black hover:bg-gold-500 hover:text-black transition">MIN</button>
                            <div className="text-center min-w-[70px]">
                                <p className="text-[9px] text-gray-500 font-black uppercase mb-1 tracking-widest">Wager</p>
                                <div className="flex items-center justify-center">
                                    <span className="text-gold-500 font-bold mr-1">₹</span>
                                    <input 
                                        type="number" 
                                        value={betAmount} 
                                        onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                                        className="bg-transparent text-center font-black text-2xl outline-none w-20"
                                    />
                                </div>
                            </div>
                            <button onClick={() => setBetAmount(10000)} className="bg-white/5 p-2.5 rounded-xl text-[10px] font-black hover:bg-gold-500 hover:text-black transition">MAX</button>
                         </div>
                         <div className="flex gap-2 ml-4 border-l border-white/10 pl-5">
                            {[10, 50, 100, 500].map(v => (
                                <button key={v} onClick={() => setBetAmount(v)} className="w-10 h-10 rounded-xl bg-white/5 text-[10px] font-black hover:bg-gold-500 hover:text-black transition flex items-center justify-center border border-white/5">
                                    {v}
                                </button>
                            ))}
                         </div>
                    </div>

                    {/* Difficulty Selector */}
                    <div className="bg-black/40 p-4 rounded-3xl border border-white/5 shadow-inner">
                        <p className="text-[10px] text-gray-500 font-black uppercase mb-3 px-1 tracking-widest">Difficulty (Risk vs Reward)</p>
                        <div className="flex bg-black/60 rounded-2xl p-1.5 shadow-inner border border-white/5">
                            {DIFFICULTIES.map(d => (
                                <button 
                                    key={d}
                                    disabled={isActive}
                                    onClick={() => setDifficulty(d.toUpperCase() as any)}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                        difficulty === d.toUpperCase() ? 'bg-gold-500 text-black shadow-2xl' : 'text-gray-500 hover:text-gray-300'
                                    } ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Controls */}
                {!isActive ? (
                    <button 
                        onClick={handleStart}
                        disabled={loading}
                        className="w-full bg-gradient-to-b from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 text-white font-black text-2xl py-6 rounded-[2rem] shadow-[0_15px_40px_rgba(34,197,94,0.3)] active:scale-[0.98] transition-all flex flex-col items-center leading-none gap-2 border-b-4 border-black/30"
                    >
                        {loading ? 'INITIALIZING...' : 'START ADVENTURE'}
                        <span className="text-[10px] font-bold opacity-60 uppercase tracking-[0.3em]">Cross the road to win</span>
                    </button>
                ) : (
                    <div className="flex gap-4">
                        <button 
                            onClick={handleNext}
                            disabled={loading || stage >= 8}
                            className="flex-[2] bg-gradient-to-b from-gold-400 to-gold-600 hover:from-gold-300 hover:to-gold-500 text-black font-black text-2xl py-6 rounded-[2rem] shadow-[0_15px_40px_rgba(234,179,8,0.3)] active:scale-[0.98] transition-all flex flex-col items-center leading-none gap-2 border-b-4 border-black/30"
                        >
                            MOVE FORWARD
                            <span className="text-[10px] font-bold opacity-60 uppercase tracking-[0.3em]">Next Stage Multiplier</span>
                        </button>
                         <button 
                            onClick={handleCashout}
                            disabled={loading || stage === 0}
                            className="flex-1 bg-gradient-to-b from-brand-red to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black py-6 rounded-[2rem] shadow-[0_15px_40px_rgba(217,48,37,0.3)] active:scale-[0.98] transition-all flex flex-col items-center justify-center border-b-4 border-black/30"
                        >
                            <span className="text-[9px] opacity-70 uppercase mb-1">Take Profit</span>
                            <span className="text-xl">₹{(betAmount * (currentMultipliers[stage-1] || 1)).toFixed(2)}</span>
                        </button>
                    </div>
                )}
                
                <div className="flex items-center justify-center gap-6 mt-8 opacity-40">
                    <div className="flex items-center gap-1.5">
                        <ShieldAlert size={12} className="text-gold-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Fair Play Verified</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Zap size={12} className="text-gold-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Instant Payouts</span>
                    </div>
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
                .animate-shake {
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0) rotate(-2deg); }
                    20%, 80% { transform: translate3d(2px, 0, 0) rotate(2deg); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0) rotate(-4deg); }
                    40%, 60% { transform: translate3d(4px, 0, 0) rotate(4deg); }
                }
            `}</style>
        </div>
    );
};
