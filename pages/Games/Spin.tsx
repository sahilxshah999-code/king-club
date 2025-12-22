
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { getSystemSettings, getUserProfile, processSpin } from '../../services/userService';
import { UserProfile, SystemSettings } from '../../types';
import { ChevronLeft, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';
import { Toast } from '../../components/Toast';
import { ref, onValue } from 'firebase/database';

export const Spin = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [betAmount] = useState(50); // Fixed at 50 as per requirement
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [onlinePlayers, setOnlinePlayers] = useState(250);

    useEffect(() => {
        // Fake Players 50-500
        setOnlinePlayers(Math.floor(Math.random() * (500 - 50 + 1)) + 50);
        const playerInterval = setInterval(() => {
            setOnlinePlayers(prev => {
                const change = Math.floor(Math.random() * 10) - 5; 
                let next = prev + change;
                if (next < 50) next = 50;
                if (next > 500) next = 500;
                return next;
            });
        }, 3000);

        const load = async () => {
            setSettings(await getSystemSettings());
        };
        load();

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
        }
        return () => clearInterval(playerInterval);
    }, [navigate]);

    const showToast = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ message: msg, type });
    };

    const handleSpin = async () => {
        if (!user || !settings || isSpinning) return;
        if (user.balance < betAmount) {
            showToast("Insufficient balance! Spin costs ₹" + betAmount, 'error');
            return;
        }

        setIsSpinning(true);
        setPopup(null);
        
        // Use any to bypass union type property access errors
        const result: any = await processSpin(user.uid, betAmount);

        if (!result.success || result.prizeIndex === undefined || result.prizeValue === undefined) {
            setIsSpinning(false);
            showToast(result.error || "Spin failed", 'error');
            return;
        }

        setUser(prev => prev ? { ...prev, balance: result.newBalance || prev.balance } : null);

        const segmentAngle = 360 / settings.spinPrizes.length;
        const extraRotations = 360 * (5 + Math.floor(Math.random() * 5));
        const targetRotation = extraRotations + (360 - (result.prizeIndex * segmentAngle));
        
        setRotation(targetRotation);

        setTimeout(() => {
            setIsSpinning(false);
            
            if (result.prizeValue > 0) {
                setPopup({ type: 'win', amount: result.prizeValue });
            } else {
                setPopup({ type: 'loss', amount: betAmount });
            }
        }, 5000); 
    };

    if (!settings) return <div className="text-center text-[#d93025] p-10">Loading Wheel...</div>;

    return (
        <div className="min-h-screen bg-[#d93025] pb-20 flex flex-col items-center overflow-hidden relative">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle,_#fbbf24_2px,_transparent_2px)] bg-[length:30px_30px]"></div>

             <div className="w-full flex justify-between items-center p-4 z-10 text-white">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/')}><ChevronLeft /></button>
                    <span className="font-bold text-xl uppercase tracking-widest text-yellow-300 drop-shadow-md">Lucky Spin</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                        <User size={10} className="text-white" />
                        <span className="text-[10px] font-bold text-white">{onlinePlayers.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/30 px-3 py-1 rounded-full text-sm border border-white/20">₹{(user?.balance || 0).toFixed(2)}</div>
                </div>
            </div>

            <div className="relative mt-8 z-10">
                <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 z-30 filter drop-shadow-lg">
                    <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-white"></div>
                </div>

                <div 
                    className="w-80 h-80 rounded-full border-8 border-yellow-400 shadow-[0_0_40px_rgba(251,191,36,0.6)] relative overflow-hidden transition-transform cubic-bezier(0.25, 0.1, 0.25, 1) bg-white"
                    style={{ 
                        transform: `rotate(${rotation}deg)`,
                        transitionDuration: isSpinning ? '5s' : '0s',
                        background: 'conic-gradient(#fca5a5 0% 12.5%, #ffffff 12.5% 25%, #fca5a5 25% 37.5%, #ffffff 37.5% 50%, #fca5a5 50% 62.5%, #ffffff 62.5% 75%, #fca5a5 75% 87.5%, #ffffff 87.5% 100%)'
                    }}
                >
                    {settings.spinPrizes.map((p, i) => {
                        const angle = 360 / settings.spinPrizes.length;
                        return (
                            <div 
                                key={i}
                                className="absolute top-0 left-0 w-full h-full flex justify-center pt-6 text-[#d93025] font-black text-xl"
                                style={{ transform: `rotate(${i * angle}deg)` }}
                            >
                                <span className="transform rotate-0">{p}</span>
                            </div>
                        );
                    })}
                </div>
                
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-yellow-400 rounded-full border-4 border-white z-20 shadow-lg flex items-center justify-center">
                   <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
            </div>

            <div className="text-center mt-10 z-10">
                <button 
                    onClick={handleSpin}
                    disabled={isSpinning}
                    className="bg-gradient-to-b from-yellow-300 to-yellow-500 text-[#d93025] font-black text-2xl py-4 px-16 rounded-full shadow-xl shadow-yellow-500/40 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed border-b-4 border-yellow-600"
                >
                    {isSpinning ? '...' : `SPIN ₹${betAmount}`}
                </button>
                <div className="mt-4 flex flex-col gap-1">
                    <p className="text-white/70 text-xs font-medium">Fixed Bet: ₹50 | Win up to ₹500</p>
                    <p className="text-white/90 text-[10px] font-black uppercase tracking-widest bg-black/20 inline-block px-3 py-1 rounded-full mx-auto">
                        Limit: 3 Spins / Day (6H Cooldown)
                    </p>
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
