
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { playDice } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, RefreshCw, Wallet, Square, Repeat, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue } from 'firebase/database';

export const Dice = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [onlinePlayers, setOnlinePlayers] = useState(13200);
    
    // Core Game State
    const [betAmount, setBetAmount] = useState(10);
    const [rollOver, setRollOver] = useState(50.00);
    const [multiplier, setMultiplier] = useState(1.98);
    const [winChance, setWinChance] = useState(50.00);
    const [rounds, setRounds] = useState(1);
    
    // Auto Bet State
    const [isAuto, setIsAuto] = useState(false);
    const [currentRound, setCurrentRound] = useState(0);
    const stopAutoRef = useRef(false);
    
    // Result State
    const [resultNum, setResultNum] = useState<number | null>(null);
    const [isWin, setIsWin] = useState<boolean | null>(null);
    const [animValue, setAnimValue] = useState(50.00);
    
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

        let userUnsub: (() => void) | undefined;
        
        const authUnsub = auth.onAuthStateChanged((u) => {
            if (u) {
                if (userUnsub) userUnsub();
                
                const userRef = ref(db, `users/${u.uid}`);
                userUnsub = onValue(userRef, snap => {
                    if (snap.exists()) {
                        const val = snap.val();
                        setUser(val);
                        if (val.balance <= 1) {
                            setToast({ message: "Insufficient Access Balance (> ₹1 required)", type: 'error' });
                            setTimeout(() => navigate('/'), 2000);
                        }
                    }
                });
            } else {
                navigate('/login');
            }
        });
        
        return () => {
            authUnsub();
            if (userUnsub) userUnsub();
            clearInterval(playerInterval);
        };
    }, [navigate]);

    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ message: msg, type });
    };

    // --- Synchronization Logic ---
    const resetResult = () => {
        if (resultNum !== null && !loading && !isAuto) {
            setResultNum(null);
            setIsWin(null);
        }
    };

    const updateFromRollOver = (val: number) => {
        resetResult();
        if (val < 2) val = 2;
        if (val > 98) val = 98;
        
        setRollOver(val);
        const chance = 100 - val;
        setWinChance(Number(chance.toFixed(2)));
        setMultiplier(Number((99 / chance).toFixed(4)));
    };

    const updateFromMultiplier = (val: number) => {
        resetResult();
        let chance = 99 / val;
        if (chance < 2) chance = 2;
        if (chance > 98) chance = 98;
        
        setWinChance(Number(chance.toFixed(2)));
        setRollOver(Number((100 - chance).toFixed(2)));
        setMultiplier(val);
    };

    const updateFromWinChance = (val: number) => {
        resetResult();
        if (val < 2) val = 2;
        if (val > 98) val = 98;
        
        setWinChance(val);
        setRollOver(Number((100 - val).toFixed(2)));
        setMultiplier(Number((99 / val).toFixed(4)));
    };

    const runSingleRound = async (silent = false) => {
        if (!user) return null;
        if (!silent) {
            setResultNum(null);
            setIsWin(null);
        }
        // Return any to bypass property access errors
        const res: any = await playDice(user.uid, betAmount, rollOver, multiplier);
        return res;
    };

    const handleBet = async () => {
        if (!user || loading) return;
        const MIN_BET = 5;
        const MAX_BET = 10000;

        if (betAmount < MIN_BET) { showToast(`Minimum balance was ${MIN_BET}`); return; }
        if (betAmount > MAX_BET) { showToast(`Maximum balance was ${MAX_BET}`); return; }
        if (user.balance < betAmount) { showToast("Insufficient Amount"); return; }

        if (rounds > 1) {
            startAutoBet();
        } else {
            startSingleBet();
        }
    };

    const startSingleBet = async () => {
        setLoading(true);
        setPopup(null);
        
        const res: any = await runSingleRound();

        if (res && res.success) {
            // Animate
            let start = 0;
            const duration = 500;
            const animateDice = (timestamp: number) => {
                if (!start) start = timestamp;
                const progress = timestamp - start;
                
                if (progress < duration) {
                    setAnimValue(Math.random() * 100);
                    requestAnimationFrame(animateDice);
                } else {
                    setAnimValue(res.resultNum);
                    setResultNum(res.resultNum);
                    setIsWin(res.isWin);
                    
                    if (res.isWin) {
                        setPopup({ type: 'win', amount: res.winAmount });
                    } else {
                        setPopup({ type: 'loss', amount: betAmount });
                    }
                    setLoading(false);
                }
            };
            requestAnimationFrame(animateDice);
        } else {
            showToast(res?.error || "Error");
            setLoading(false);
        }
    };

    const startAutoBet = async () => {
        setIsAuto(true);
        setLoading(true);
        setPopup(null);
        stopAutoRef.current = false;
        
        let totalProfit = 0;

        for (let i = 0; i < rounds; i++) {
            if (stopAutoRef.current) break;
            
            setCurrentRound(i + 1);
            setAnimValue(Math.random() * 100);
            
            const res: any = await runSingleRound(true);
            
            if (!res || !res.success) {
                stopAutoRef.current = true;
                break;
            }

            setResultNum(res.resultNum);
            setAnimValue(res.resultNum);
            setIsWin(res.isWin);
            
            const profit = res.isWin ? (res.winAmount - betAmount) : -betAmount;
            totalProfit += profit;

            await new Promise(r => setTimeout(r, 200));
        }

        setIsAuto(false);
        setLoading(false);
        setCurrentRound(0);

        if (totalProfit > 0) {
            setPopup({ type: 'win', amount: totalProfit }); 
        } else {
            setPopup({ type: 'loss', amount: Math.abs(totalProfit) }); 
        }
    };

    const stopAuto = () => {
        stopAutoRef.current = true;
    };

    const displayPosition = (loading || resultNum !== null) ? animValue : rollOver;

    return (
        <div className="min-h-screen bg-[#0f212e] text-white font-sans flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-[#1a2c38] shadow-lg z-50 flex justify-between items-center border-b border-[#2f4553]">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-[#2f4553] rounded-full text-gray-400 transition"><ChevronLeft/></button>
                <div className="flex flex-col items-center">
                    <h1 className="font-black italic text-lg tracking-widest uppercase">DICE</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-[#0f212e] px-2 py-1 rounded-full border border-[#2f4553]">
                        <User size={10} className="text-[#00e701]" />
                        <span className="text-[10px] font-bold text-[#00e701]">{onlinePlayers.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#0f212e] px-4 py-1.5 rounded-full border border-[#2f4553] text-sm font-bold text-[#00e701] flex items-center gap-2 shadow-inner">
                        <Wallet size={14}/> ₹{(user?.balance || 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Game Canvas */}
            <div className="flex-1 p-6 flex flex-col justify-center max-w-lg mx-auto w-full relative">
                
                {/* Result Display Overlay */}
                <div className="absolute top-10 left-0 right-0 flex flex-col items-center pointer-events-none z-10">
                    {resultNum !== null ? (
                        <div className={`text-6xl font-black drop-shadow-2xl transition-all duration-300 transform scale-110 ${isWin ? 'text-[#00e701]' : 'text-[#ef4444]'}`}>
                            {resultNum.toFixed(2)}
                        </div>
                    ) : (
                        <div className="text-6xl font-black text-gray-700 opacity-20">
                            {rollOver.toFixed(2)}
                        </div>
                    )}
                    {isAuto && (
                        <div className="mt-2 bg-black/50 px-4 py-1 rounded-full text-xs font-bold text-yellow-400 animate-pulse border border-yellow-500/30">
                            Round {currentRound} / {rounds}
                        </div>
                    )}
                </div>

                {/* Slider Container */}
                <div className="bg-[#1a2c38] p-8 rounded-3xl border border-[#2f4553] shadow-2xl mb-8 relative">
                    
                    {/* The Track */}
                    <div className="relative h-4 w-full rounded-full bg-[#0f212e] overflow-hidden mb-12 shadow-inner">
                        {/* Red Zone (Loss) - From 0 to RollOver */}
                        <div 
                            className="absolute top-0 bottom-0 left-0 bg-[#ef4444] transition-all duration-100"
                            style={{ width: `${rollOver}%` }}
                        ></div>
                        {/* Green Zone (Win) - From RollOver to 100 */}
                        <div 
                            className="absolute top-0 bottom-0 right-0 bg-[#22c55e] transition-all duration-100"
                            style={{ width: `${100 - rollOver}%` }}
                        ></div>
                        
                        {/* Threshold Marker Line */}
                        <div 
                            className="absolute top-0 bottom-0 w-1 bg-white z-10 shadow-[0_0_10px_white]"
                            style={{ left: `${rollOver}%` }}
                        ></div>
                    </div>

                    {/* The Interactive Slider (Only active when not loading) */}
                    <input 
                        type="range" 
                        min="2" 
                        max="98" 
                        step="0.01" 
                        value={rollOver}
                        onChange={(e) => updateFromRollOver(Number(e.target.value))}
                        disabled={loading}
                        className="absolute top-8 left-8 right-8 w-[calc(100%-4rem)] h-4 opacity-0 cursor-pointer z-20"
                    />

                    {/* The Dice Icon (Visual Thumb) */}
                    <div 
                        className={`absolute top-5 w-12 h-12 bg-white rounded-xl border-4 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center z-10 transition-all duration-[50ms] pointer-events-none transform -translate-x-1/2 ${
                            resultNum !== null 
                                ? (isWin ? 'border-[#00e701] text-[#00e701]' : 'border-[#ef4444] text-[#ef4444]')
                                : 'border-[#2f4553] text-[#2f4553]'
                        }`}
                        style={{ left: `calc(${displayPosition}% + 2rem - ${displayPosition * 0.04}rem)` }}
                    >
                        <div className={`text-2xl font-black ${loading ? 'animate-spin' : ''}`}>🎲</div>
                        
                        {/* Result Tag */}
                        {resultNum !== null && (
                            <div className={`absolute -top-8 px-2 py-1 rounded text-xs font-black ${isWin ? 'bg-[#00e701] text-black' : 'bg-[#ef4444] text-white'}`}>
                                {resultNum.toFixed(2)}
                            </div>
                        )}
                    </div>

                    {/* Range Labels */}
                    <div className="flex justify-between text-xs font-bold text-gray-500 mt-2 px-1">
                        <span>0</span>
                        <span>25</span>
                        <span>50</span>
                        <span>75</span>
                        <span>100</span>
                    </div>
                </div>

                {/* Input Controls */}
                <div className="bg-[#1a2c38] p-5 rounded-t-[2rem] border-t border-[#2f4553] shadow-2xl space-y-4">
                    
                    {/* Multiplier / RollOver / WinChance */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#0f212e] p-2 rounded-xl border border-[#2f4553] relative group hover:border-gray-500 transition">
                            <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Multiplier</label>
                            <input 
                                type="number" 
                                value={multiplier} 
                                onChange={(e) => updateFromMultiplier(Number(e.target.value))}
                                disabled={loading}
                                className="w-full bg-transparent font-bold text-white text-sm outline-none"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">x</div>
                        </div>
                        <div className="bg-[#0f212e] p-2 rounded-xl border border-[#2f4553] relative hover:border-gray-500 transition">
                            <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Roll Over</label>
                            <input 
                                type="number" 
                                value={rollOver} 
                                onChange={(e) => updateFromRollOver(Number(e.target.value))}
                                disabled={loading}
                                className="w-full bg-transparent font-bold text-white text-sm outline-none"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs"><RefreshCw size={10}/></div>
                        </div>
                        <div className="bg-[#0f212e] p-2 rounded-xl border border-[#2f4553] relative hover:border-gray-500 transition">
                            <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Win Chance</label>
                            <input 
                                type="number" 
                                value={winChance} 
                                onChange={(e) => updateFromWinChance(Number(e.target.value))}
                                disabled={loading}
                                className="w-full bg-transparent font-bold text-white text-sm outline-none"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">%</div>
                        </div>
                    </div>

                    {/* Bet Amount & Rounds */}
                    <div className="flex gap-2">
                        <div className="bg-[#0f212e] p-3 rounded-xl border border-[#2f4553] flex-1 flex flex-col justify-center relative">
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1">Bet Amount</label>
                            <div className="flex items-center gap-1">
                                <span className="text-[#00e701] font-bold">₹</span>
                                <input 
                                    type="number" 
                                    value={betAmount} 
                                    onChange={(e) => setBetAmount(Number(e.target.value))}
                                    disabled={loading}
                                    className="bg-transparent font-black text-xl text-white outline-none w-full"
                                />
                            </div>
                            <div className="absolute right-2 top-2 flex gap-1">
                                <button onClick={() => setBetAmount(Math.floor(betAmount/2))} disabled={loading} className="px-1.5 py-0.5 bg-[#2f4553] rounded text-[9px] font-bold text-gray-300">½</button>
                                <button onClick={() => setBetAmount(betAmount*2)} disabled={loading} className="px-1.5 py-0.5 bg-[#2f4553] rounded text-[9px] font-bold text-gray-300">2x</button>
                            </div>
                        </div>
                        
                        <div className="bg-[#0f212e] p-3 rounded-xl border border-[#2f4553] w-1/3 flex flex-col justify-center">
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1">Rounds</label>
                            <div className="flex items-center gap-1">
                                <Repeat size={14} className="text-gray-500"/>
                                <input 
                                    type="number" 
                                    value={rounds} 
                                    min="1"
                                    max="100"
                                    onChange={(e) => {
                                        let v = parseInt(e.target.value);
                                        if (v > 100) v = 100;
                                        if (v < 1 || isNaN(v)) v = 1;
                                        setRounds(v);
                                    }}
                                    disabled={loading}
                                    className="bg-transparent font-black text-xl text-white outline-none w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    {isAuto ? (
                        <button 
                            onClick={stopAuto}
                            className="w-full bg-[#ef4444] hover:bg-red-600 text-white font-black text-xl py-4 rounded-xl shadow-[0_5px_20px_rgba(239,68,68,0.3)] active:scale-[0.98] transition uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            <Square fill="currentColor" size={20} /> STOP AUTO
                        </button>
                    ) : (
                        <button 
                            onClick={handleBet}
                            disabled={loading}
                            className="w-full bg-[#00e701] hover:bg-[#00c901] text-black font-black text-xl py-4 rounded-xl shadow-[0_5px_20px_rgba(0,231,1,0.2)] active:scale-[0.98] transition uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            {loading ? 'Rolling...' : (rounds > 1 ? `START AUTO (${rounds})` : 'BET')}
                        </button>
                    )}
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
        </div>
    );
};
