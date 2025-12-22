
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, startMinesGame, revealMinesTile, cashOutMines } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, Info, Bomb, Gem, Coins, ShieldAlert, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue } from 'firebase/database';

type TileStatus = 'HIDDEN' | 'GEM' | 'MINE';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

const MINES_CONFIG = {
    EASY: 3,
    MEDIUM: 5,
    HARD: 10
};

export const Mines = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [onlinePlayers, setOnlinePlayers] = useState(8940);
    
    // Game State
    const [betAmount, setBetAmount] = useState(10);
    const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
    const [grid, setGrid] = useState<TileStatus[]>(Array(25).fill('HIDDEN'));
    const [revealedCount, setRevealedCount] = useState(0);
    const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
    const [currentProfit, setCurrentProfit] = useState(0);
    
    // UI State
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [loading, setLoading] = useState(false);

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

        const unsubAuth = auth.onAuthStateChanged((u) => {
            if (u) {
                const userRef = ref(db, `users/${u.uid}`);
                const unsubUser = onValue(userRef, (snap) => {
                    if (snap.exists()) {
                        const val = snap.val();
                        setUser(val);
                        // Access Control
                        if (val.balance <= 1) {
                            setToast({ message: "Insufficient Access Balance (> ₹1 required)", type: 'error' });
                            setTimeout(() => navigate('/'), 2000);
                        }
                    }
                });

                const gameRef = ref(db, `active_games/mines/${u.uid}`);
                const unsubGame = onValue(gameRef, (snap) => {
                    const val = snap.val();
                    if(val && val.status === 'ACTIVE') {
                        setIsActive(true);
                        setBetAmount(val.betAmount);
                        if(val.minesCount === 3) setDifficulty('EASY');
                        else if(val.minesCount === 5) setDifficulty('MEDIUM');
                        else setDifficulty('HARD');
                        
                        const newGrid = Array(25).fill('HIDDEN');
                        const revealed = val.revealed || [];
                        revealed.forEach((idx: number) => {
                            newGrid[idx] = 'GEM';
                        });
                        setGrid(newGrid);
                        setRevealedCount(revealed.length);
                        
                        let mult = 1.0;
                        for(let i=0; i<revealed.length; i++) {
                            const total = 25 - i;
                            const safe = 25 - val.minesCount - i;
                            mult = mult * (total/safe);
                        }
                        mult = mult * 0.95;
                        setCurrentMultiplier(mult);
                        setCurrentProfit(val.betAmount * mult);
                    } else {
                        setIsActive(false);
                    }
                });

                return () => {
                    unsubUser();
                    unsubGame();
                };
            } else {
                navigate('/login');
            }
        });
        
        return () => {
            unsubAuth();
            clearInterval(playerInterval);
        };
    }, [navigate]);

    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ message: msg, type });
    };

    const handleStart = async () => {
        if (!user || loading) return;
        
        const MIN_BET = 10;
        const MAX_BET = 10000;

        if (betAmount < MIN_BET) { showToast(`Minimum balance was ${MIN_BET}`); return; }
        if (betAmount > MAX_BET) { showToast(`Maximum balance was ${MAX_BET}`); return; }
        if (user.balance < betAmount) { showToast("Insufficient Amount"); return; }

        setLoading(true);
        setGrid(Array(25).fill('HIDDEN'));
        setRevealedCount(0);
        setCurrentMultiplier(1.0);
        setCurrentProfit(0);

        const minesCount = MINES_CONFIG[difficulty];
        const res = await startMinesGame(user.uid, betAmount, minesCount);
        
        if (!res.success) {
            showToast(res.error || "Failed to start game");
        }
        setLoading(false);
    };

    const handleTileClick = async (index: number) => {
        if (!user || !isActive || loading || grid[index] !== 'HIDDEN') return;

        setLoading(true);

        const res = await revealMinesTile(user.uid, index);

        if (res.success) {
            if (res.type === 'gem') {
                const newGrid = [...grid];
                newGrid[index] = 'GEM';
                setGrid(newGrid);
                
                if (res.multiplier && res.payout) {
                    setCurrentMultiplier(res.multiplier);
                    setCurrentProfit(res.payout);
                }
            } else if (res.type === 'mine') {
                const newGrid = [...grid];
                newGrid[index] = 'MINE'; 
                
                if(res.fullGrid) {
                    res.fullGrid.forEach((val, idx) => {
                        if(val === 1) newGrid[idx] = 'MINE';
                    });
                }
                
                setGrid(newGrid);
                setPopup({ type: 'loss', amount: betAmount });
            }
        } else {
            showToast(res.error || "Error");
        }
        setLoading(false);
    };

    const handleCashout = async () => {
        if (!user || !isActive || loading) return;
        setLoading(true);

        const res = await cashOutMines(user.uid);
        
        if (res.success && res.amount) {
            setPopup({ type: 'win', amount: res.amount });
        } else {
            showToast(res.error || "Error");
        }
        setLoading(false);
    };

    const renderTile = (index: number) => {
        const status = grid[index];
        let content = null;
        let style = "bg-[#2d3748] shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)] hover:bg-[#4a5568]";

        if (status === 'GEM') {
            style = "bg-[#059669] shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)] animate-bounce-slow";
            content = <Gem className="text-white w-2/3 h-2/3 animate-pulse" />;
        } else if (status === 'MINE') {
            style = "bg-[#dc2626] shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)] animate-shake";
            content = <Bomb className="text-white w-2/3 h-2/3" />;
        }

        return (
            <button
                key={index}
                disabled={!isActive || loading || status !== 'HIDDEN'}
                onClick={() => handleTileClick(index)}
                className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all active:scale-95 ${style} ${!isActive ? 'opacity-70' : ''}`}
            >
                {content}
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-[#1a202c] flex flex-col font-sans text-white pb-6">
            <div className="bg-[#2d3748] p-4 flex justify-between items-center shadow-lg z-10">
                 <div className="flex items-center gap-2">
                     <button onClick={() => navigate('/')} className="hover:bg-white/10 p-2 rounded-full transition"><ChevronLeft /></button>
                     <span className="font-black text-xl tracking-wider text-yellow-500">MINES</span>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                        <User size={10} className="text-green-400" />
                        <span className="text-[10px] font-bold text-green-400">{onlinePlayers.toLocaleString()}</span>
                     </div>
                     <div className="bg-black/40 px-4 py-2 rounded-full border border-white/10 flex flex-col items-end">
                         <span className="text-[10px] text-gray-400">Balance</span>
                         <span className="font-mono font-bold text-green-400">₹{user?.balance ? user.balance.toFixed(2) : '0.00'}</span>
                     </div>
                 </div>
            </div>

            <div className="flex-1 p-4 flex flex-col max-w-lg mx-auto w-full">
                <div className="bg-[#2d3748] rounded-xl p-4 mb-4 flex justify-between items-center border border-gray-700 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-500/20 p-2 rounded-lg">
                            <ShieldAlert className="text-yellow-500" size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase">Mines</p>
                            <p className="text-xl font-black">{MINES_CONFIG[difficulty]}</p>
                        </div>
                    </div>
                    <div className="text-right">
                         <p className="text-xs text-gray-400 font-bold uppercase">Current Multiplier</p>
                         <p className={`text-2xl font-black ${isActive && currentMultiplier > 1 ? 'text-green-400' : 'text-gray-500'}`}>x{currentMultiplier.toFixed(2)}</p>
                    </div>
                </div>

                <div className="bg-[#171923] p-3 rounded-2xl shadow-inner border border-gray-700 mb-6">
                    <div className="grid grid-cols-5 gap-2 md:gap-3">
                        {Array.from({ length: 25 }, (_, i) => renderTile(i))}
                    </div>
                </div>

                <div className="bg-[#2d3748] p-4 rounded-t-3xl border-t border-gray-600 shadow-2xl flex-1 flex flex-col justify-end">
                    
                    {!isActive ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Difficulty</label>
                                <div className="flex gap-2">
                                    {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
                                        <button 
                                            key={d}
                                            onClick={() => setDifficulty(d)}
                                            className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition ${difficulty === d ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400' : 'border-gray-600 bg-gray-700 text-gray-400'}`}
                                        >
                                            {d} ({MINES_CONFIG[d]})
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Bet Amount</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 font-bold">₹</div>
                                    <input 
                                        type="number" 
                                        value={betAmount} 
                                        onChange={(e) => setBetAmount(Number(e.target.value))}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-xl py-4 pl-8 pr-4 font-bold text-white text-lg focus:border-yellow-500 outline-none" 
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                     {[10, 50, 100, 500].map(amt => (
                                         <button key={amt} onClick={() => setBetAmount(amt)} className="bg-gray-700 text-xs font-bold py-1 px-3 rounded text-gray-300 border border-gray-600">₹{amt}</button>
                                     ))}
                                </div>
                            </div>

                            <button 
                                onClick={handleStart}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-xl py-4 rounded-xl shadow-lg shadow-yellow-500/20 active:scale-95 transition"
                            >
                                {loading ? 'STARTING...' : 'BET'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-green-900/30 border border-green-500/30 p-4 rounded-xl text-center">
                                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Current Profit</p>
                                <p className="text-3xl font-black text-green-400">₹{currentProfit.toFixed(2)}</p>
                            </div>

                            <button 
                                onClick={handleCashout}
                                disabled={loading || currentProfit <= 0}
                                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition flex items-center justify-center gap-2"
                            >
                                <Coins size={24} fill="currentColor" /> CASHOUT
                            </button>
                            <p className="text-center text-xs text-gray-500">Reveal Gems to increase multiplier. Avoid the Mines.</p>
                        </div>
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
