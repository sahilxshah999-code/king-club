
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, startDragonTowerGame, revealDragonTowerTile, cashOutDragonTower } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, Skull, Egg, Flame, Coins, Castle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue, remove } from 'firebase/database';

const DRAGON_MULTIPLIERS = {
    EASY: [1.31, 1.75, 2.33, 3.11, 4.14, 5.52, 7.36, 9.81, 13.09],
    MEDIUM: [1.47, 2.21, 3.31, 4.96, 7.44, 11.16, 16.74, 25.12, 37.67],
    HARD: [1.96, 3.92, 7.84, 15.68, 31.36, 62.72, 125.44, 250.88, 501.76]
};

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type TileStatus = 'HIDDEN' | 'EGG' | 'SKULL';

export const DragonTower = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [onlinePlayers, setOnlinePlayers] = useState(6700);
    
    // Game State
    const [betAmount, setBetAmount] = useState(10);
    const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
    const [currentLevel, setCurrentLevel] = useState(0); 
    const [gridStatus, setGridStatus] = useState<TileStatus[][]>(Array(9).fill(Array(4).fill('HIDDEN')));
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);
    const [lossOverlay, setLossOverlay] = useState(false);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

    const towerRef = useRef<HTMLDivElement>(null);

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
                
                const gameRef = ref(db, `active_games/dragontower/${u.uid}`);
                onValue(gameRef, (snap) => {
                    const val = snap.val();
                    if(val && val.status === 'ACTIVE') {
                        setIsActive(true);
                        setBetAmount(val.betAmount);
                        setDifficulty(val.difficulty);
                        if (!loading) setCurrentLevel(val.level);
                        setLossOverlay(false);
                        if (val.level === 0) setGridStatus(Array(9).fill(Array(4).fill('HIDDEN')));
                    } else if (val && val.status === 'LOST') {
                        setIsActive(false);
                    } else {
                        setIsActive(false);
                        setLossOverlay(false);
                        setCurrentLevel(0);
                        setGridStatus(Array(9).fill(Array(4).fill('HIDDEN')));
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

    // Auto-scroll to active level
    useEffect(() => {
        if (towerRef.current && isActive) {
            const rowHeight = 64; 
            const totalHeight = rowHeight * 9;
            const currentRowPosFromBottom = currentLevel * rowHeight;
            const scrollPos = totalHeight - currentRowPosFromBottom - (towerRef.current.clientHeight / 2);
            
            towerRef.current.scrollTo({
                top: scrollPos,
                behavior: 'smooth'
            });
        }
    }, [currentLevel, isActive]);

    const handleStart = async () => {
        if (!user || loading) return;
        
        const MIN_BET = 10;
        const MAX_BET = 10000;

        if (betAmount < MIN_BET) { showToast(`Minimum balance was ${MIN_BET}`); return; }
        if (betAmount > MAX_BET) { showToast(`Maximum balance was ${MAX_BET}`); return; }
        if (user.balance < betAmount) { showToast("Insufficient Amount"); return; }
        
        setLoading(true);
        setGridStatus(Array(9).fill(Array(4).fill('HIDDEN')));
        setLossOverlay(false);
        setPopup(null);
        
        await remove(ref(db, `active_games/dragontower/${user.uid}`)); 
        
        const res = await startDragonTowerGame(user.uid, betAmount, difficulty);
        if(!res.success) showToast((res as any).error);
        setLoading(false);
    };

    const handleTileClick = async (rowIndex: number, colIndex: number) => {
        if(!isActive || loading) return;
        if(rowIndex !== currentLevel) return; 
        
        setLoading(true);
        const res: any = await revealDragonTowerTile(user.uid, colIndex);
        
        if(res.success) {
            const newGrid = gridStatus.map(row => [...row]);
            
            if(res.isLoss) {
                res.mines.forEach((isMine: number, idx: number) => {
                    if(isMine) newGrid[rowIndex][idx] = 'SKULL';
                    else newGrid[rowIndex][idx] = 'HIDDEN';
                });
                setGridStatus(newGrid);
                setLossOverlay(true);
                
                setTimeout(() => {
                    setLossOverlay(false);
                    setPopup({ type: 'loss', amount: betAmount });
                    setIsActive(false); 
                }, 2000);

            } else {
                newGrid[rowIndex][colIndex] = 'EGG';
                setGridStatus(newGrid);
                setCurrentLevel(res.level);
                
                if (res.level >= 9) {
                    setTimeout(() => handleCashout(), 500);
                }
            }
        }
        setLoading(false);
    };

    const handleCashout = async () => {
        if(!isActive || loading || currentLevel === 0) return;
        setLoading(true);
        const res: any = await cashOutDragonTower(user.uid);
        if(res.success) {
            setPopup({ type: 'win', amount: res.amount });
        } else {
            showToast(res.error);
        }
        setLoading(false);
    };

    const multipliers = DRAGON_MULTIPLIERS[difficulty];
    const currentProfit = currentLevel > 0 ? (betAmount * multipliers[currentLevel-1]) : 0;

    return (
        <div className="min-h-screen bg-[#0c0a09] text-white font-sans flex flex-col relative overflow-hidden">
            
            {lossOverlay && (
                <div className="absolute inset-0 z-[60] pointer-events-none flex flex-col items-center justify-center bg-red-950/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full h-full absolute bg-gradient-to-t from-red-600/40 via-transparent to-transparent animate-pulse"></div>
                    <Flame size={120} className="text-red-500 animate-bounce drop-shadow-[0_0_50px_rgba(239,68,68,0.8)]" fill="currentColor" />
                    <h2 className="text-4xl font-black uppercase text-red-500 tracking-widest mt-4 drop-shadow-xl animate-shake">DRAGON AWAKENED</h2>
                </div>
            )}

            {/* Header */}
            <div className="p-4 bg-[#1c1917] shadow-xl z-50 flex justify-between items-center border-b border-[#292524] relative">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full text-stone-400"><ChevronLeft/></button>
                <div className="flex flex-col items-center">
                    <h1 className="font-black italic text-lg tracking-widest text-[#d93025] flex items-center gap-2"><Castle size={16}/> DRAGON TOWER</h1>
                    <span className="text-[10px] text-stone-500 font-bold uppercase">{difficulty} MODE</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                        <User size={10} className="text-yellow-500" />
                        <span className="text-[10px] font-bold text-yellow-500">{onlinePlayers.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/40 px-3 py-1 rounded-full border border-white/10 text-sm font-mono font-bold text-green-400">
                        ₹{(user?.balance || 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Game Canvas */}
            <div className="flex-1 overflow-hidden relative flex flex-col items-center bg-[#0c0a09]">
                <div className="absolute inset-0 pointer-events-none" 
                     style={{ 
                         backgroundImage: `url("https://uploads.onecompiler.io/43yf4q9cp/448335hgt/1000133826.jpg")`,
                         backgroundSize: 'cover',
                         backgroundPosition: 'center',
                     }}>
                     <div className="absolute inset-0 bg-black/60"></div>
                </div>

                <div className="w-full max-w-sm h-full flex flex-col relative z-10 pt-4" ref={towerRef}>
                    <div className="flex justify-center -mb-16 z-0 relative transform translate-y-6">
                        <div className="relative w-48 h-48">
                            <img 
                                src="https://uploads.onecompiler.io/43yf4q9cp/448335hgt/1000133823.png" 
                                className="w-full h-full object-cover mask-image-b" 
                                alt="Dragon" 
                                style={{
                                    maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
                                    WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)'
                                }}
                            />
                            <div className="absolute top-[35%] left-[35%] w-3 h-3 bg-red-500 blur-sm animate-pulse z-10"></div>
                            <div className="absolute top-[35%] right-[35%] w-3 h-3 bg-red-500 blur-sm animate-pulse z-10 delay-75"></div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar pb-32 pt-16 px-6 z-10 relative">
                        <div className="bg-[#1c1917]/90 border-[6px] border-[#292524] rounded-t-3xl p-3 shadow-[0_-20px_60px_rgba(0,0,0,1)] min-h-full flex flex-col justify-end relative overflow-hidden backdrop-blur-sm">
                            
                            <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" 
                                 style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/cracked-concrete.png")'}}>
                            </div>

                            {[8,7,6,5,4,3,2,1,0].map((rowIdx) => {
                                const isCurrent = rowIdx === currentLevel;
                                const mult = multipliers[rowIdx];

                                return (
                                    <div key={rowIdx} className={`relative flex items-center gap-3 mb-2 p-2 rounded-xl transition-all duration-500 ${isCurrent ? 'bg-[#292524] shadow-[0_0_15px_rgba(0,0,0,0.5)] scale-[1.03] border-2 border-yellow-600/40 z-20' : 'border border-transparent opacity-50 blur-[0.5px]'}`}>
                                        
                                        <div className={`w-12 text-right font-black text-xs ${isCurrent ? 'text-yellow-500 drop-shadow-md' : 'text-stone-600'}`}>
                                            {mult}x
                                        </div>

                                        <div className="flex-1 grid grid-cols-4 gap-2">
                                            {[0,1,2,3].map(colIdx => {
                                                const status = gridStatus[rowIdx][colIdx];
                                                const showEgg = status === 'EGG';
                                                const showSkull = status === 'SKULL';
                                                
                                                return (
                                                    <button
                                                        key={colIdx}
                                                        disabled={!isActive || loading || !isCurrent}
                                                        onClick={() => handleTileClick(rowIdx, colIdx)}
                                                        className={`
                                                            h-12 rounded-lg bg-[#0c0a09] relative overflow-hidden flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]
                                                            ${status === 'HIDDEN' && isCurrent ? 'hover:bg-[#1f1d1b] cursor-pointer border border-[#44403c] active:scale-95' : 'border border-[#1c1917]'}
                                                            ${showSkull ? 'bg-red-950/80 border-red-900 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : ''}
                                                            ${showEgg ? 'bg-green-950/80 border-green-900 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : ''}
                                                            transition-all duration-200
                                                        `}
                                                    >
                                                        {status === 'HIDDEN' ? (
                                                            <div className={`w-full h-full opacity-30 ${isCurrent ? 'animate-pulse bg-stone-600' : 'bg-stone-800'}`}>
                                                                <div className="w-full h-full border-t border-white/5"></div>
                                                            </div>
                                                        ) : showEgg ? (
                                                            <div className="relative z-10 animate-slide-up">
                                                                <Egg size={24} className="text-[#fcd34d] fill-[#fcd34d] drop-shadow-[0_0_10px_rgba(252,211,77,0.5)]" />
                                                                <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="relative z-10 animate-shake">
                                                                <Skull size={24} className="text-stone-300 fill-stone-800" />
                                                                <div className="absolute inset-0 bg-red-600/30 blur-lg rounded-full animate-pulse"></div>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-[#1c1917] p-5 rounded-t-[2.5rem] shadow-[0_-10px_50px_rgba(0,0,0,0.9)] border-t border-[#292524] relative z-30">
                {!isActive ? (
                    <div className="space-y-4">
                        <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/5">
                            {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDifficulty(d)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${difficulty === d ? 'bg-[#d93025] text-white shadow-lg scale-105' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                        
                        <div className="bg-black/60 px-5 py-4 rounded-2xl flex items-center justify-between border border-white/5">
                            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Wager</span>
                            <div className="flex items-center gap-1">
                                <span className="text-[#d93025] font-bold">₹</span>
                                <input 
                                    type="number" 
                                    value={betAmount} 
                                    onChange={e => setBetAmount(Number(e.target.value))}
                                    className="bg-transparent text-right font-black text-2xl outline-none w-24 text-white placeholder-stone-700" 
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleStart}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-[#d93025] to-[#7f1d1d] hover:from-red-600 hover:to-red-900 text-white font-black text-xl py-5 rounded-2xl shadow-[0_10px_30px_rgba(220,38,38,0.2)] active:scale-[0.97] transition flex items-center justify-center gap-2 uppercase tracking-[0.2em] border-b-4 border-[#450a0a]"
                        >
                            {loading ? 'SUMMONING...' : 'ENTER TOWER'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-[#0c0a09] border border-[#292524] p-5 rounded-3xl flex justify-between items-center shadow-inner">
                            <div>
                                <p className="text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1">Dragon's Hoard</p>
                                <p className="text-3xl font-black text-green-500 drop-shadow-md">₹{currentProfit.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1">Risk Multiplier</p>
                                <p className="text-2xl font-black text-yellow-500">{(currentLevel < 9 ? multipliers[currentLevel] : multipliers[8]).toFixed(2)}x</p>
                 </div>
                        </div>

                        <button 
                            onClick={handleCashout}
                            disabled={loading || currentLevel === 0}
                            className="w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 text-white font-black text-xl py-5 rounded-2xl shadow-[0_10px_30px_rgba(22,163,74,0.3)] active:scale-[0.97] transition flex items-center justify-center gap-3 border-b-4 border-green-950 uppercase tracking-widest"
                        >
                            <Coins size={24} fill="currentColor" className="text-yellow-300"/> 
                            <span>ESCAPE TOWER</span>
                        </button>
                    </div>
                )}
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
                .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
            `}</style>
        </div>
    );
};
