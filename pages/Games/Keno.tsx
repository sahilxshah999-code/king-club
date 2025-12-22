
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, playKeno } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, Wallet, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue } from 'firebase/database';

// Paytable mirror from backend for display purposes
const KENO_PAYTABLES = {
    EASY: {
        1: [0, 1.7],
        2: [0, 1.5, 3.8],
        3: [0, 1.1, 2.0, 6.0],
        4: [0, 0.5, 1.5, 4.0, 10.0],
        5: [0, 0.5, 1.2, 3.0, 8.0, 15.0],
        6: [0, 0.5, 1.1, 2.5, 5.0, 12.0, 20.0],
        7: [0, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0, 30.0],
        8: [0, 0.5, 1.0, 1.5, 3.0, 6.0, 12.0, 25.0, 50.0],
        9: [0, 0.5, 1.0, 1.5, 2.5, 5.0, 10.0, 20.0, 40.0, 80.0],
        10: [0, 0.5, 1.0, 1.2, 2.0, 4.0, 8.0, 15.0, 30.0, 60.0, 100.0]
    },
    MEDIUM: {
        1: [0, 3.8],
        2: [0, 1.7, 5.2],
        3: [0, 0, 2.7, 25.0],
        4: [0, 0, 1.7, 10.0, 80.0],
        5: [0, 0, 1.4, 4.0, 14.0, 300.0],
        6: [0, 0, 0, 3.0, 9.0, 160.0, 600.0],
        7: [0, 0, 0, 2.0, 7.0, 30.0, 250.0, 700.0],
        8: [0, 0, 0, 2.0, 4.0, 15.0, 50.0, 300.0, 800.0],
        9: [0, 0, 0, 2.0, 3.0, 8.0, 30.0, 100.0, 400.0, 900.0],
        10: [0, 0, 0, 1.5, 2.5, 5.0, 15.0, 50.0, 150.0, 500.0, 1000.0]
    },
    HARD: {
        1: [0, 5.0],
        2: [0, 0, 12.0],
        3: [0, 0, 1.0, 45.0],
        4: [0, 0, 0, 11.0, 150.0],
        5: [0, 0, 0, 6.0, 40.0, 500.0],
        6: [0, 0, 0, 0, 15.0, 300.0, 1500.0],
        7: [0, 0, 0, 0, 7.0, 90.0, 500.0, 2000.0],
        8: [0, 0, 0, 0, 5.0, 40.0, 200.0, 1000.0, 3000.0],
        9: [0, 0, 0, 0, 4.0, 20.0, 100.0, 500.0, 2000.0, 5000.0],
        10: [0, 0, 0, 0, 3.0, 15.0, 60.0, 300.0, 1000.0, 4000.0, 10000.0]
    }
};

type Risk = 'EASY' | 'MEDIUM' | 'HARD';

export const Keno = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [onlinePlayers, setOnlinePlayers] = useState(11300);
    
    // Game State
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
    const [betAmount, setBetAmount] = useState(10);
    const [risk, setRisk] = useState<Risk>('MEDIUM');
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

    const toggleNumber = (num: number) => {
        if (loading) return;
        setDrawnNumbers([]); 
        setPopup(null);
        
        if (selectedNumbers.includes(num)) {
            setSelectedNumbers(prev => prev.filter(n => n !== num));
        } else {
            if (selectedNumbers.length >= 10) return;
            setSelectedNumbers(prev => [...prev, num]);
        }
    };

    const handleBet = async () => {
        if (!user || loading) return;
        const MIN_BET = 10;
        const MAX_BET = 10000;

        if (betAmount < MIN_BET) { showToast(`Minimum balance was ${MIN_BET}`); return; }
        if (betAmount > MAX_BET) { showToast(`Maximum balance was ${MAX_BET}`); return; }
        if (user.balance < betAmount) { showToast("Insufficient Amount"); return; }
        
        if (selectedNumbers.length === 0) {
            showToast("Select at least 1 number!");
            return;
        }

        setLoading(true);
        setDrawnNumbers([]);
        setPopup(null);

        // Use any to bypass union type property access errors
        const res: any = await playKeno(user.uid, betAmount, selectedNumbers, risk);

        if (res.success) {
            const drawn = res.drawnNumbers;
            let currentDraw: number[] = [];
            
            for (let i = 0; i < drawn.length; i++) {
                await new Promise(r => setTimeout(r, 100)); 
                currentDraw.push(drawn[i]);
                setDrawnNumbers([...currentDraw]);
            }

            await new Promise(r => setTimeout(r, 500)); 

            if (res.winAmount > 0) {
                setPopup({ type: 'win', amount: res.winAmount });
            } else {
                setPopup({ type: 'loss', amount: betAmount });
            }
        } else {
            showToast(res.error);
        }
        setLoading(false);
    };

    const currentPaytable = (KENO_PAYTABLES[risk] as any)[selectedNumbers.length] || [];

    return (
        <div className="min-h-screen bg-[#0f172a] text-white font-sans flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-[#1e293b] shadow-xl z-50 flex justify-between items-center border-b border-white/5">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full text-slate-400"><ChevronLeft/></button>
                <div className="flex flex-col items-center">
                    <h1 className="font-black italic text-lg tracking-widest text-purple-500 uppercase">KENO</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                        <User size={10} className="text-purple-400" />
                        <span className="text-[10px] font-bold text-purple-400">{onlinePlayers.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/40 px-3 py-1 rounded-full border border-white/10 text-sm font-mono font-bold text-green-400 flex items-center gap-2">
                        <Wallet size={14}/> ₹{(user?.balance || 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Game Canvas */}
            <div className="flex-1 p-4 flex flex-col max-w-lg mx-auto w-full">
                
                {/* Paytable Bar */}
                <div className="bg-[#1e293b] rounded-xl p-2 mb-4 flex gap-1 overflow-x-auto no-scrollbar items-center border border-white/5 shadow-inner h-16">
                    {currentPaytable.map((mult: number, hits: number) => {
                        const isHit = drawnNumbers.length > 0 && selectedNumbers.filter(n => drawnNumbers.includes(n)).length === hits;
                        return (
                            <div key={hits} className={`min-w-[3rem] h-full flex flex-col items-center justify-center rounded-lg border transition-all ${isHit ? 'bg-green-600 border-green-400 scale-110 shadow-lg' : 'bg-[#0f172a] border-white/5 opacity-70'}`}>
                                <span className="text-[9px] font-bold text-slate-400">{hits}x</span>
                                <span className={`font-black text-sm ${isHit ? 'text-white' : 'text-yellow-500'}`}>{mult}</span>
                            </div>
                        );
                    })}
                    {currentPaytable.length === 0 && <div className="text-xs text-slate-500 italic w-full text-center">Select numbers to see payouts</div>}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-8 gap-2 mb-6">
                    {Array.from({length: 40}, (_, i) => i + 1).map(num => {
                        const isSelected = selectedNumbers.includes(num);
                        const isDrawn = drawnNumbers.includes(num);
                        const isHit = isSelected && isDrawn;
                        
                        let bgClass = "bg-[#1e293b] text-slate-400 hover:bg-[#334155]";
                        if (isHit) bgClass = "bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.6)] border-2 border-green-300 z-10 scale-110";
                        else if (isDrawn) bgClass = "bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)] scale-105"; // Drawn but not selected
                        else if (isSelected) bgClass = "bg-white text-black font-black scale-105 border-2 border-purple-500"; // Selected but not drawn yet

                        return (
                            <button 
                                key={num}
                                onClick={() => toggleNumber(num)}
                                disabled={loading}
                                className={`aspect-square rounded-lg flex items-center justify-center font-bold text-sm transition-all duration-300 ${bgClass}`}
                            >
                                {num}
                            </button>
                        );
                    })}
                </div>

                {/* Controls */}
                <div className="bg-[#1e293b] p-5 rounded-t-[2rem] border-t border-white/5 mt-auto shadow-2xl">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* Bet Input */}
                        <div className="bg-[#0f172a] p-3 rounded-xl border border-white/5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Bet Amount</label>
                            <div className="flex items-center">
                                <span className="text-green-500 font-bold mr-1">₹</span>
                                <input 
                                    type="number" 
                                    value={betAmount} 
                                    onChange={e => setBetAmount(Number(e.target.value))}
                                    className="bg-transparent w-full font-bold text-white outline-none"
                                />
                            </div>
                        </div>

                        {/* Risk Selector */}
                        <div className="bg-[#0f172a] p-3 rounded-xl border border-white/5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Risk</label>
                            <select 
                                value={risk} 
                                onChange={e => setRisk(e.target.value as Risk)}
                                className="bg-transparent w-full font-bold text-white outline-none text-xs"
                            >
                                <option value="EASY">Classic (Easy)</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HARD">High Risk (Hard)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => {
                            const pool = Array.from({length: 40}, (_, i) => i + 1);
                            const randomSelection = [];
                            for(let i=0; i<10; i++) {
                                const idx = Math.floor(Math.random() * pool.length);
                                randomSelection.push(pool[idx]);
                                pool.splice(idx, 1);
                            }
                            setSelectedNumbers(randomSelection);
                            setDrawnNumbers([]);
                        }} disabled={loading} className="bg-slate-700 text-white font-bold p-4 rounded-xl shadow-lg active:scale-95 transition">
                            Random
                        </button>
                        <button 
                            onClick={handleBet}
                            disabled={loading || selectedNumbers.length === 0}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-purple-500/20 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'DRAWING...' : 'BET'}
                        </button>
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
        </div>
    );
};
          
