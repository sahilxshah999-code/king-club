
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, playRoulette } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, RotateCcw, X, PlusCircle, Trash2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue } from 'firebase/database';

export const Roulette = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [resultNum, setResultNum] = useState<string | number | null>(null);
    const [bets, setBets] = useState<{ type: string; value: string | number; amount: number }[]>([]);
    const [chipValue, setChipValue] = useState(10);
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [history, setHistory] = useState<(string|number)[]>([]);
    const [onlinePlayers, setOnlinePlayers] = useState(9850);

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

        const u = auth.currentUser;
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
        } else {
            navigate('/login');
        }
        return () => clearInterval(playerInterval);
    }, [navigate]);

    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ message: msg, type });
    };

    const addBet = (type: string, value: string | number) => {
        if(spinning) return;
        setBets(prev => [...prev, { type, value, amount: chipValue }]);
    };

    const clearBets = () => setBets([]);
    const undoLastBet = () => setBets(prev => prev.slice(0, -1));
    const doubleBets = () => setBets(prev => prev.map(b => ({ ...b, amount: b.amount * 2 })));

    const getTotalBet = () => bets.reduce((sum, b) => sum + b.amount, 0);

    const spin = async () => {
        if (!user || bets.length === 0 || spinning) {
            if(bets.length === 0) showToast("Please place a bet!", 'error');
            return;
        }

        const totalBet = getTotalBet();
        const MIN_BET = 10;
        const MAX_BET = 10000;

        if (totalBet < MIN_BET) { showToast(`Minimum balance was ${MIN_BET}`); return; }
        if (totalBet > MAX_BET) { showToast(`Maximum balance was ${MAX_BET}`); return; }
        if (user.balance < totalBet) { showToast("Insufficient Amount"); return; }

        setSpinning(true);
        setPopup(null);
        setResultNum(null);

        // Use any to bypass union type property access errors
        const res: any = await playRoulette(user.uid, bets);

        if (!res.success || res.resultNumber === undefined) {
            setSpinning(false);
            showToast(res.error || "Error processing bet", 'error');
            return;
        }

        setUser(prev => prev ? {...prev, balance: res.newBalance || prev.balance} : null);

        // Simulate spin delay
        setTimeout(() => {
            setSpinning(false);
            setResultNum(res.resultNumber);
            setHistory(prev => [res.resultNumber, ...prev].slice(0, 10));

            if (res.totalWin && res.totalWin > 0) {
                setPopup({ type: 'win', amount: res.totalWin });
            } else {
                setPopup({ type: 'loss', amount: totalBet });
            }
            setBets([]);
        }, 2000);
    };

    // --- Helpers for Grid Rendering ---
    const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const getCellColor = (n: number) => RED_NUMBERS.includes(n) ? 'bg-[#d93025]' : 'bg-black';

    // Renders a betting cell with chips overlay
    const BettingCell = ({ 
        label, 
        type, 
        value, 
        className = "", 
        textClass = "text-white", 
        colorClass = "",
        onClickOverride 
    }: any) => {
        const cellBets = bets.filter(b => b.type === type && String(b.value) === String(value));
        const totalCellBet = cellBets.reduce((a,b) => a + b.amount, 0);

        return (
            <div 
                onClick={() => onClickOverride ? onClickOverride() : addBet(type, value)}
                className={`relative flex items-center justify-center cursor-pointer border border-white/20 active:brightness-125 transition select-none ${className} ${colorClass}`}
            >
                {/* Board rotated -90 deg. Text must be +90 deg to be upright relative to screen */}
                <span className={`font-bold transform rotate-90 md:rotate-0 ${textClass}`}>{label}</span>
                
                {/* Chip Render - Also needs rotation to be upright */}
                {totalCellBet > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none transform rotate-90 md:rotate-0">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-dashed border-white shadow-lg flex items-center justify-center text-[10px] md:text-xs font-black text-black">
                            {totalCellBet}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-green-900 flex flex-col font-sans overflow-hidden">
            {/* Top Header */}
            <div className="flex justify-between items-center p-3 bg-black/40 backdrop-blur-md text-white border-b border-white/10 z-20">
                 <div className="flex items-center gap-2">
                     <button onClick={() => navigate('/')} className="hover:bg-white/10 p-1 rounded"><ChevronLeft /></button>
                     <div className="flex flex-col">
                         <span className="text-xs text-gray-400">Balance</span>
                         <span className="font-bold text-green-400">₹{(user?.balance || 0).toFixed(2)}</span>
                     </div>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                        <User size={10} className="text-green-400" />
                        <span className="text-[10px] font-bold text-green-400">{onlinePlayers.toLocaleString()}</span>
                     </div>
                     <div className="bg-black/50 px-4 py-1 rounded-full border border-white/10 text-sm font-bold shadow-inner">
                        Bet: <span className="text-yellow-400">₹{getTotalBet()}</span>
                     </div>
                 </div>
            </div>

            {/* Main Table Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                {/* The Roulette Table Container */}
                {/* Rotated -90deg (270deg) to flip it 180 compared to previous 90deg */}
                <div className="relative bg-[#064e3b] border-8 border-[#065f46] rounded-xl shadow-2xl p-2 md:p-4 -rotate-90 md:rotate-0 scale-75 md:scale-100 origin-center">
                    
                    <div className="grid grid-cols-[50px_repeat(12,_50px)_40px] grid-rows-[50px_50px_50px_50px_50px] gap-[2px]">
                        
                        {/* 0 and 00 (Left Column in landscape / Bottom in Portrait -90) */}
                        <div className="row-span-3 col-start-1 grid grid-rows-2 gap-[2px]">
                            <BettingCell label="00" type="number" value="00" colorClass="bg-[#065f46] rounded-tl-lg" textClass="text-green-400 text-lg" />
                            <BettingCell label="0" type="number" value="0" colorClass="bg-[#065f46] rounded-bl-lg" textClass="text-green-400 text-lg" />
                        </div>

                        {/* Numbers Grid */}
                        {/* Row 1 */}
                        {Array.from({length: 12}, (_, i) => (i + 1) * 3).map((n, i) => (
                            <BettingCell key={n} label={n} type="number" value={n} colorClass={getCellColor(n)} className="rounded-sm" textClass="text-white text-xl" />
                        ))}
                        <BettingCell label="2 to 1" type="column" value="2to1_3" className="border-l-2 border-white/40" textClass="text-xs uppercase" />

                        {/* Row 2 */}
                        {Array.from({length: 12}, (_, i) => (i * 3) + 2).map((n, i) => (
                             <BettingCell key={n} label={n} type="number" value={n} colorClass={getCellColor(n)} className="rounded-sm" textClass="text-white text-xl" />
                        ))}
                        <BettingCell label="2 to 1" type="column" value="2to1_2" className="border-l-2 border-white/40" textClass="text-xs uppercase" />

                        {/* Row 3 */}
                        {Array.from({length: 12}, (_, i) => (i * 3) + 1).map((n, i) => (
                             <BettingCell key={n} label={n} type="number" value={n} colorClass={getCellColor(n)} className="rounded-sm" textClass="text-white text-xl" />
                        ))}
                        <BettingCell label="2 to 1" type="column" value="2to1_1" className="border-l-2 border-white/40" textClass="text-xs uppercase" />

                        {/* Dozens Row */}
                        <div className="col-start-1 row-start-4"></div>
                        <div className="col-start-2 col-span-4 row-start-4">
                             <BettingCell label="1st 12" type="dozen" value="1st 12" className="w-full h-full border-t-2 border-white/40" />
                        </div>
                        <div className="col-start-6 col-span-4 row-start-4">
                             <BettingCell label="2nd 12" type="dozen" value="2nd 12" className="w-full h-full border-t-2 border-white/40" />
                        </div>
                        <div className="col-start-10 col-span-4 row-start-4">
                             <BettingCell label="3rd 12" type="dozen" value="3rd 12" className="w-full h-full border-t-2 border-white/40" />
                        </div>
                        
                        {/* Outside Bets Row */}
                        <div className="col-start-1 row-start-5"></div>
                        <div className="col-start-2 col-span-2 row-start-5">
                            <BettingCell label="1-18" type="range" value="1-18" className="w-full h-full" />
                        </div>
                        <div className="col-start-4 col-span-2 row-start-5">
                            <BettingCell label="EVEN" type="parity" value="even" className="w-full h-full" />
                        </div>
                        <div className="col-start-6 col-span-2 row-start-5">
                            <BettingCell label={<div className="w-6 h-6 bg-[#d93025] rotate-45 transform skew-x-12"></div>} type="color" value="red" className="w-full h-full" />
                        </div>
                        <div className="col-start-8 col-span-2 row-start-5">
                            <BettingCell label={<div className="w-6 h-6 bg-black rotate-45 transform skew-x-12"></div>} type="color" value="black" className="w-full h-full" />
                        </div>
                        <div className="col-start-10 col-span-2 row-start-5">
                            <BettingCell label="ODD" type="parity" value="odd" className="w-full h-full" />
                        </div>
                        <div className="col-start-12 col-span-2 row-start-5">
                            <BettingCell label="19-36" type="range" value="19-36" className="w-full h-full" />
                        </div>

                    </div>
                    
                    {/* Spinning Overlay */}
                    {spinning && (
                         <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-sm rounded-lg transform rotate-90 md:rotate-0">
                             <div className="text-center">
                                 <div className="w-16 h-16 border-4 border-t-yellow-400 border-white/20 rounded-full animate-spin mb-4 mx-auto"></div>
                                 <h2 className="text-white font-bold text-xl animate-pulse">SPINNING...</h2>
                             </div>
                         </div>
                    )}

                    {/* Result Overlay */}
                    {!spinning && resultNum !== null && (
                         <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none transform rotate-90 md:rotate-0">
                             <div className={`w-32 h-32 rounded-full border-8 border-white shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center justify-center text-5xl font-black text-white animate-bounce-slow ${resultNum === '0' || resultNum === '00' ? 'bg-green-600' : getCellColor(Number(resultNum))}`}>
                                 {resultNum}
                             </div>
                         </div>
                    )}
                </div>
            </div>

            {/* Chip Selection & Controls */}
            <div className="bg-[#1a1a1a] p-4 rounded-t-3xl border-t border-gray-700 shadow-2xl relative z-30">
                {/* Chip Selector */}
                <div className="flex justify-center gap-3 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    {[10, 25, 50, 100, 250].map(val => (
                        <button 
                            key={val}
                            onClick={() => setChipValue(val)}
                            className={`flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full border-2 shadow-lg flex items-center justify-center font-black text-xs md:text-sm transition transform hover:scale-110 ${chipValue === val ? 'border-yellow-400 -translate-y-2 ring-2 ring-yellow-400/30' : 'border-gray-500 hover:border-white'}`}
                            style={{
                                background: `url("https://www.transparenttextures.com/patterns/black-scales.png"), linear-gradient(135deg, ${val===10?'#3b82f6':val===25?'#10b981':val===50?'#ef4444':val===100?'#111827':'#8b5cf6'} 0%, #000 100%)`,
                                color: 'white',
                                textShadow: '0 1px 2px black'
                            }}
                        >
                            {val}
                        </button>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button onClick={undoLastBet} disabled={spinning} className="flex flex-col items-center justify-center w-16 bg-gray-800 rounded-xl border border-gray-700 active:scale-95 transition">
                        <RotateCcw size={18} className="text-gray-400"/>
                        <span className="text-[10px] text-gray-400 mt-1">UNDO</span>
                    </button>
                    <button onClick={clearBets} disabled={spinning} className="flex flex-col items-center justify-center w-16 bg-gray-800 rounded-xl border border-gray-700 active:scale-95 transition">
                        <Trash2 size={18} className="text-gray-400"/>
                        <span className="text-[10px] text-gray-400 mt-1">CLEAR</span>
                    </button>
                    <button onClick={doubleBets} disabled={spinning} className="flex flex-col items-center justify-center w-16 bg-gray-800 rounded-xl border border-gray-700 active:scale-95 transition">
                        <PlusCircle size={18} className="text-gray-400"/>
                        <span className="text-[10px] text-gray-400 mt-1">X2</span>
                    </button>
                    
                    <button 
                        onClick={spin}
                        disabled={spinning}
                        className="flex-1 bg-gradient-to-b from-green-500 to-green-700 text-white font-black text-2xl tracking-widest rounded-xl shadow-lg shadow-green-900/50 active:scale-95 transition disabled:opacity-50 disabled:grayscale border-b-4 border-green-900"
                    >
                        {spinning ? '...' : 'SPIN'}
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
        </div>
    );
};
