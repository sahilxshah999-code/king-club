
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, playPlinko } from '../../services/userService';
import { UserProfile } from '../../types';
import { ChevronLeft, Info, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue } from 'firebase/database';

const getPlinkoMultiplier = (rows: number, risk: 'LOW'|'MEDIUM'|'HIGH', index: number): number => {
    const maxMult = risk === 'HIGH' ? 80 : risk === 'MEDIUM' ? 15 : 6;
    const center = rows / 2;
    const dist = Math.abs(index - center);
    const base = 0.3;
    const edgeDist = rows / 2;
    const power = Math.pow(maxMult / base, 1 / edgeDist);
    let mult = base * Math.pow(power, dist);
    return parseFloat(mult.toFixed(1));
};

export const Plinko = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    
    // Settings
    const [betAmount, setBetAmount] = useState<number>(10);
    const [ballCount, setBallCount] = useState<number>(1);
    const [risk, setRisk] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
    const [rows, setRows] = useState<number>(16);
    
    const [isDropping, setIsDropping] = useState(false);
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [onlinePlayers, setOnlinePlayers] = useState(14520);

    // Canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const ballsRef = useRef<any[]>([]); 
    const ballImageRef = useRef<HTMLImageElement>(new Image());

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
            onValue(userRef, snap => {
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
        
        ballImageRef.current.src = "https://uploads.onecompiler.io/43yf4q9cp/4482kdrxk/1000133809.jpg";

        requestRef.current = requestAnimationFrame(animate);
        return () => {
            cancelAnimationFrame(requestRef.current);
            clearInterval(playerInterval);
        };
    }, [navigate]);

    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ message: msg, type });
    };

    const animate = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.parentElement?.clientWidth || 350;
        canvas.height = canvas.width * 0.8 + 50; 

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const padding = 20;
        const width = canvas.width - padding * 2;
        const rowHeight = (canvas.height - 100) / rows;
        const pegRadius = 3;
        
        ctx.fillStyle = 'white';
        for(let r=0; r<=rows; r++) {
            const gap = width / rows;
            for(let c=0; c<=r; c++) {
                const x = canvas.width/2 + (c - r/2) * gap;
                const y = 50 + r * rowHeight;
                ctx.beginPath();
                ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const finishedBalls: number[] = [];
        
        ballsRef.current.forEach((ball, i) => {
            const gap = width / rows;
            const currentRow = Math.floor(ball.progress);
            const nextRow = currentRow + 1;
            const stepProgress = ball.progress - currentRow; 
            
            const currentPathSum = ball.path.slice(0, currentRow).reduce((a:number,b:number)=>a+b, 0);
            const currentX = canvas.width/2 + (currentPathSum - currentRow/2) * gap;
            const currentY = 50 + currentRow * rowHeight;
            
            let targetX = currentX;
            let targetY = currentY;
            
            if (nextRow <= rows) {
                const direction = ball.path[currentRow]; 
                const nextPathSum = currentPathSum + direction;
                targetX = canvas.width/2 + (nextPathSum - nextRow/2) * gap;
                targetY = 50 + nextRow * rowHeight;
            } else {
                targetY = currentY + rowHeight * 1.5; 
            }

            const renderX = currentX + (targetX - currentX) * stepProgress;
            const renderY = currentY + (targetY - currentY) * stepProgress;

            const ballSize = 12;
            ctx.save();
            ctx.beginPath();
            ctx.arc(renderX, renderY, ballSize/2, 0, Math.PI*2);
            ctx.clip();
            ctx.drawImage(ballImageRef.current, renderX - ballSize/2, renderY - ballSize/2, ballSize, ballSize);
            ctx.restore();

            ball.progress += 0.15; 
            
            if(ball.progress >= rows + 0.8) {
                finishedBalls.push(i);
            }
        });
        
        for(let i=finishedBalls.length-1; i>=0; i--) {
            ballsRef.current.splice(finishedBalls[i], 1);
        }
        
        if(ballsRef.current.length === 0 && isDropping) {
            setIsDropping(false);
        }

        requestRef.current = requestAnimationFrame(animate);
    };

    const handleBet = async () => {
        if (!user) return;
        const total = betAmount * ballCount;
        
        const MIN_BET = 0.5;
        const MAX_BET = 1000;

        if (betAmount < MIN_BET) { showToast(`Minimum balance was ${MIN_BET}`); return; }
        if (betAmount > MAX_BET) { showToast(`Maximum balance was ${MAX_BET}`); return; }
        if (ballCount < 1 || ballCount > 100) { showToast("Number of balls must be 1 to 100"); return; }
        if (user.balance < total) { showToast("Insufficient Amount"); return; }

        setIsDropping(true);
        setPopup(null);

        // Use any to bypass union type property access errors
        const res: any = await playPlinko(user.uid, betAmount, ballCount, risk, rows);

        if (!res.success) {
            setIsDropping(false);
            showToast(res.error);
            return;
        }

        setUser(prev => prev ? {...prev, balance: res.newBalance} : null);

        res.results.forEach((r: any, i: number) => {
            setTimeout(() => {
                ballsRef.current.push({
                    path: r.path,
                    multiplier: r.multiplier,
                    progress: 0,
                    bucketIndex: r.bucketIndex
                });
            }, i * 100); 
        });
        
        const animationTime = (rows / 0.15 * 16) + (ballCount * 100) + 500;
        setTimeout(() => {
            if (res.totalPayout > total) {
                setPopup({ type: 'win', amount: res.totalPayout });
            } else {
                if(res.totalPayout > 0) setPopup({ type: 'win', amount: res.totalPayout });
            }
        }, animationTime);
    };

    const currentMultipliers = Array.from({length: rows + 1}, (_, i) => getPlinkoMultiplier(rows, risk, i));

    return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col font-sans text-white overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-[#1e293b] flex justify-between items-center shadow-md z-20">
                <button onClick={() => navigate('/')} className="hover:bg-white/10 p-2 rounded-full"><ChevronLeft /></button>
                <h1 className="text-xl font-black italic tracking-widest text-pink-500">PLINKO</h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                        <User size={10} className="text-pink-400" />
                        <span className="text-[10px] font-bold text-pink-400">{onlinePlayers.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/40 px-3 py-1 rounded-full border border-white/10 font-mono text-green-400">
                        ₹{(user?.balance || 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Game Area */}
            <div className="flex-1 relative flex flex-col items-center justify-start pt-4 overflow-hidden pb-12">
                <canvas ref={canvasRef} className="z-10" />
                
                {/* Buckets */}
                <div className="flex justify-center gap-1 px-2 w-full max-w-md absolute z-10 bottom-8 transform -translate-y-4">
                    {currentMultipliers.map((m, i) => {
                        let bg = 'bg-yellow-600';
                        if(m < 1) bg = 'bg-blue-900';
                        else if(m < 3) bg = 'bg-purple-700';
                        else bg = 'bg-pink-600';
                        
                        return (
                            <div key={i} className={`flex-1 h-10 rounded-sm ${bg} flex items-center justify-center text-[8px] md:text-[10px] font-bold shadow-inner border border-white/10`}>
                                {m}x
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Controls */}
            <div className="bg-[#1e293b] p-6 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-30 border-t border-white/5 space-y-4 relative">
                
                <div className="grid grid-cols-2 gap-4">
                    {/* Bet Amount */}
                    <div className="bg-[#0f172a] p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Amount per Ball (0.5-1000)</label>
                        <div className="flex items-center">
                            <span className="text-green-500 font-bold mr-1">₹</span>
                            <input 
                                type="number" 
                                value={betAmount} 
                                onChange={e => setBetAmount(parseFloat(e.target.value))}
                                className="bg-transparent w-full font-bold text-white outline-none"
                            />
                        </div>
                    </div>

                    {/* Ball Count */}
                    <div className="bg-[#0f172a] p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Balls (1-100)</label>
                        <input 
                            type="number" 
                            value={ballCount} 
                            onChange={e => setBallCount(parseInt(e.target.value))}
                            className="bg-transparent w-full font-bold text-white outline-none"
                        />
                    </div>
                </div>

                {/* Risk & Rows */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0f172a] p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Risk</label>
                        <select 
                            value={risk} 
                            onChange={e => setRisk(e.target.value as any)}
                            className="bg-transparent w-full font-bold text-white outline-none text-xs uppercase"
                        >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                        </select>
                    </div>
                    <div className="bg-[#0f172a] p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Rows (8-16)</label>
                        <select 
                            value={rows} 
                            onChange={e => setRows(parseInt(e.target.value))}
                            className="bg-transparent w-full font-bold text-white outline-none text-xs"
                        >
                            {[8, 9, 10, 11, 12, 13, 14, 15, 16].map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs text-gray-400 font-bold px-2">
                    <span>Total Bet:</span>
                    <span className="text-white text-lg">₹{(betAmount * ballCount).toFixed(2)}</span>
                </div>

                <button 
                    onClick={handleBet}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition text-xl tracking-widest uppercase"
                >
                    BET
                </button>
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
              
