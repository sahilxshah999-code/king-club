
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { UserProfile } from '../types';

interface Props {
    user: UserProfile | null;
    onClose: () => void;
}

const TIERS = [
    { target: 500, bonus: 20 },
    { target: 1000, bonus: 50 },
    { target: 3000, bonus: 100 },
    { target: 5000, bonus: 300 },
];

export const FirstDepositBonusPopup: React.FC<Props> = ({ user, onClose }) => {
    const navigate = useNavigate();
    const [noRemind, setNoRemind] = useState(false);

    const handleClose = () => {
        if (noRemind) {
            const today = new Date().toDateString();
            localStorage.setItem('hideDepositBonusDate', today);
        }
        onClose();
    };

    const currentDeposit = user?.totalDeposited || 0;

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 p-6 animate-fade-in backdrop-blur-sm">
            <div className="relative w-full max-w-sm flex flex-col items-center animate-slide-up">
                {/* Main Card */}
                <div className="w-full bg-[#f7f8ff] rounded-[2rem] overflow-hidden shadow-2xl relative">
                    {/* Header */}
                    <div className="bg-[#fbbf24] p-5 text-center relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-white text-lg font-bold tracking-wide drop-shadow-sm">Extra first deposit bonus</h2>
                            <p className="text-white/90 text-[11px] mt-1 font-medium">Each account can only receive rewards once</p>
                        </div>
                        {/* Decor */}
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>
                        <div className="absolute top-[-10px] right-[-10px] w-16 h-16 bg-white/20 rounded-full blur-lg"></div>
                    </div>

                    {/* Content List */}
                    <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto no-scrollbar">
                        {TIERS.map((tier, i) => {
                            const progress = Math.min(100, (currentDeposit / tier.target) * 100);
                            const isCompleted = currentDeposit >= tier.target;
                            
                            return (
                                <div key={i} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-1 relative z-10">
                                        <div className="text-sm font-bold text-gray-700 flex items-center gap-1">
                                            First deposit <span className="text-[#fbbf24] text-lg font-black">{tier.target}</span>
                                        </div>
                                        <div className="text-[#fbbf24] font-black text-sm tracking-tight">+ ₹{tier.bonus.toFixed(2)}</div>
                                    </div>
                                    
                                    <p className="text-[10px] text-gray-400 mb-3 leading-tight font-medium relative z-10">
                                        Deposit {tier.target} for the first time and you will receive {tier.bonus} bonus
                                    </p>
                                    
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="flex-1 relative h-5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                            <div 
                                                className="absolute top-0 left-0 h-full bg-[#fbbf24] transition-all duration-1000"
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-gray-600 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                                                {currentDeposit}/{tier.target}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                onClose();
                                                navigate('/wallet', { state: { tab: 'deposit' } });
                                            }}
                                            className="px-5 py-1.5 rounded-lg border border-[#fbbf24] text-[#fbbf24] text-[11px] font-bold hover:bg-[#fbbf24] hover:text-white transition uppercase active:scale-95"
                                        >
                                            Deposit
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 pt-2 bg-[#f7f8ff] flex justify-between items-center">
                        <div 
                            onClick={() => setNoRemind(!noRemind)}
                            className="flex items-center gap-2 cursor-pointer group"
                        >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${noRemind ? 'border-[#fbbf24] bg-[#fbbf24]' : 'border-gray-300 bg-white group-hover:border-[#fbbf24]'}`}>
                                {noRemind && <Check size={12} className="text-white" strokeWidth={3} />}
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold group-hover:text-gray-700 transition">No more reminders today</span>
                        </div>
                        <button 
                            onClick={handleClose}
                            className="bg-[#fbbf24] text-white px-8 py-2.5 rounded-full font-black text-sm shadow-[0_5px_15px_rgba(251,191,36,0.4)] active:scale-95 transition tracking-wide"
                        >
                            Activity
                        </button>
                    </div>
                </div>

                {/* Close Button Outside */}
                <button 
                    onClick={handleClose}
                    className="mt-6 w-10 h-10 rounded-full border-2 border-white/80 flex items-center justify-center text-white hover:bg-white/20 transition active:scale-90"
                >
                    <X size={24} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
};
