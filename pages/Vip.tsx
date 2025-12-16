import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { getUserProfile, getSystemSettings, claimLevelUpReward, redeemPromoCode, getReferrals } from '../services/userService';
import { UserProfile, SystemSettings } from '../types';
import { Crown, Star, Gift, Users, Copy, Share2, LogOut, CheckCircle, Award, Lock, ShieldCheck, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PromoSuccessPopup } from '../components/PromoSuccessPopup';

export const Vip = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [promoResult, setPromoResult] = useState<{message: string, amount: number} | null>(null);
    const [referrals, setReferrals] = useState<UserProfile[]>([]);
    const [showReferrals, setShowReferrals] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            const u = auth.currentUser;
            if (u) {
                const profile = await getUserProfile(u.uid);
                setUser(profile);
                setSettings(await getSystemSettings());
                if (profile) {
                    const refs = await getReferrals(u.uid);
                    setReferrals(refs);
                }
            }
        };
        load();
    }, []);

    const copyToClipboard = () => {
        if(user?.referralCode) {
            navigator.clipboard.writeText(user.referralCode);
            alert("Referral code copied to clipboard!");
        }
    };
    
    const copyId = () => {
        if(user?.numericId) {
            navigator.clipboard.writeText(user.numericId);
            alert("ID copied!");
        }
    };

    const handleLogout = async () => {
        await auth.signOut();
        navigate('/login');
    };

    const handleClaimLevelUp = async (level: number) => {
        if (!user) return;
        try {
            const amount = await claimLevelUpReward(user.uid, level);
            const updatedProfile = await getUserProfile(user.uid);
            setUser(updatedProfile);
            alert(`Congratulations! You claimed ₹${amount} for reaching VIP ${level}`);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRedeem = async () => {
        if (!user || !promoCode.trim()) return;
        
        const res = await redeemPromoCode(user.uid, promoCode);
        
        if (res.success && res.message && res.amount) {
            setPromoResult({ message: res.message, amount: res.amount });
            // Refresh User
            const u = await getUserProfile(user.uid);
            setUser(u);
            setPromoCode('');
        } else {
            alert(res.error || "Redemption Failed");
        }
    };

    if (!user || !settings || !settings.vipThresholds) {
        return <div className="p-10 text-center text-[#d93025]">Loading VIP Status...</div>;
    }

    const currentLevel = user.vipLevel;
    const nextLevel = Math.min(10, currentLevel + 1);
    const nextThreshold = settings.vipThresholds[currentLevel]; 
    
    const progress = currentLevel >= 10 
        ? 100 
        : Math.min(100, (user.totalWagered / (nextThreshold || 1)) * 100);

    return (
        <div className="min-h-screen bg-[#f7f8ff] pb-24">
             {/* Header Card */}
            <div className="bg-gradient-to-r from-[#d93025] to-[#f52c2c] p-6 pt-10 pb-16 rounded-b-[3rem] shadow-lg text-white text-center relative overflow-hidden">
                <div className="absolute top-[-20px] left-[-20px] opacity-10"><Crown size={150} /></div>
                <div className="absolute bottom-[-20px] right-[-20px] opacity-10"><Star size={150} /></div>

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-white rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg border-4 border-yellow-400">
                        <Crown size={40} className="text-yellow-500" fill="currentColor" />
                    </div>
                    <h1 className="text-2xl font-bold">{user.displayName}</h1>
                    <div className="inline-flex items-center gap-1 bg-black/20 px-3 py-1 rounded-full mt-2 text-sm backdrop-blur-sm">
                        <span className="text-yellow-400 font-black">VIP {currentLevel}</span>
                    </div>
                    
                    {/* User ID Display */}
                    {user.numericId && (
                         <div className="mt-4 flex justify-center">
                             <div 
                                onClick={copyId}
                                className="flex items-center justify-center gap-3 cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 py-2 px-6 rounded-xl transition shadow-lg group"
                             >
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] uppercase tracking-widest opacity-80 font-bold">Player ID</span>
                                    <span className="font-mono text-2xl font-black tracking-wider group-active:scale-95 transition">{user.numericId}</span>
                                </div>
                                <Copy size={18} className="opacity-70 group-hover:opacity-100" />
                             </div>
                         </div>
                    )}
                </div>
            </div>

            <div className="px-4 -mt-10 relative z-10 space-y-6">
                
                {/* Admin Access Button (Only for Admins) */}
                {user.role === 'admin' && (
                    <button 
                        onClick={() => navigate('/admin')}
                        className="w-full bg-black text-white p-4 rounded-2xl flex items-center justify-between shadow-xl hover:bg-gray-900 transition border border-gray-700"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-800 rounded-lg">
                                <ShieldCheck size={24} className="text-blue-400" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold">Admin Panel</h3>
                                <p className="text-xs text-gray-400">Manage system & finance</p>
                            </div>
                        </div>
                        <div className="bg-gray-800 px-3 py-1 rounded-full text-xs font-bold">ACCESS</div>
                    </button>
                )}
                
                {/* Mini Wallet Breakdown */}
                <div className="bg-white p-4 rounded-2xl shadow-lg grid grid-cols-2 gap-4">
                     <div className="text-center border-r border-gray-100">
                         <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Balance</p>
                         <p className="text-xl font-black text-gray-800">₹{(user.balance || 0).toFixed(0)}</p>
                     </div>
                     <div className="text-center">
                         <p className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center justify-center gap-1">Withdrawable <Wallet size={10}/></p>
                         <p className="text-xl font-black text-green-600">₹{(user.winningBalance || 0).toFixed(0)}</p>
                     </div>
                </div>

                {/* Gift Code Redemption */}
                <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <h2 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
                        <Gift size={20} className="text-[#d93025]" /> Redeem Gift Code
                    </h2>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="Enter code"
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#d93025] transition uppercase font-bold"
                        />
                        <button 
                            onClick={handleRedeem}
                            className="bg-[#d93025] text-white font-bold px-6 rounded-xl shadow-lg shadow-red-500/30 active:scale-95 transition"
                        >
                            Redeem
                        </button>
                    </div>
                </div>

                {/* Progress Card */}
                <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                             <p className="text-xs text-gray-400 font-bold uppercase">Current Progress</p>
                             <h3 className="text-gray-800 font-bold">To VIP {nextLevel}</h3>
                        </div>
                        {currentLevel < 10 && <span className="text-[#d93025] font-bold text-sm">{Math.floor(user.totalWagered)} / {nextThreshold}</span>}
                    </div>
                    <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-full rounded-full transition-all duration-1000 shadow-sm" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    {currentLevel >= 10 && <p className="text-center text-yellow-500 text-xs mt-2 font-bold">MAX LEVEL REACHED</p>}
                </div>

                {/* Referral Card */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                    <h2 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
                        <Users size={20} className="text-[#d93025]" /> Referral Program
                    </h2>
                    
                    <div className="bg-[#f7f8ff] p-4 rounded-xl mb-4 border border-dashed border-[#d93025]/30 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Your Invite Code</p>
                            <p className="text-xl font-mono text-gray-900 font-black tracking-widest">{user.referralCode}</p>
                        </div>
                        <button onClick={copyToClipboard} className="bg-white p-2 rounded-lg text-[#d93025] border border-gray-200 shadow-sm hover:bg-gray-50 transition">
                            <Copy size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                            <p className="text-gray-400 text-xs mb-1">Total Invited</p>
                            <p className="text-2xl font-bold text-gray-800">{user.referralCount || 0}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                            <p className="text-gray-400 text-xs mb-1">Total Earnings</p>
                            <p className="text-2xl font-bold text-green-600">₹{user.referralEarnings?.toFixed(2) || '0.00'}</p>
                        </div>
                    </div>
                    
                    <div className="mt-4 border-t border-gray-100 pt-3">
                        <button 
                            onClick={() => setShowReferrals(!showReferrals)} 
                            className="w-full flex justify-between items-center text-xs text-gray-500 font-bold hover:text-gray-700 transition"
                        >
                            <span className="flex items-center gap-1"><Users size={14}/> My Referrals List ({referrals.length})</span>
                            {showReferrals ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        
                        {showReferrals && (
                            <div className="mt-3 max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar animate-slide-up">
                                {referrals.length > 0 ? (
                                    referrals.map((refUser, index) => (
                                        <div key={index} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                    {index + 1}
                                                </div>
                                                <span className="font-mono text-[10px] text-gray-600 font-bold bg-white px-2 py-0.5 rounded border border-gray-200">
                                                    ID: {refUser.numericId || '------'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-xs text-gray-400 py-2 italic">No referrals yet</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex items-center justify-center text-xs text-gray-400 bg-gray-50 py-2 rounded-lg">
                        <Share2 size={14} className="mr-1" /> Earn ₹{settings.referralBonus} per friend invited
                    </div>
                </div>

                {/* Privileges */}
                <div>
                     <h2 className="text-gray-800 font-bold mb-4 flex items-center gap-2 px-2">
                        <Star size={20} className="text-yellow-500" fill="currentColor" /> Member Privileges
                    </h2>
                    <div className="space-y-3">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => {
                        const isUnlocked = user.vipLevel >= level;
                        const req = settings.vipThresholds[level-1];
                        const dailyReward = settings.vipDailyRewards ? settings.vipDailyRewards[level-1] : 0;
                        const levelUpReward = settings.vipLevelUpRewards ? settings.vipLevelUpRewards[level-1] : 0;
                        
                        const isClaimed = user.claimedLevelUpRewards?.includes(level);
                        const canClaim = isUnlocked && !isClaimed && levelUpReward > 0;

                        return (
                            <div key={level} className={`relative p-4 rounded-xl border transition ${isUnlocked ? 'bg-white border-yellow-400 shadow-md' : 'bg-gray-100 border-gray-200 opacity-60'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isUnlocked ? 'bg-yellow-400 text-white' : 'bg-gray-300 text-gray-500'}`}>
                                            <Crown size={14} fill="currentColor" />
                                        </div>
                                        <span className={`font-bold ${isUnlocked ? 'text-gray-800' : 'text-gray-400'}`}>VIP {level}</span>
                                    </div>
                                    {!isUnlocked && <Lock size={16} className="text-gray-400" />}
                                    {isUnlocked && (
                                        canClaim ? (
                                            <button 
                                                onClick={() => handleClaimLevelUp(level)}
                                                className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow hover:bg-red-600 active:scale-95 transition"
                                            >
                                                Claim ₹{levelUpReward}
                                            </button>
                                        ) : isClaimed ? (
                                             <span className="text-green-500 text-xs font-bold flex items-center gap-1">
                                                <CheckCircle size={12} /> Claimed
                                             </span>
                                        ) : null
                                    )}
                                </div>
                                
                                <p className="text-xs text-gray-400 mb-3 pl-10">Wager Required: ₹{req.toLocaleString()}</p>
                                
                                <div className="grid grid-cols-2 gap-2 pl-10">
                                    <div className="flex items-center gap-1">
                                        <Gift size={12} className="text-blue-500" />
                                        <span className="text-[10px] text-gray-500 font-medium">Daily: ₹{dailyReward}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Award size={12} className="text-purple-500" />
                                        <span className="text-[10px] text-gray-500 font-medium">Level Up: ₹{levelUpReward}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>

                <button onClick={handleLogout} className="w-full bg-white text-[#d93025] font-bold py-3.5 rounded-full border border-[#d93025] flex items-center justify-center gap-2 shadow-sm hover:bg-red-50 transition">
                    <LogOut size={18} /> Log Out
                </button>
            </div>
            
            {promoResult && (
                <PromoSuccessPopup 
                    message={promoResult.message} 
                    amount={promoResult.amount} 
                    onClose={() => setPromoResult(null)}
                />
            )}
        </div>
    );
};
