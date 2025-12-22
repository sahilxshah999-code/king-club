import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { getUserProfile, getSystemSettings, getReferrals, redeemGiftCode, claimLevelUpBonus } from '../services/userService';
import { UserProfile, SystemSettings } from '../types';
import { Crown, ShieldCheck, ClipboardList, Headphones, Copy, LogOut, Users, Wallet, ChevronRight, Gift, Key, CheckCircle, Lock, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../components/Toast';
import { PromoSuccessPopup } from '../components/PromoSuccessPopup';

const LOGO_URL = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133446.png";

export const Vip = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [refCount, setRefCount] = useState(0);
    const [promoCode, setPromoCode] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'rewards'>('overview');
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [successPopup, setSuccessPopup] = useState<{msg: string, amt: number} | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(async (u) => {
            if (u) {
                onValue(ref(db, `users/${u.uid}`), (snap) => { if(snap.exists()) setUser(snap.val()); });
                setSettings(await getSystemSettings());
                getReferrals(u.uid).then(refs => setRefCount(refs.length));
            } else navigate('/login');
        });
        return () => unsub();
    }, [navigate]);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({message: msg, type});

    const copyCode = () => {
        if(user?.referralCode) {
            navigator.clipboard.writeText(user.referralCode);
            showToast("Referral Code Copied!");
        }
    };

    const handleShare = () => {
        if (!user?.referralCode) return;
        const shareUrl = `https://www.kingclub.rf.gd/#/register?code=${user.referralCode}`;
        
        const copyToClipboard = (text: string) => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text)
                    .then(() => showToast("Invite Link Copied!"))
                    .catch(() => fallbackCopy(text));
            } else {
                fallbackCopy(text);
            }
        };

        const fallbackCopy = (text: string) => {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) showToast("Invite Link Copied!");
                else showToast("Failed to copy", 'error');
            } catch (err) {
                showToast("Failed to copy", 'error');
            }
        };

        copyToClipboard(shareUrl);
    };

    const handleRedeem = async () => {
        if(!promoCode) return showToast("Please enter a code", 'error');
        if(!user) return;
        try {
            const result = await redeemGiftCode(user.uid, promoCode);
            setSuccessPopup({ msg: result.message || "Gift Code Redeemed Successfully!", amt: result.amount });
            setPromoCode('');
        } catch (e: any) { showToast(e.message, 'error'); }
    };

    const handleClaimLevelReward = async (levelIdx: number) => {
        if(!user) return;
        try {
            const amount = await claimLevelUpBonus(user.uid, levelIdx);
            setSuccessPopup({ msg: `VIP ${levelIdx} Reward Claimed!`, amt: amount });
        } catch (e: any) { showToast(e.message, 'error'); }
    };

    if (!user || !settings) return <div className="min-h-screen bg-black flex items-center justify-center text-yellow-500 font-black animate-pulse">LOADING...</div>;

    const vipProgress = Math.min(100, (user.totalDeposited / (settings.vipThresholds?.[user.vipLevel + 1] || 100000)) * 100);

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-24 font-sans text-white relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-purple-900/20 to-transparent pointer-events-none"></div>
            
            {/* Header */}
            <div className="p-6 pt-10 pb-8 relative z-10 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-b-[3rem] shadow-2xl border-b border-white/5">
                <div className="flex items-center gap-5 mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-black border border-yellow-500/30 p-1 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                        <img src={LOGO_URL} className="w-full h-full object-contain rounded-xl" alt="Avatar" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-wide">{user.displayName}</h1>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-mono text-gray-400 border border-white/5">UID: {user.numericId}</span>
                            <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-lg">
                                <Crown size={12} fill="currentColor" /> VIP {user.vipLevel}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex bg-[#121212] p-1.5 rounded-2xl border border-white/5 relative z-10 shadow-inner">
                    <button onClick={() => setActiveTab('overview')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'overview' ? 'bg-[#d93025] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Overview</button>
                    <button onClick={() => setActiveTab('rewards')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'rewards' ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>
                        VIP Rewards <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-4 space-y-5 relative z-10">
                
                {activeTab === 'overview' && (
                    <>
                        {/* Gift Code */}
                        <div className="bg-[#121212] p-6 rounded-[2rem] border border-white/5 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
                            <div className="flex items-center gap-2 mb-4 relative z-10">
                                <Key size={18} className="text-yellow-500" />
                                <h3 className="font-black text-sm uppercase tracking-widest text-white/80">Redeem Code</h3>
                            </div>
                            <div className="flex gap-2 relative z-10">
                                <input 
                                    value={promoCode}
                                    onChange={e => setPromoCode(e.target.value)}
                                    placeholder="Enter Code" 
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500/50 transition placeholder-gray-600" 
                                />
                                <button onClick={handleRedeem} className="bg-gradient-to-r from-red-600 to-red-800 text-white font-black px-6 rounded-xl uppercase text-xs active:scale-95 transition shadow-lg shadow-red-900/30">Claim</button>
                            </div>
                        </div>

                        {/* Referral */}
                        <div className="bg-gradient-to-br from-[#202020] to-black p-6 rounded-[2rem] shadow-xl relative overflow-hidden border border-white/5">
                            <div className="flex justify-between items-start relative z-10 mb-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">My Invite Code</p>
                                    <div onClick={copyCode} className="flex items-center gap-2 cursor-pointer active:opacity-70 group mb-3">
                                        <span className="text-3xl font-black tracking-widest text-white">{user.referralCode}</span>
                                        <Copy size={18} className="text-gray-600 group-hover:text-yellow-500 transition"/>
                                    </div>
                                    <button onClick={handleShare} className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-1.5 rounded-full text-[10px] font-black uppercase active:scale-95 transition">
                                        <Share2 size={12} /> Share Invite Link
                                    </button>
                                </div>
                                <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                                    <Users size={24} className="text-yellow-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Total Team</p>
                                    <p className="text-2xl font-black text-white">{refCount}</p>
                                </div>
                                <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Commission</p>
                                    <p className="text-2xl font-black text-green-500">₹{(user.referralEarnings || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Links */}
                        <div className="bg-[#121212] rounded-[2rem] border border-white/5 overflow-hidden shadow-xl">
                            {user.role === 'admin' && (
                                <button onClick={() => navigate('/admin')} className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition border-b border-white/5 group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-blue-500/10 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition text-blue-500"><ShieldCheck size={20} /></div>
                                        <span className="text-sm font-bold text-gray-300 group-hover:text-white">Admin Panel</span>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600" />
                                </button>
                            )}
                            <button onClick={() => navigate('/activity')} className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition border-b border-white/5 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-red-500/10 rounded-xl group-hover:bg-red-600 group-hover:text-white transition text-red-500"><ClipboardList size={20} /></div>
                                    <span className="text-sm font-bold text-gray-300 group-hover:text-white">Activity Center</span>
                                </div>
                                <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded font-black uppercase">New</span>
                            </button>
                            <button onClick={() => window.open(settings.customerServiceUrl, '_blank')} className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition border-b border-white/5 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition text-indigo-500"><Headphones size={20} /></div>
                                    <span className="text-sm font-bold text-gray-300 group-hover:text-white">Support</span>
                                </div>
                                <ChevronRight size={16} className="text-gray-600" />
                            </button>
                            <button onClick={() => navigate('/wallet')} className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-green-500/10 rounded-xl group-hover:bg-green-600 group-hover:text-white transition text-green-500"><Wallet size={20} /></div>
                                    <span className="text-sm font-bold text-gray-300 group-hover:text-white">Wallet History</span>
                                </div>
                                <ChevronRight size={16} className="text-gray-600" />
                            </button>
                        </div>

                        <button onClick={() => auth.signOut().then(() => navigate('/login'))} className="w-full py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-widest hover:text-white transition flex items-center justify-center gap-2">
                            <LogOut size={14} /> Log Out
                        </button>
                    </>
                )}

                {activeTab === 'rewards' && (
                    <div className="space-y-6">
                        <div className="bg-[#121212] p-8 rounded-[2rem] border border-yellow-500/20 shadow-[0_0_40px_rgba(234,179,8,0.1)] text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
                            <h2 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-2">Current Status</h2>
                            <div className="text-5xl font-black text-yellow-500 mb-2 drop-shadow-xl">VIP {user.vipLevel}</div>
                            <p className="text-[10px] text-gray-500 mb-8 font-bold">Deposit to upgrade and unlock exclusive rewards</p>
                            
                            <div className="relative h-3 bg-black rounded-full overflow-hidden border border-white/10 mb-2">
                                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000" style={{width: `${vipProgress}%`}}></div>
                            </div>
                            <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase">
                                <span>₹{user.totalDeposited}</span>
                                <span>Target: ₹{settings.vipThresholds?.[user.vipLevel + 1] || 'MAX'}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {settings.vipLevelUpRewards?.map((reward, i) => {
                                const isUnlocked = user.vipLevel >= i;
                                const isClaimed = user.claimedLevelUpRewards?.includes(i);
                                const isLocked = !isUnlocked;
                                if (i === 0) return null;

                                return (
                                    <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isLocked ? 'bg-white/5 border-white/5 opacity-50' : 'bg-[#151515] border-yellow-500/30 shadow-lg'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${isLocked ? 'border-gray-700 bg-black' : 'border-yellow-500 bg-yellow-500/10'}`}>
                                                {isLocked ? <Lock size={18} className="text-gray-600"/> : <Crown size={20} className="text-yellow-500" fill="currentColor" />}
                                            </div>
                                            <div>
                                                <h3 className={`font-black text-sm uppercase ${isLocked ? 'text-gray-500' : 'text-white'}`}>VIP {i} Reward</h3>
                                                <p className={`text-xs font-bold ${isLocked ? 'text-gray-600' : 'text-yellow-500'}`}>₹{reward}</p>
                                            </div>
                                        </div>
                                        {isClaimed ? (
                                            <div className="flex items-center gap-1 text-green-500 text-[10px] font-black uppercase bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
                                                <CheckCircle size={12} /> Claimed
                                            </div>
                                        ) : isLocked ? (
                                            <div className="text-gray-600 text-[10px] font-black uppercase bg-black px-3 py-1.5 rounded-lg border border-white/10">Locked</div>
                                        ) : (
                                            <button onClick={() => handleClaimLevelReward(i)} className="bg-yellow-500 text-black text-[10px] font-black uppercase px-5 py-2 rounded-lg shadow-lg shadow-yellow-500/20 active:scale-95 transition hover:bg-yellow-400">Claim</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {successPopup && <PromoSuccessPopup message={successPopup.msg} amount={successPopup.amt} onClose={() => setSuccessPopup(null)} />}
        </div>
    );
};
                                    
