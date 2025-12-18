import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { Transaction, SystemSettings, UserProfile, BannerItem, Notification, LeaderboardEntry } from '../types';
import { 
    getUserProfile, 
    getSystemSettings, 
    updateSystemSettings, 
    getUidFromReferralCode, 
    getReferrals, 
    setWingoNextResult, 
    getWingoNextResult, 
    approveDeposit, 
    approveWithdrawal, 
    createPromoCode, 
    getAdmins, 
    findUserByEmail, 
    updateUserRole, 
    findUserByNumericId,
    publishNotification,
    deleteNotification
} from '../services/userService';
import { 
    ChevronLeft, Shield, CheckCircle, Gift, Users, Trash2, 
    Settings, IndianRupee, Image as ImageIcon, 
    LayoutDashboard, CreditCard, ExternalLink, Link as LinkIcon, UserPlus, Bell, PartyPopper, Trophy, Smartphone, Search, RefreshCw, Key
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AdminTab = 'finance' | 'system' | 'users' | 'wingo' | 'leaderboard' | 'link';

function snapshotToArray<T>(snapshot: any): T[] {
    const val = snapshot.val();
    if (!val) return [];
    return Object.values(val) as T[];
}

export const Admin = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<AdminTab>('finance');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentAdminUid, setCurrentAdminUid] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
    const [settings, setSettings] = useState<SystemSettings>({
        referralBonus: 0,
        referralDepositBonusPercent: 0,
        depositBonusPercent: 0,
        homeBanners: [],
        adminUpiId: '',
        adminQrCodeUrl: '',
        adminUsdtAddress: '',
        adminUsdtQrCodeUrl: '',
        spinPrizes: [],
        vipThresholds: [],
        vipDailyRewards: [],
        vipLevelUpRewards: [],
        customerServiceUrl: '',
        forgotPasswordUrl: '',
        privacyPolicyUrl: '',
        minDeposit: 100,
        maxDeposit: 100000,
        minWithdraw: 100,
        maxWithdraw: 100000,
        notificationText: '',
        welcomeMessage: '',
        leaderboard: []
    });
    
    const [spinPrizesStr, setSpinPrizesStr] = useState('');
    const [vipThresholdsStr, setVipThresholdsStr] = useState('');
    const [vipDailyStr, setVipDailyStr] = useState('');
    const [vipLevelUpStr, setVipLevelUpStr] = useState('');
    const [newBannerUrl, setNewBannerUrl] = useState('');
    const [newBannerLink, setNewBannerLink] = useState('');
    const [lbEntries, setLbEntries] = useState<LeaderboardEntry[]>([]);
    const [notifTitle, setNotifTitle] = useState('');
    const [notifContent, setNotifContent] = useState('');
    const [wingoResultInput, setWingoResultInput] = useState<number | ''>('');
    const [currentWingoForced, setCurrentWingoForced] = useState<number | null>(null);
    const [searchRefInput, setSearchRefInput] = useState('');
    const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
    const [searchStatus, setSearchStatus] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState<number | ''>('');
    const [promoUsers, setPromoUsers] = useState<number | ''>('');
    const [promoDays, setPromoDays] = useState<number | ''>('');
    const [promoMsg, setPromoMsg] = useState('Congratulations #username! Here is your gift.');
    const [promoRequiresDeposit, setPromoRequiresDeposit] = useState(false);
    const [promoRequiredDepositAmount, setPromoRequiredDepositAmount] = useState<number | ''>('');
    const [adminList, setAdminList] = useState<UserProfile[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [userDetailsInput, setUserDetailsInput] = useState('');
    const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isRefSearching, setIsRefSearching] = useState(false);

    useEffect(() => {
        const checkAdmin = async () => {
            const u = auth.currentUser;
            if(u) {
                setCurrentAdminUid(u.uid);
                const profile = await getUserProfile(u.uid);
                if(profile?.role === 'admin') {
                    setIsAdmin(true);
                    loadAdmins();
                } else { navigate('/'); }
            } else { navigate('/login'); }
        };
        checkAdmin();

        const txRef = ref(db, 'transactions');
        const unsubTx = onValue(txRef, (snap) => {
            const data = snapshotToArray<Transaction>(snap);
            data.sort((a, b) => b.timestamp - a.timestamp);
            setTransactions(data);
        });

        const notifRef = ref(db, 'notifications');
        const unsubNotif = onValue(notifRef, (snap) => {
            if (snap.exists()) {
                const data = Object.values(snap.val()) as Notification[];
                data.sort((a, b) => b.timestamp - a.timestamp);
                setNotifications(data);
            } else { setNotifications([]); }
        });

        getSystemSettings().then(s => {
            setSettings(s);
            setSpinPrizesStr(s.spinPrizes ? s.spinPrizes.join(', ') : '');
            setVipThresholdsStr(s.vipThresholds ? s.vipThresholds.join(', ') : '');
            setVipDailyStr(s.vipDailyRewards ? s.vipDailyRewards.join(', ') : '');
            setVipLevelUpStr(s.vipLevelUpRewards ? s.vipLevelUpRewards.join(', ') : '');
            if (s.leaderboard) { setLbEntries(s.leaderboard); } 
            else { setLbEntries(Array.from({ length: 10 }, () => ({ name: '', userId: '', amount: 0, gender: 'male' }))); }
        });

        getWingoNextResult().then(setCurrentWingoForced);
        return () => { unsubTx(); unsubNotif(); };
    }, [navigate]);

    const loadAdmins = async () => setAdminList(await getAdmins());
    const showSuccess = (msg: string) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(''), 3000); };

    const handleAction = async (tx: Transaction, action: 'approved' | 'rejected') => {
        if(!isAdmin) return;
        await update(ref(db, `transactions/${tx.id}`), { status: action });
        if(action === 'approved') {
            if (tx.type === 'deposit') await approveDeposit(tx.uid, tx.amount);
            else if (tx.type === 'withdraw') await approveWithdrawal(tx.uid, tx.amount);
        }
        showSuccess(`Transaction ${action}`);
    };

    const saveSettings = async () => {
        const prizes = spinPrizesStr.split(',').map(s => parseInt(s.trim()) || 0);
        const thresholds = vipThresholdsStr.split(',').map(s => parseInt(s.trim()) || 0);
        const dailyRewards = vipDailyStr.split(',').map(s => parseInt(s.trim()) || 0);
        const levelUpRewards = vipLevelUpStr.split(',').map(s => parseInt(s.trim()) || 0);
        const newSettings = { ...settings, spinPrizes: prizes, vipThresholds: thresholds, vipDailyRewards: dailyRewards, vipLevelUpRewards: levelUpRewards, leaderboard: lbEntries };
        await updateSystemSettings(newSettings);
        setSettings(newSettings);
        showSuccess("Settings Saved!");
    };

    const handlePublishNotification = async () => {
        if (!notifTitle.trim() || !notifContent.trim()) return;
        await publishNotification(notifTitle.trim(), notifContent.trim());
        setNotifTitle(''); setNotifContent(''); showSuccess("Notification Published!");
    };

    const handleDeleteNotif = async (id: string) => { if (window.confirm("Delete notification?")) { await deleteNotification(id); showSuccess("Notification Deleted"); } };

    const addBanner = () => {
        if (!newBannerUrl.trim()) return;
        const updated = [...(settings.homeBanners || []), { imageUrl: newBannerUrl.trim(), link: newBannerLink.trim() }];
        setSettings({...settings, homeBanners: updated}); setNewBannerUrl(''); setNewBannerLink('');
    };

    const removeBanner = (index: number) => {
        const updatedBanners = (settings.homeBanners || []).filter((_, i) => i !== index);
        setSettings({...settings, homeBanners: updatedBanners});
    };

    const handleWingoControl = async (reset: boolean = false) => {
        if (reset) { await setWingoNextResult(null); setCurrentWingoForced(null); setWingoResultInput(''); showSuccess("Auto Mode Enabled"); } 
        else {
            const val = Number(wingoResultInput);
            if (wingoResultInput === '' || isNaN(val) || val < 0 || val > 9) { alert("Invalid (0-9)"); return; }
            await setWingoNextResult(val); setCurrentWingoForced(val); showSuccess("Wingo Set: " + val);
        }
    };

    const handleReferralSearch = async () => {
        if (!searchRefInput.trim()) return;
        setIsRefSearching(true);
        setSearchStatus('Searching...');
        setReferredUsers([]);
        
        let targetUid = searchRefInput.trim();
        // If searching by referral code or short numeric ID
        if (targetUid.length < 15) {
            const resolved = await getUidFromReferralCode(targetUid);
            if (resolved) targetUid = resolved;
            else {
                // Try searching by numericId if code lookup fails
                const user = await findUserByNumericId(targetUid);
                if (user) targetUid = user.uid;
                else {
                    setSearchStatus('No user found for this Code/ID');
                    setIsRefSearching(false);
                    return;
                }
            }
        }
        
        const referrals = await getReferrals(targetUid);
        setReferredUsers(referrals);
        setSearchStatus(referrals.length > 0 ? `Found ${referrals.length} referrals` : 'This user has no referrals');
        setIsRefSearching(false);
    };

    const handleCreatePromo = async () => {
        if (!promoCode || !promoAmount || !promoUsers || !promoDays) { alert("Please fill all required fields"); return; }
        await createPromoCode(promoCode, Number(promoAmount), Number(promoUsers), Number(promoDays), promoMsg, promoRequiresDeposit, Number(promoRequiredDepositAmount) || 0);
        showSuccess("Gift Code Created!");
        setPromoCode(''); setPromoAmount('');
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim()) return;
        const user = await findUserByEmail(newAdminEmail);
        if (!user) { alert("User not found"); return; }
        if(window.confirm(`Promote ${user.displayName}?`)) { await updateUserRole(user.uid, 'admin'); showSuccess("Promoted"); setNewAdminEmail(''); loadAdmins(); }
    };

    const handleUserSearch = async () => {
        if(!userDetailsInput.trim()) return;
        setIsSearching(true);
        setSearchedUser(null);
        const input = userDetailsInput.trim();
        let user = await findUserByNumericId(input) || await findUserByEmail(input) || await getUserProfile(input);
        setSearchedUser(user);
        setIsSearching(false);
        if(!user) alert("User not found for: " + input);
    };

    const updateLbEntry = (index: number, field: keyof LeaderboardEntry, value: any) => {
        const newEntries = [...lbEntries]; newEntries[index] = { ...newEntries[index], [field]: value }; setLbEntries(newEntries);
    };

    if(!isAdmin) return <div className="p-10 text-center text-red-500 font-bold">Access Denied</div>;

    const navItemClass = (tab: AdminTab) => `flex-1 py-3 text-[11px] font-black uppercase tracking-tight flex flex-col items-center gap-1 ${activeTab === tab ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:bg-gray-50 transition'}`;

    return (
        <div className="bg-[#f0f2f5] pb-24 relative min-h-full">
             <div className="bg-black text-white p-4 shadow-lg sticky top-0 z-50">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => navigate('/profile')} className="p-1 hover:bg-white/20 rounded-full transition"><ChevronLeft /></button>
                    <h1 className="text-lg font-bold flex items-center gap-2"><Shield size={18} fill="white" className="text-blue-500" /> Admin Console</h1>
                </div>
                <div className="flex bg-white rounded-lg overflow-hidden shadow-sm flex-wrap">
                    <button onClick={() => setActiveTab('finance')} className={navItemClass('finance')}><IndianRupee size={16} /> Finance</button>
                    <button onClick={() => setActiveTab('link')} className={navItemClass('link')}><LinkIcon size={16} /> Links</button>
                    <button onClick={() => setActiveTab('system')} className={navItemClass('system')}><Settings size={16} /> System</button>
                    <button onClick={() => setActiveTab('users')} className={navItemClass('users')}><Users size={16} /> Users</button>
                    <button onClick={() => setActiveTab('wingo')} className={navItemClass('wingo')}><LayoutDashboard size={16} /> Wingo</button>
                    <button onClick={() => setActiveTab('leaderboard')} className={navItemClass('leaderboard')}><Trophy size={16} /> Leader</button>
                </div>
            </div>
            
            <div className="p-4 space-y-6">
                {/* FINANCE TAB */}
                {activeTab === 'finance' && (
                    <div className="space-y-4">
                        <h2 className="text-gray-900 font-black text-lg mb-2 border-l-4 border-blue-500 pl-2">Pending Approvals</h2>
                        {transactions.filter(t => t.status === 'pending').map(tx => (
                            <div key={tx.id} className="bg-white p-4 rounded-xl shadow-md border border-gray-100 animate-fade-in">
                                <div className="flex justify-between mb-2">
                                    <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${tx.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.type}</span>
                                    <span className="text-gray-900 font-black">₹{tx.amount}</span>
                                </div>
                                <div className="text-xs text-gray-700 mb-3 font-mono break-all bg-gray-50 p-2 rounded border border-gray-100">{tx.details}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleAction(tx, 'approved')} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold shadow-md active:scale-95 transition">Approve</button>
                                    <button onClick={() => handleAction(tx, 'rejected')} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold shadow-md active:scale-95 transition">Reject</button>
                                </div>
                            </div>
                        ))}
                        {transactions.filter(t => t.status === 'pending').length === 0 && (
                            <div className="text-center py-10 text-gray-400 font-bold bg-white rounded-2xl border border-dashed border-gray-300">No pending transactions</div>
                        )}
                    </div>
                )}

                {/* LINK TAB */}
                {activeTab === 'link' && (
                    <div className="space-y-6">
                        {/* Game Variables Section */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-yellow-200 bg-gradient-to-b from-white to-yellow-50/30">
                            <h3 className="font-black text-gray-900 flex items-center gap-2 text-sm mb-6 border-b-2 border-yellow-400 pb-2 uppercase tracking-wider"><Smartphone size={18} className="text-yellow-600"/> Game Variables</h3>
                            <div className="space-y-5">
                                <div className="group">
                                    <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Sign-Up Bonus (referralBonus)</label>
                                    <input type="number" value={settings.referralBonus} onChange={e => setSettings({...settings, referralBonus: Number(e.target.value)})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-yellow-400 outline-none transition shadow-sm text-black" />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Referral Deposit Commission (%)</label>
                                    <input type="number" value={settings.referralDepositBonusPercent} onChange={e => setSettings({...settings, referralDepositBonusPercent: Number(e.target.value)})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-yellow-400 outline-none transition shadow-sm text-black" />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">User Deposit Bonus (%)</label>
                                    <input type="number" value={settings.depositBonusPercent} onChange={e => setSettings({...settings, depositBonusPercent: Number(e.target.value)})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-yellow-400 outline-none transition shadow-sm text-black" />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Spin Prizes (8 Values, Comma Separated)</label>
                                    <input type="text" value={spinPrizesStr} onChange={e => setSpinPrizesStr(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-mono font-bold focus:border-yellow-400 outline-none transition shadow-sm text-black" placeholder="500, 250, 100, 75, 50, 25, 10, 5" />
                                </div>
                                
                                <div className="pt-4 border-t-2 border-yellow-100 space-y-4">
                                    <p className="text-[11px] font-black text-yellow-700 uppercase tracking-widest text-center">VIP Tier Management</p>
                                    <div>
                                        <label className="block text-black text-[11px] font-black uppercase mb-1 ml-1">VIP Thresholds (Wager Amount)</label>
                                        <textarea value={vipThresholdsStr} onChange={e => setVipThresholdsStr(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-[11px] font-mono font-bold h-24 focus:border-yellow-400 outline-none transition shadow-sm text-black" placeholder="0, 1000, 10000..."></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-black text-[11px] font-black uppercase mb-1 ml-1">VIP Daily Rewards</label>
                                        <textarea value={vipDailyStr} onChange={e => setVipDailyStr(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-[11px] font-mono font-bold h-24 focus:border-yellow-400 outline-none transition shadow-sm text-black" placeholder="0, 10, 20..."></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-black text-[11px] font-black uppercase mb-1 ml-1">VIP Level-Up Rewards</label>
                                        <textarea value={vipLevelUpStr} onChange={e => setVipLevelUpStr(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-[11px] font-mono font-bold h-24 focus:border-yellow-400 outline-none transition shadow-sm text-black" placeholder="0, 50, 100..."></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Support Links Section */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-200 space-y-5 bg-gradient-to-b from-white to-green-50/30">
                            <h3 className="font-black text-gray-900 flex items-center gap-2 text-sm mb-2 border-b-2 border-green-400 pb-2 uppercase tracking-wider"><ExternalLink size={18} className="text-green-600"/> Support & Legal</h3>
                            <div>
                                <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Customer Care URL</label>
                                <input placeholder="https://..." type="text" value={settings.customerServiceUrl} onChange={e => setSettings({...settings, customerServiceUrl: e.target.value})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-green-400 outline-none transition shadow-sm text-black" />
                            </div>
                            <div>
                                <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Forgot Password URL</label>
                                <input placeholder="https://..." type="text" value={settings.forgotPasswordUrl} onChange={e => setSettings({...settings, forgotPasswordUrl: e.target.value})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-green-400 outline-none transition shadow-sm text-black" />
                            </div>
                            <div>
                                <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Privacy Policy URL</label>
                                <input placeholder="https://..." type="text" value={settings.privacyPolicyUrl} onChange={e => setSettings({...settings, privacyPolicyUrl: e.target.value})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-green-400 outline-none transition shadow-sm text-black" />
                            </div>
                        </div>

                        {/* Payment Settings Section */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-200 space-y-5 bg-gradient-to-b from-white to-blue-50/30">
                            <h3 className="font-black text-gray-900 flex items-center gap-2 text-sm mb-2 border-b-2 border-blue-400 pb-2 uppercase tracking-wider"><CreditCard size={18} className="text-blue-600"/> Payment Methods</h3>
                            <div>
                                <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Admin UPI ID</label>
                                <input placeholder="example@upi" type="text" value={settings.adminUpiId} onChange={e => setSettings({...settings, adminUpiId: e.target.value})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-blue-400 outline-none transition shadow-sm text-black" />
                            </div>
                            <div>
                                <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">UPI QR Image URL</label>
                                <input placeholder="https://..." type="text" value={settings.adminQrCodeUrl} onChange={e => setSettings({...settings, adminQrCodeUrl: e.target.value})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-blue-400 outline-none transition shadow-sm text-black" />
                            </div>
                            <div>
                                <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Admin USDT (TRC20) Address</label>
                                <input placeholder="T..." type="text" value={settings.adminUsdtAddress} onChange={e => setSettings({...settings, adminUsdtAddress: e.target.value})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-blue-400 outline-none transition shadow-sm text-black" />
                            </div>
                            <div>
                                <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">USDT QR Image URL</label>
                                <input placeholder="https://..." type="text" value={settings.adminUsdtQrCodeUrl} onChange={e => setSettings({...settings, adminUsdtQrCodeUrl: e.target.value})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-blue-400 outline-none transition shadow-sm text-black" />
                            </div>
                        </div>

                        <button onClick={saveSettings} className="w-full bg-black text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest active:scale-[0.98] transition">Save All Variables</button>
                    </div>
                )}

                {/* SYSTEM TAB */}
                {activeTab === 'system' && (
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-200 bg-gradient-to-b from-white to-orange-50/30">
                            <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2 text-sm border-b-2 border-orange-400 pb-2 uppercase tracking-wider"><PartyPopper size={18} className="text-orange-600"/> Welcome Popup</h3>
                            <div>
                                <label className="block text-black text-[12px] font-black uppercase mb-2 ml-1">Message for New Users</label>
                                <textarea 
                                    value={settings.welcomeMessage} 
                                    onChange={e => setSettings({...settings, welcomeMessage: e.target.value})}
                                    className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 text-sm font-bold min-h-[100px] focus:border-orange-400 outline-none transition shadow-sm text-black"
                                    placeholder="Welcome to King Club #username..."
                                />
                                <p className="mt-2 text-[9px] text-gray-600 uppercase font-black bg-orange-100/50 p-2 rounded">Tags: #username, #userid, #balance, #totaldeposit, #vip, #refercode</p>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 bg-gradient-to-b from-white to-red-50/30">
                            <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2 text-sm border-b-2 border-red-400 pb-2 uppercase tracking-wider"><Bell size={18} className="text-red-600"/> Announcements</h3>
                            <div className="space-y-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-inner">
                                <div>
                                    <label className="block text-black text-[11px] font-black uppercase mb-1">Title</label>
                                    <input type="text" placeholder="Notif Title" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-lg p-2.5 text-sm font-bold outline-none text-black" />
                                </div>
                                <div>
                                    <label className="block text-black text-[11px] font-black uppercase mb-1">Content</label>
                                    <textarea placeholder="Message content..." value={notifContent} onChange={e => setNotifContent(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-lg p-2.5 text-sm font-bold min-h-[80px] outline-none text-black" />
                                </div>
                                <button onClick={handlePublishNotification} className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Broadcast to All</button>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest border-b pb-1">Previous History</p>
                                {notifications.map(notif => (
                                    <div key={notif.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className="text-xs font-black text-black truncate">{notif.title}</p>
                                            <p className="text-[10px] text-gray-600 truncate font-bold">{notif.content}</p>
                                        </div>
                                        <button onClick={() => handleDeleteNotif(notif.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                         {/* User Search Explorer Section */}
                         <div className="bg-white p-6 rounded-2xl shadow-xl border-2 border-indigo-100">
                            <h2 className="text-gray-900 font-black mb-6 text-base flex items-center gap-2 uppercase tracking-wider border-b-2 border-indigo-500 pb-2"><Search size={20} className="text-indigo-600"/> User Explorer</h2>
                            
                            <div className="space-y-4 mb-6">
                                <label className="block text-black text-[12px] font-black uppercase ml-1">Search Player (ID, Email or UID)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={userDetailsInput} 
                                        onChange={e => setUserDetailsInput(e.target.value)} 
                                        placeholder="Enter Numeric ID..." 
                                        className="flex-1 bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-black focus:border-indigo-400 outline-none text-black shadow-sm" 
                                    />
                                    <button 
                                        onClick={handleUserSearch} 
                                        disabled={isSearching}
                                        className="bg-indigo-600 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition flex items-center gap-2"
                                    >
                                        {isSearching ? <RefreshCw size={14} className="animate-spin"/> : 'Find'}
                                    </button>
                                </div>
                            </div>

                            {/* USER DETAILS RESULT CARD */}
                            {searchedUser ? (
                                <div className="bg-indigo-50/50 p-5 rounded-2xl border-2 border-indigo-200 animate-fade-in space-y-4">
                                    <div className="flex justify-between items-start border-b-2 border-indigo-200 pb-3">
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Player Name</p>
                                            <p className="text-xl font-black text-black leading-tight">{searchedUser.displayName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Player ID</p>
                                            <p className="text-lg font-black text-black font-mono">{searchedUser.numericId}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                            <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Total Balance</p>
                                            <p className="text-lg font-black text-indigo-600">₹{searchedUser.balance.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                            <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Deposited</p>
                                            <p className="text-lg font-black text-black">₹{searchedUser.totalDeposited || 0}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                            <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Winning Bal</p>
                                            <p className="text-lg font-black text-green-600">₹{searchedUser.winningBalance || 0}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                            <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Wagered</p>
                                            <p className="text-lg font-black text-black">₹{searchedUser.totalWagered || 0}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm space-y-2">
                                        <div>
                                            <p className="text-[10px] text-gray-500 font-black uppercase">Email Address</p>
                                            <p className="text-sm font-black text-black break-all">{searchedUser.email}</p>
                                        </div>
                                        <div className="flex justify-between border-t pt-2">
                                            <div>
                                                <p className="text-[10px] text-gray-500 font-black uppercase">Role</p>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${searchedUser.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{searchedUser.role}</span>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 font-black uppercase">VIP Level</p>
                                                <p className="text-sm font-black text-indigo-600 text-right">{searchedUser.vipLevel || 1}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setSearchedUser(null)} className="w-full py-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600 transition">Clear Result</button>
                                </div>
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl">
                                    <Users size={32} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-xs text-gray-400 font-black uppercase tracking-widest">Search result will appear here</p>
                                </div>
                            )}
                        </div>

                        {/* Referral Details Lookup Section */}
                        <div className="bg-white p-6 rounded-2xl shadow-xl border-2 border-green-100">
                            <h2 className="text-gray-900 font-black mb-6 text-base flex items-center gap-2 uppercase tracking-wider border-b-2 border-green-500 pb-2"><Users size={20} className="text-green-600"/> Team Lookup</h2>
                            
                            <div className="space-y-4 mb-6">
                                <label className="block text-black text-[12px] font-black uppercase ml-1">Search User's Referrals (Ref Code or ID)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={searchRefInput} 
                                        onChange={e => setSearchRefInput(e.target.value)} 
                                        placeholder="Enter Ref Code or Numeric ID..." 
                                        className="flex-1 bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-black focus:border-green-400 outline-none text-black shadow-sm" 
                                    />
                                    <button 
                                        onClick={handleReferralSearch} 
                                        disabled={isRefSearching}
                                        className="bg-green-600 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition flex items-center gap-2"
                                    >
                                        {isRefSearching ? <RefreshCw size={14} className="animate-spin"/> : 'Search'}
                                    </button>
                                </div>
                                {searchStatus && <p className="text-[11px] font-black text-green-700 bg-green-50 p-2 rounded-lg border border-green-100">{searchStatus}</p>}
                            </div>

                            <div className="max-h-64 overflow-y-auto space-y-3 no-scrollbar pr-1">
                                {referredUsers.map(u => (
                                    <div key={u.uid} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex justify-between items-center shadow-sm hover:border-green-300 transition">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-black text-black truncate">{u.displayName}</p>
                                            <p className="text-[10px] text-gray-500 font-mono font-bold">ID: {u.numericId}</p>
                                            </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-400 uppercase font-black">Balance</p>
                                            <span className="text-xs font-black text-green-600">₹{u.balance.toFixed(0)}</span>
                                        </div>
                                    </div>
                                ))}
                                {referredUsers.length === 0 && !isRefSearching && (
                                    <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">No team members to display</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Gift Code Generation Section */}
                        <div className="bg-white p-6 rounded-2xl shadow-xl border-2 border-yellow-100">
                            <h2 className="text-gray-900 font-black mb-6 text-base flex items-center gap-2 uppercase tracking-wider border-b-2 border-yellow-500 pb-2"><Key size={20} className="text-yellow-600"/> Gift Code Creator</h2>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="group">
                                    <label className="block text-black text-[11px] font-black uppercase mb-1.5 ml-1">Unique Code</label>
                                    <input 
                                        type="text" 
                                        value={promoCode} 
                                        onChange={e => setPromoCode(e.target.value.toUpperCase())} 
                                        placeholder="KING777"
                                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-black focus:border-yellow-400 outline-none text-black shadow-sm" 
                                    />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[11px] font-black uppercase mb-1.5 ml-1">Reward Value (₹)</label>
                                    <input 
                                        type="number" 
                                        value={promoAmount} 
                                        onChange={e => setPromoAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                                        placeholder="100"
                                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-black focus:border-yellow-400 outline-none text-black shadow-sm" 
                                    />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[11px] font-black uppercase mb-1.5 ml-1">Max Use Count</label>
                                    <input 
                                        type="number" 
                                        value={promoUsers} 
                                        onChange={e => setPromoUsers(e.target.value === '' ? '' : Number(e.target.value))} 
                                        placeholder="1"
                                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-black focus:border-yellow-400 outline-none text-black shadow-sm" 
                                    />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[11px] font-black uppercase mb-1.5 ml-1">Validity (Days)</label>
                                    <input 
                                        type="number" 
                                        value={promoDays} 
                                        onChange={e => setPromoDays(e.target.value === '' ? '' : Number(e.target.value))} 
                                        placeholder="7"
                                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-black focus:border-yellow-400 outline-none text-black shadow-sm" 
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-black text-[11px] font-black uppercase mb-1.5 ml-1">Min Cumulative Deposit To Claim (₹)</label>
                                <input 
                                    type="number" 
                                    value={promoRequiredDepositAmount} 
                                    onChange={e => setPromoRequiredDepositAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                                    placeholder="0 (No requirement)"
                                    className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-black focus:border-yellow-400 outline-none text-black shadow-sm" 
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-black text-[11px] font-black uppercase mb-1.5 ml-1">Success Message</label>
                                <textarea 
                                    value={promoMsg} 
                                    onChange={e => setPromoMsg(e.target.value)} 
                                    placeholder="Enjoy your gift!"
                                    className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold min-h-[80px] focus:border-yellow-400 outline-none text-black shadow-sm"
                                ></textarea>
                            </div>

                            <button onClick={handleCreatePromo} className="w-full bg-yellow-500 text-black font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs active:scale-95 transition flex items-center justify-center gap-2">
                                <Gift size={16}/> Create Gift Code
                            </button>
                        </div>

                         <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                            <h2 className="text-gray-900 font-black mb-4 text-sm flex items-center gap-2 uppercase tracking-wider border-b-2 border-blue-400 pb-2"><UserPlus size={18} className="text-blue-600"/> Admin Management</h2>
                            <div className="flex gap-2 mb-6">
                                <input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Enter user email..." className="flex-1 bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-blue-400 outline-none text-black" />
                                <button onClick={handleAddAdmin} className="bg-blue-600 text-white px-5 rounded-xl font-black text-xs uppercase tracking-widest shadow-md">Add</button>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Team Members</p>
                                {adminList.map(adm => (
                                    <div key={adm.uid} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-gray-900">{adm.displayName}</span>
                                            <span className="text-[10px] text-gray-500 font-mono font-bold">{adm.email}</span>
                                        </div>
                                        {adm.uid !== currentAdminUid && (
                                            <button onClick={() => updateUserRole(adm.uid, 'user').then(loadAdmins)} className="text-red-500 p-2 hover:bg-red-50 rounded-full transition"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
e-react';
import { useNavigate } from 'react-router-dom';

type AdminTab = 'finance' | 'system' | 'users' | 'wingo' | 'leaderboard' | 'link';

function snapshotToArray<T>(snapshot: any): T[] {
    const val = snapshot.val();
    if (!val) return [];
    return Object.values(val) as T[];
}

export const Admin = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<AdminTab>('finance');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentAdminUid, setCurrentAdminUid] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
    const [settings, setSettings] = useState<SystemSettings>({
        referralBonus: 0,
        referralDepositBonusPercent: 0,
        depositBonusPercent: 0,
        homeBanners: [],
        adminUpiId: '',
        adminQrCodeUrl: '',
        adminUsdtAddress: '',
        adminUsdtQrCodeUrl: '',
        spinPrizes: [],
        vipThresholds: [],
        vipDailyRewards: [],
        vipLevelUpRewards: [],
        customerServiceUrl: '',
        forgotPasswordUrl: '',
        privacyPolicyUrl: '',
        minDeposit: 100,
        maxDeposit: 100000,
        minWithdraw: 100,
        maxWithdraw: 100000,
        notificationText: '',
        welcomeMessage: '',
        leaderboard: []
    });
    
    const [spinPrizesStr, setSpinPrizesStr] = useState('');
    const [vipThresholdsStr, setVipThresholdsStr] = useState('');
    const [vipDailyStr, setVipDailyStr] = useState('');
    const [vipLevelUpStr, setVipLevelUpStr] = useState('');
    const [newBannerUrl, setNewBannerUrl] = useState('');
    const [newBannerLink, setNewBannerLink] = useState('');
    const [lbEntries, setLbEntries] = useState<LeaderboardEntry[]>([]);
    const [notifTitle, setNotifTitle] = useState('');
    const [notifContent, setNotifContent] = useState('');
    const [wingoResultInput, setWingoResultInput] = useState<number | ''>('');
    const [currentWingoForced, setCurrentWingoForced] = useState<number | null>(null);
    const [searchRefInput, setSearchRefInput] = useState('');
    const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
    const [searchStatus, setSearchStatus] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState<number | ''>('');
    const [promoUsers, setPromoUsers] = useState<number | ''>('');
    const [promoDays, setPromoDays] = useState<number | ''>('');
    const [promoMsg, setPromoMsg] = useState('Congratulations #username! Here is your gift.');
    const [promoRequiresDeposit, setPromoRequiresDeposit] = useState(false);
    const [promoRequiredDepositAmount, setPromoRequiredDepositAmount] = useState<number | ''>('');
    const [adminList, setAdminList] = useState<UserProfile[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [userDetailsInput, setUserDetailsInput] = useState('');
    const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isRefSearching, setIsRefSearching] = useState(false);

    useEffect(() => {
        const checkAdmin = async () => {
            const u = auth.currentUser;
            if(u) {
                setCurrentAdminUid(u.uid);
                const profile = await getUserProfile(u.uid);
                if(profile?.role === 'admin') {
                    setIsAdmin(true);
                    loadAdmins();
                } else { navigate('/'); }
            } else { navigate('/login'); }
        };
        checkAdmin();

        const txRef = ref(db, 'transactions');
        const unsubTx = onValue(txRef, (snap) => {
            const data = snapshotToArray<Transaction>(snap);
            data.sort((a, b) => b.timestamp - a.timestamp);
            setTransactions(data);
        });

        const notifRef = ref(db, 'notifications');
        const unsubNotif = onValue(notifRef, (snap) => {
            if (snap.exists()) {
                const data = Object.values(snap.val()) as Notification[];
                data.sort((a, b) => b.timestamp - a.timestamp);
                setNotifications(data);
            } else { setNotifications([]); }
        });

        getSystemSettings().then(s => {
            setSettings(s);
            setSpinPrizesStr(s.spinPrizes ? s.spinPrizes.join(', ') : '');
            setVipThresholdsStr(s.vipThresholds ? s.vipThresholds.join(', ') : '');
            setVipDailyStr(s.vipDailyRewards ? s.vipDailyRewards.join(', ') : '');
            setVipLevelUpStr(s.vipLevelUpRewards ? s.vipLevelUpRewards.join(', ') : '');
            if (s.leaderboard) { setLbEntries(s.leaderboard); } 
            else { setLbEntries(Array.from({ length: 10 }, () => ({ name: '', userId: '', amount: 0, gender: 'male' }))); }
        });

        getWingoNextResult().then(setCurrentWingoForced);
        return () => { unsubTx(); unsubNotif(); };
    }, [navigate]);

    const loadAdmins = async () => setAdminList(await getAdmins());
    const showSuccess = (msg: string) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(''), 3000); };

    const handleAction = async (tx: Transaction, action: 'approved' | 'rejected') => {
        if(!isAdmin) return;
        await update(ref(db, `transactions/${tx.id}`), { status: action });
        if(action === 'approved') {
            if (tx.type === 'deposit') await approveDeposit(tx.uid, tx.amount);
            else if (tx.type === 'withdraw') await approveWithdrawal(tx.uid, tx.amount);
        }
        showSuccess(`Transaction ${action}`);
    };

    const saveSettings = async () => {
        const prizes = spinPrizesStr.split(',').map(s => parseInt(s.trim()) || 0);
        const thresholds = vipThresholdsStr.split(',').map(s => parseInt(s.trim()) || 0);
        const dailyRewards = vipDailyStr.split(',').map(s => parseInt(s.trim()) || 0);
        const levelUpRewards = vipLevelUpStr.split(',').map(s => parseInt(s.trim()) || 0);
        const newSettings = { ...settings, spinPrizes: prizes, vipThresholds: thresholds, vipDailyRewards: dailyRewards, vipLevelUpRewards: levelUpRewards, leaderboard: lbEntries };
        await updateSystemSettings(newSettings);
        setSettings(newSettings);
        showSuccess("Settings Saved!");
    };

    const handlePublishNotification = async () => {
        if (!notifTitle.trim() || !notifContent.trim()) return;
        await publishNotification(notifTitle.trim(), notifContent.trim());
        setNotifTitle(''); setNotifContent(''); showSuccess("Notification Published!");
    };

    const handleDeleteNotif = async (id: string) => { if (window.confirm("Delete notification?")) { await deleteNotification(id); showSuccess("Notification Deleted"); } };

    const addBanner = () => {
        if (!newBannerUrl.trim()) return;
        const updated = [...(settings.homeBanners || []), { imageUrl: newBannerUrl.trim(), link: newBannerLink.trim() }];
        setSettings({...settings, homeBanners: updated}); setNewBannerUrl(''); setNewBannerLink('');
    };

    const removeBanner = (index: number) => {
        const updatedBanners = (settings.homeBanners || []).filter((_, i) => i !== index);
        setSettings({...settings, homeBanners: updatedBanners});
    };

    const handleWingoControl = async (reset: boolean = false) => {
        if (reset) { await setWingoNextResult(null); setCurrentWingoForced(null); setWingoResultInput(''); showSuccess("Auto Mode Enabled"); } 
        else {
            const val = Number(wingoResultInput);
            if (wingoResultInput === '' || isNaN(val) || val < 0 || val > 9) { alert("Invalid (0-9)"); return; }
            await setWingoNextResult(val); setCurrentWingoForced(val); showSuccess("Wingo Set: " + val);
        }
    };

    const handleReferralSearch = async () => {
        if (!searchRefInput.trim()) return;
        setIsRefSearching(true);
        setSearchStatus('Searching...');
        setReferredUsers([]);
        
        let targetUid = searchRefInput.trim();
        // If searching by referral code or short numeric ID
        if (targetUid.length < 15) {
            const resolved = await getUidFromReferralCode(targetUid);
            if (resolved) targetUid = resolved;
            else {
                // Try searching by numericId if code lookup fails
                 const user = await findUserByNumericId(targetUid);
                if (user) targetUid = user.uid;
                else {
                    setSearchStatus('No user found for this Code/ID');
                    setIsRefSearching(false);
                    return;
                }
            }
        }
        
        const referrals = await getReferrals(targetUid);
        setReferredUsers(referrals);
        setSearchStatus(referrals.length > 0 ? `Found ${referrals.length} referrals` : 'This user has no referrals');
        setIsRefSearching(false);
    };

    const handleCreatePromo = async () => {
        if (!promoCode || !promoAmount || !promoUsers || !promoDays) { alert("Please fill all required fields"); return; }
        await createPromoCode(promoCode, Number(promoAmount), Number(promoUsers), Number(promoDays), promoMsg, promoRequiresDeposit, Number(promoRequiredDepositAmount) || 0);
        showSuccess("Gift Code Created!");
        setPromoCode(''); setPromoAmount('');
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim()) return;
        const user = await findUserByEmail(newAdminEmail);
        if (!user) { alert("User not found"); return; }
        if(window.confirm(`Promote ${user.displayName}?`)) { await updateUserRole(user.uid, 'admin'); showSuccess("Promoted"); setNewAdminEmail(''); loadAdmins(); }
    };

    const handleUserSearch = async () => {
        if(!userDetailsInput.trim()) return;
        setIsSearching(true);
        setSearchedUser(null);
        const input = userDetailsInput.trim();
        let user = await findUserByNumericId(input) || await findUserByEmail(input) || await getUserProfile(input);
        setSearchedUser(user);
        setIsSearching(false);
        if(!user) alert("User not found for: " + input);
    };

    const updateLbEntry = (index: number, field: keyof LeaderboardEntry, value: any) => {
        const newEntries = [...lbEntries]; newEntries[index] = { ...newEntries[index], [field]: value }; setLbEntries(newEntries);
    };

    if(!isAdmin) return <div className="p-10 text-center text-red-500 font-bold">Access Denied</div>;

    const navItemClass = (tab: AdminTab) => `flex-1 py-3 text-[11px] font-black uppercase tracking-tight flex flex-col items-center gap-1 ${activeTab === tab ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:bg-gray-50 transition'}`;

    return (
        <div className="bg-[#f0f2f5] pb-24 relative min-h-full">
             <div className="bg-black text-white p-4 shadow-lg sticky top-0 z-50">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => navigate('/profile')} className="p-1 hover:bg-white/20 rounded-full transition"><ChevronLeft /></button>
                    <h1 className="text-lg font-bold flex items-center gap-2"><Shield size={18} fill="white" className="text-blue-500" /> Admin Console</h1>
                </div>
                <div className="flex bg-white rounded-lg overflow-hidden shadow-sm flex-wrap">
                    <button onClick={() => setActiveTab('finance')} className={navItemClass('finance')}><IndianRupee size={16} /> Finance</button>
                    <button onClick={() => setActiveTab('link')} className={navItemClass('link')}><LinkIcon size={16} /> Links</button>
                    <button onClick={() => setActiveTab('system')} className={navItemClass('system')}><Settings size={16} /> System</button>
                    <button onClick={() => setActiveTab('users')} className={navItemClass('users')}><Users size={16} /> Users</button>
                    <button onClick={() => setActiveTab('wingo')} className={navItemClass('wingo')}><LayoutDashboard size={16} /> Wingo</button>
                    <button onClick={() => setActiveTab('leaderboard')} className={navItemClass('leaderboard')}><Trophy size={16} /> Leader</button>
                </div>
            </div>
            
            <div className="p-4 space-y-6">
                {/* FINANCE TAB */}
                {activeTab === 'finance' && (
                    <div className="space-y-4">
                        <h2 className="text-gray-900 font-black text-lg mb-2 border-l-4 border-blue-500 pl-2">Pending Approvals</h2>
                        {transactions.filter(t => t.status === 'pending').map(tx => (
                            <div key={tx.id} className="bg-white p-4 rounded-xl shadow-md border border-gray-100 animate-fade-in">
                                <div className="flex justify-between mb-2">
                                    <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${tx.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.type}</span>
                                    <span className="text-gray-900 font-black">₹{tx.amount}</span>
                                </div>
                                <div className="text-xs text-gray-700 mb-3 font-mono break-all bg-gray-50 p-2 rounded border border-gray-100">{tx.details}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleAction(tx, 'approved')} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold shadow-md active:scale-95 transition">Approve</button>
                                    <button onClick={() => handleAction(tx, 'rejected')} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold shadow-md active:scale-95 transition">Reject</button>
                                </div>
                            </div>
                        ))}
                        {transactions.filter(t => t.status === 'pending').length === 0 && (
                            <div className="text-center py-10 text-gray-400 font-bold bg-white rounded-2xl border border-dashed border-gray-300">No pending transactions</div>
                        )}
                    </div>
                )}

                {/* LINK TAB */}
                {activeTab === 'link' && (
                    <div className="space-y-6">
                        {/* Game Variables Section */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-yellow-200 bg-gradient-to-b from-white to-yellow-50/30">
                            <h3 className="font-black text-gray-900 flex items-center gap-2 text-sm mb-6 border-b-2 border-yellow-400 pb-2 uppercase tracking-wider"><Smartphone size={18} className="text-yellow-600"/> Game Variables</h3>
                            <div className="space-y-5">
                                <div className="group">
                                    <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Sign-Up Bonus (referralBonus)</label>
                                    <input type="number" value={settings.referralBonus} onChange={e => setSettings({...settings, referralBonus: Number(e.target.value)})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-yellow-400 outline-none transition shadow-sm text-black" />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Referral Deposit Commission (%)</label>
                                    <input type="number" value={settings.referralDepositBonusPercent} onChange={e => setSettings({...settings, referralDepositBonusPercent: Number(e.target.value)})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-yellow-400 outline-none transition shadow-sm text-black" />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">User Deposit Bonus (%)</label>
                                    <input type="number" value={settings.depositBonusPercent} onChange={e => setSettings({...settings, depositBonusPercent: Number(e.target.value)})} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-yellow-400 outline-none transition shadow-sm text-black" />
                                </div>
                                <div className="group">
                                    <label className="block text-black text-[12px] font-black uppercase mb-1.5 ml-1">Spin Prizes (8 Values, Comma Separated)</label>
                                    <input type="text" value={spinPrizesStr} onChange={e => setSpinPrizesStr(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-mono font-bold focus:border-yellow-400 outline-none transition shadow-sm text-black" placeholder="500, 250, 100, 75, 50, 25, 10, 5" />
                                </div>
                                
                                <div className="pt-4 border-t-2 border-yellow-100 space-y-4">
                                    <p className="text-[11px] font-black text-yellow-700 uppercase tracking-widest text-center">VIP Tier Management</p>
                                    <div>
                                        <label className="block text-black text-[11px] font-black uppercase mb-1 ml-1">VIP Thresholds (Wager Amount)</label>
                                        <textarea value={vipThresholdsStr} onChange={e => setVipThresholdsStr(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-[11px] font-mono font-bold h-24 focus:border-yellow-400 outline-none transition shadow-sm text-black" placeholder="0, 1000, 10000..."></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-black text-[11px] font-black uppercase mb-1 ml-1">VIP Daily Rewards</label>
                                        <textarea value={vipDailyStr} onChange={e => setVipDailyStr(e.target.value)} className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-[11px] font-mono font-bold h-24 focus:border-yellow-400 outline-none transition shadow-sm text-black" placeholder="0, 10, 20..."></textarea>
                                    </div>
                                    <div>
                                        
                {/* GAMES TAB */}
                {activeTab === 'wingo' && (
                     <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                        <h2 className="text-gray-900 font-black mb-6 text-xl flex items-center gap-3 border-b-2 border-indigo-400 pb-2"><LayoutDashboard size={24} className="text-indigo-600"/> Wingo Prediction Control</h2>
                        <div className="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100 mb-6 shadow-inner">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-indigo-700 font-black uppercase tracking-widest">Operation Status</span>
                                {currentWingoForced !== null ? (
                                    <span className="text-red-700 font-black text-sm bg-white border-2 border-red-200 px-3 py-1.5 rounded-lg shadow-sm">FORCED: {currentWingoForced}</span>
                                ) : (
                                    <span className="text-green-700 font-black text-sm bg-white border-2 border-green-200 px-3 py-1.5 rounded-lg shadow-sm">AUTO (LOW PAYOUT)</span>
                                )}
                            </div>
                            <p className="text-[11px] text-indigo-800 font-bold leading-tight">In auto mode, the system selects the number with the lowest total payout from active bets to ensure profit.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex flex-col">
                                <label className="text-[11px] font-black uppercase text-black mb-1 ml-1">Force Number (0-9)</label>
                                <input type="number" max={9} min={0} value={wingoResultInput} onChange={e => setWingoResultInput(e.target.value === '' ? '' : Number(e.target.value))} placeholder="#" className="w-24 bg-white border-4 border-gray-100 rounded-2xl text-center font-black text-4xl p-4 outline-none focus:border-indigo-400 transition shadow-md text-black" />
                            </div>
                            <div className="flex-1 flex flex-col gap-2 pt-5">
                                <button onClick={() => handleWingoControl(false)} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition uppercase tracking-widest text-xs">Apply Force</button>
                                <button onClick={() => handleWingoControl(true)} className="w-full bg-gray-100 text-gray-700 font-black py-3 rounded-2xl text-xs uppercase tracking-widest hover:bg-gray-200 transition">Reset to Auto</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* LEADERBOARD TAB */}
                {activeTab === 'leaderboard' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                             <h2 className="text-gray-900 font-black text-lg border-l-4 border-yellow-500 pl-2">Official Rankings</h2>
                             <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-black uppercase border border-yellow-200">10 Slots Available</span>
                        </div>
                        {lbEntries.map((entry, i) => (
                            <div key={i} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 space-y-4 animate-fade-in hover:border-indigo-200 transition">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i < 3 ? 'bg-yellow-400 text-white shadow-md' : 'bg-gray-200 text-gray-600'}`}>
                                            {i + 1}
                                        </div>
                                        <span className="text-[12px] font-black uppercase text-black">Rank Position {i + 1}</span>
                                    </div>
                                    <div className="group">
                                        <select value={entry.gender} onChange={e => updateLbEntry(i, 'gender', e.target.value)} className="text-[11px] font-black bg-white border-2 border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400 uppercase text-black shadow-sm">
                                            <option value="male">Male Avatar</option>
                                            <option value="female">Female Avatar</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-black mb-1 ml-1">Player Name</label>
                                        <input placeholder="Name" value={entry.name} onChange={e => updateLbEntry(i, 'name', e.target.value)} className="w-full bg-white border-2 border-gray-100 rounded-xl p-2.5 text-xs font-black outline-none text-black shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-black mb-1 ml-1">Public ID</label>
                                        <input placeholder="ID" value={entry.userId} onChange={e => updateLbEntry(i, 'userId', e.target.value)} className="w-full bg-white border-2 border-gray-100 rounded-xl p-2.5 text-xs font-black outline-none text-black shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-black mb-1 ml-1">Income (₹)</label>
                                        <input type="number" placeholder="Amt" value={entry.amount || ''} onChange={e => updateLbEntry(i, 'amount', Number(e.target.value))} className="w-full bg-white border-2 border-gray-200 rounded-xl p-2.5 text-xs font-black outline-none text-black shadow-sm" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button onClick={saveSettings} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest active:scale-[0.98] transition">Update Rankings</button>
                    </div>
                )}
            </div>

            {/* Success Toast */}
            {successMessage && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-8 py-4 rounded-full shadow-2xl z-[100] flex items-center gap-3 animate-slide-up border-2 border-white/20 min-w-max">
                    <CheckCircle size={20} className="text-green-500" />
                    <span className="font-black text-sm uppercase tracking-widest">{successMessage}</span>
                </div>
            )}
        </div>
    );
};
