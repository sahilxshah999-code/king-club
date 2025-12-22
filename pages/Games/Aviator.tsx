
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, updateUserBalance, placeBet } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, History as HistoryIcon, Clock, Menu, Minus, Plus, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue } from 'firebase/database';

// Assets
const ASSETS = {
  plane: "https://i.imgur.com/3gj62jX.png"
};

type GamePhase = 'WAITING' | 'FLYING' | 'CRASHED';

export const Aviator = () => {
    const navigate = useNavigate();
    const [onlinePlayers, setOnlinePlayers] = useState(12450);
    
    // Game State
    const [phase, setPhase] = useState<GamePhase>('WAITING');
    const [multiplier, setMultiplier] = useState(1.00);
    const [countdown, setCountdown] = useState(5); 
    const [gameHistory, setGameHistory] = useState<number[]>([]);
    
    // User State
    const [user, setUser] = useState<UserProfile | null>(null);
    const [betAmount, setBetAmount] = useState(10);
    
    // UI Flags
    const [uiHasBetForCurrentRound, setUiHasBetForCurrentRound] = useState(false);
    const [uiHasBetForNextRound, setUiHasBetForNextRound] = useState(false);

    // Refs for Game Loop
    const gameStateRef = useRef({
        phase: 'WAITING' as GamePhase,
        multiplier: 1.00,
        hasBetForNextRound: false,
        hasBetForCurrentRound: false,
        wageredAmount: 0,
        queuedAmount: 0 
    });
    const userRef = useRef<UserProfile | null>(null);

    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const planeImageRef = useRef<HTMLImageElement>(new Image());

    useEffect(() => {
        // Fake Players Logic
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
        if(u) {
            const userRefDb = ref(db, `users/${u.uid}`);
            onValue(userRefDb, (snap) => {
                if (snap.exists()) {
                    const val = snap.val() as UserProfile;
                    setUser(val);
                    
                    // Access Control
                    if (val.balance <= 1) {
                        setToast({ message: "Insufficient Access Balance (> ₹1 required)", type: 'error' });
                        setTimeout(() => navigate('/'), 2000);
                    }
                }
            });
        } else {
            navigate('/login');
        }
        
        planeImageRef.current.src = ASSETS.plane;
        startGameCycle();
        
        return () => {
            clearInterval(playerInterval);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [navigate]);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ message: msg, type });
    };

    const startGameCycle = () => {
        setPhase('WAITING');
        gameStateRef.current.phase = 'WAITING';
        setMultiplier(1.00);
        gameStateRef.current.multiplier = 1.00;
        setCountdown(5);
        
        let timeLeft = 5;
        const interval = setInterval(() => {
            timeLeft -= 1;
            setCountdown(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(interval);
                launchPlane();
            }
        }, 1000);
    };

    const launchPlane = () => {
        if (gameStateRef.current.hasBetForNextRound) {
            gameStateRef.current.hasBetForCurrentRound = true;
            gameStateRef.current.wageredAmount = gameStateRef.current.queuedAmount; 
            gameStateRef.current.hasBetForNextRound = false;
            setUiHasBetForCurrentRound(true);
            setUiHasBetForNextRound(false);
        } else {
            gameStateRef.current.hasBetForCurrentRound = false;
            setUiHasBetForCurrentRound(false);
        }

        setPhase('FLYING');
        gameStateRef.current.phase = 'FLYING';
        
        const currentUser = userRef.current;
        const wager = gameStateRef.current.wageredAmount;
        const hasBet = gameStateRef.current.hasBetForCurrentRound;
        const isDemo = currentUser?.role === 'demo';
        
        let targetCrash = 1.0;

        if (isDemo) {
            const baitRandom = Math.random();
            if (baitRandom < 0.3) targetCrash = 10.0 + (Math.random() * 90.0);
            else if (baitRandom < 0.7) targetCrash = 5.0 + (Math.random() * 5.0);
            else targetCrash = 2.5 + (Math.random() * 2.5);
        } else if (hasBet && currentUser) {
            const totalFunds = currentUser.balance + wager;
            const percentage = totalFunds > 0 ? (wager / totalFunds) * 100 : 0;

            if (percentage >= 50) {
                 targetCrash = 1.0 + (Math.random() * 0.1);
            } else if (percentage >= 25) {
                 targetCrash = 1.0 + (Math.random() * 0.7);
            } else {
                 targetCrash = 1.0 + (Math.random() * 1.0);
            }
        } else {
            const baitRandom = Math.random();
            if (baitRandom < 0.2) {
                targetCrash = 20.0 + (Math.random() * 80.0);
            } else if (baitRandom < 0.5) {
                targetCrash = 5.0 + (Math.random() * 15.0);
            } else {
                targetCrash = 2.0 + (Math.random() * 3.0);
            }
        }
        
        if (targetCrash < 1.0) targetCrash = 1.0;

        let startTime = Date.now();
        
        const animate = () => {
            if (gameStateRef.current.phase !== 'FLYING') return;

            const now = Date.now();
            const delta = (now - startTime) / 1000;
            
            const newMult = 1.00 + (Math.pow(1.15, delta * 1.5) - 1); 
            
            setMultiplier(newMult);
            gameStateRef.current.multiplier = newMult;
            
            if (newMult >= targetCrash) { 
                handleCrash(newMult);
                return;
            }
            
            draw(newMult, false);
            requestRef.current = requestAnimationFrame(animate);
        };
        requestRef.current = requestAnimationFrame(animate);
    };

    const handleCrash = (finalMult: number) => {
        setPhase('CRASHED');
        gameStateRef.current.phase = 'CRASHED';
        setMultiplier(finalMult);
        setGameHistory(prev => [finalMult, ...prev].slice(0, 20));
        draw(finalMult, true);
        
        if (gameStateRef.current.hasBetForCurrentRound) {
            gameStateRef.current.hasBetForCurrentRound = false;
            setUiHasBetForCurrentRound(false);
            setPopup({ type: 'loss', amount: gameStateRef.current.wageredAmount });
        }

        setTimeout(() => startGameCycle(), 3000);
    };

    const handleBetAction = async () => {
        if (!user) return;
        
        if (phase === 'FLYING' && uiHasBetForCurrentRound) {
            const winMult = gameStateRef.current.multiplier;
            const wager = gameStateRef.current.wageredAmount;
            const winAmount = wager * winMult;

            gameStateRef.current.hasBetForCurrentRound = false;
            setUiHasBetForCurrentRound(false);
            
            await updateUserBalance(user.uid, user.balance + winAmount);
            setPopup({ type: 'win', amount: winAmount });
            return;
        }

        if (uiHasBetForNextRound) {
            await updateUserBalance(user.uid, user.balance + gameStateRef.current.queuedAmount);
            gameStateRef.current.hasBetForNextRound = false;
            gameStateRef.current.queuedAmount = 0;
            setUiHasBetForNextRound(false);
            return;
        }

        // Updated Limits 1 - 20000
        const MIN_BET = 1;
        const MAX_BET = 20000;

        if (betAmount < MIN_BET) {
            showToast(`Minimum balance was ${MIN_BET}`);
            return;
        }
        if (betAmount > MAX_BET) {
            showToast(`Maximum balance was ${MAX_BET}`);
            return;
        }
        if (user.balance < betAmount) {
            showToast("Insufficient Amount");
            return;
        }

        const res = await placeBet(user.uid, betAmount);
        if (!res.success) {
            showToast("Transaction failed");
            return;
        }
        
        gameStateRef.current.hasBetForNextRound = true;
        gameStateRef.current.queuedAmount = betAmount;
        setUiHasBetForNextRound(true);
        showToast("Bet Placed for next round", 'success');
    };

    const draw = (currentMult: number, isCrashed: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.parentElement?.clientWidth || 300;
        canvas.height = 300;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;

        if (phase === 'WAITING') {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("WAITING FOR NEXT ROUND", canvas.width/2, canvas.height/2 - 20);
            
            const barW = 200;
            const barH = 4;
            ctx.fillStyle = '#333';
            ctx.fillRect((canvas.width-barW)/2, canvas.height/2, barW, barH);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect((canvas.width-barW)/2, canvas.height/2, barW * (countdown/5), barH);
            return;
        }

        const maxMult = Math.max(2, currentMult * 1.2);
        const normY = (currentMult - 1) / (maxMult - 1);
        
        const startX = 0;
        const startY = canvas.height;
        const endX = canvas.width * 0.8; 
        const endY = canvas.height - (canvas.height * 0.8 * normY); 

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(canvas.width * 0.4, endY, endX, endY);
        ctx.lineTo(endX, canvas.height);
        ctx.lineTo(startX, canvas.height);
        
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, 'rgba(185, 28, 28, 0.6)'); 
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(canvas.width * 0.4, endY, endX, endY);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.stroke();

        if (!isCrashed) {
            ctx.save();
            ctx.translate(endX, endY);
            ctx.drawImage(planeImageRef.current, -30, -30, 60, 60);
            ctx.restore();
        } else {
             ctx.font = 'bold 24px Arial';
             ctx.fillStyle = '#ef4444';
             ctx.textAlign = 'center';
             ctx.fillText("FLEW AWAY", canvas.width/2, canvas.height/2);
        }
    };

    return (
        <div className="min-h-screen bg-[#101011] flex flex-col font-sans">
            <div className="flex justify-between items-center px-4 py-2 bg-[#1b1c1d] border-b border-white/5">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-[#ef4444] text-2xl font-bold italic tracking-wider">Aviator</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                        <User size={12} className="text-green-500" />
                        <span className="text-[10px] font-black text-green-500">{onlinePlayers.toLocaleString()}</span>
                    </div>
                    <div className="text-green-500 font-bold text-sm">
                        {(user?.balance || 0).toFixed(2)} ₹
                    </div>
                    <Menu className="text-gray-400" size={24} />
                </div>
            </div>

            <div className="bg-[#101011] p-2 flex gap-2 overflow-x-auto no-scrollbar items-center border-b border-white/5">
                {gameHistory.map((h, i) => (
                    <div key={i} className={`px-2 py-0.5 rounded text-xs font-bold ${h >= 10 ? 'text-[#c017b4]' : h >= 2 ? 'text-[#913ef8]' : 'text-[#34b4ff]'} bg-gray-800/50 min-w-[3rem] text-center`}>
                        {h.toFixed(2)}x
                    </div>
                ))}
                <div className="ml-auto text-gray-500 text-xs flex items-center gap-1 bg-black px-2 py-1 rounded-full border border-gray-700">
                    <Clock size={12} /> History
                </div>
            </div>

            <div className="relative flex-1 bg-black flex flex-col justify-center">
                <canvas ref={canvasRef} className="w-full h-full absolute inset-0" />
                {phase !== 'WAITING' && (
                    <div className="absolute top-10 left-0 right-0 text-center pointer-events-none z-10">
                        <div className={`text-6xl font-black tracking-tighter ${phase === 'CRASHED' ? 'text-[#ef4444]' : 'text-white'}`}>
                            {multiplier.toFixed(2)}x
                        </div>
                    </div>
                )}
            </div>

            <div className="p-2 bg-[#101011]">
                <div className="bg-[#1b1c1d] rounded-2xl p-3 border border-gray-800">
                    <div className="flex gap-2 h-14 mb-2">
                        <div className="flex-1 bg-[#101011] rounded-full border border-gray-700 flex items-center px-1">
                            <button onClick={() => setBetAmount(Math.max(1, betAmount - 10))} className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white transition">
                                <Minus size={16} />
                            </button>
                            <input 
                                type="number" 
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                                className="flex-1 bg-transparent text-center text-white font-bold text-lg outline-none"
                            />
                            <button onClick={() => setBetAmount(betAmount + 10)} className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white transition">
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-3">
                         {[10, 100, 500, 1000].map(amt => (
                             <button 
                                key={amt} 
                                onClick={() => setBetAmount(amt)}
                                className="bg-[#101011] rounded-full py-1 text-xs text-gray-400 font-bold border border-gray-700 hover:bg-gray-800 hover:text-white transition"
                             >
                                 {amt}
                             </button>
                         ))}
                    </div>

                    <button 
                        onClick={handleBetAction}
                        disabled={phase === 'CRASHED' && !uiHasBetForNextRound}
                        className={`w-full h-16 rounded-2xl font-black text-xl shadow-lg flex flex-col items-center justify-center transition active:scale-[0.98] ${
                            phase === 'FLYING' && uiHasBetForCurrentRound 
                                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20' 
                                : uiHasBetForNextRound 
                                    ? 'bg-[#ef4444] hover:bg-red-600 text-white shadow-red-500/20' 
                                    : 'bg-[#22c55e] hover:bg-green-600 text-white shadow-green-500/20'
                        }`}
                    >
                        {phase === 'FLYING' && uiHasBetForCurrentRound ? (
                            <div className="leading-tight">
                                <div className="text-xs font-bold uppercase opacity-80">CASH OUT</div>
                                <div>{(gameStateRef.current.wageredAmount * multiplier).toFixed(0)} ₹</div>
                            </div>
                        ) : uiHasBetForNextRound ? (
                            <div className="leading-tight">
                                <div className="text-lg">Waiting for round...</div>
                                <div className="text-xs font-bold uppercase opacity-80">Cancel Bet</div>
                            </div>
                        ) : (
                            <div className="leading-tight">
                                <div className="text-xl">BET</div>
                                <div className="text-[10px] font-normal uppercase opacity-70 tracking-wide">Place your bet</div>
                            </div>
                        )}
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
                
