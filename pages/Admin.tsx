import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { Transaction, SystemSettings, UserProfile, Notification, LeaderboardEntry } from '../types';
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
    Settings, IndianRupee, LayoutDashboard, CreditCard, ExternalLink, 
    Link as LinkIcon, UserPlus, Bell, PartyPopper, Trophy, Smartphone, 
    Search, RefreshCw, Key, ShieldCheck, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AdminTab = 'finance' | 'link' | 'system' | 'users' | 'wingo' | 'leaderboard';

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
    
    // Core Settings State
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
        welcomeMessage: '',
        leaderboard: []
    });
    
    // Config Strings
    const [spinPrizesStr, setSpinPrizesStr] = useState('');
    const [vipThresholdsStr, setVipThresholdsStr] = useState('');
    const [vipDailyStr, setVipDailyStr] = useState('');
    const [vipLevelUpStr, setVipLevelUpStr] = useState('');
    const [lbEntries, setLbEntries] = useState<LeaderboardEntry[]>([]);

    // Users & Search State
    const [userDetailsInput, setUserDetailsInput] = useState('');
    const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchRefInput, setSearchRefInput] = useState('');
    const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
    const [isRefSearching, setIsRefSearching] = useState(false);
    const [searchStatus, setSearchStatus] = useState('');
    
    // Promo Code Creator State
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState<number | ''>('');
    const [promoUsers, setPromoUsers] = useState<number | ''>('');
    const [promoDays, setPromoDays] = useState<number | ''>('');
    const [promoMsg, setPromoMsg] = useState('Congratulations #username! Here is your gift of ₹#amount.');
    const [promoRequiredDeposit, setPromoRequiredDeposit] = useState<number | ''>('');

    // Announcements State
    const [notifTitle, setNotifTitle] = useState('');
    const [notifContent, setNotifContent] = useState('');

    // Game Control
    const [wingoResultInput, setWingoResultInput] = useState<number | ''>('');
    const [currentWingoForced, setCurrentWingoForced] = useState<number | null>(null);

    // Admin List
    const [adminList, setAdminList] = useState<UserProfile[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');

    useEffect(() => {
        const checkAdminStatus = async () => {
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
        checkAdminStatus();

        // Transaction Listener
        const txRef = ref(db, 'transactions');
        const unsubTx = onValue(txRef, (snap) => {
            const data = snapshotToArray<Transaction>(snap);
            data.sort((a, b) => b.timestamp - a.timestamp);
            setTransactions(data);
        });

        // Notifications Listener
              const notifRef = ref(db, 'notifications');
        const unsubNotif = onValue(notifRef, (snap) => {
            if (snap.exists()) {
                const data = Object.values(snap.val()) as Notification[];
                data.sort((a, b) => b.timestamp - a.timestamp);
                setNotifications(data);
            } else { setNotifications([]); }
        });

        // System Settings Loader
        getSystemSettings().then(s => {
            setSettings(s);
            setSpinPrizesStr(s.spinPrizes ? s.spinPrizes.join(', ') : '');
            setVipThresholdsStr(s.vipThresholds ? s.vipThresholds.join(', ') : '');
            setVipDailyStr(s.vipDailyRewards ? s.vipDailyRewards.join(', ') : '');
            setVipLevelUpStr(s.vipLevelUpRewards ? s.vipLevelUpRewards.join(', ') : '');
            if (s.leaderboard && s.leaderboard.length > 0) { 
                setLbEntries(s.leaderboard); 
            } else { 
                setLbEntries(Array.from({ length: 10 }, () => ({ name: '', userId: '', amount: 0, gender: 'male' }))); 
            }
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
        
        const newSettings = { 
            ...settings, 
            spinPrizes: prizes, 
            vipThresholds: thresholds, 
            vipDailyRewards: dailyRewards, 
            vipLevelUpRewards: levelUpRewards, 
            leaderboard: lbEntries 
        };
        
        await updateSystemSettings(newSettings);
        setSettings(newSettings);
        showSuccess("System Settings Saved!");
    };

    const handlePublishNotification = async () => {
        if (!notifTitle.trim() || !notifContent.trim()) return;
        await publishNotification(notifTitle.trim(), notifContent.trim());
        setNotifTitle(''); setNotifContent(''); showSuccess("Notification Broadcasted!");
    };

    const handleDeleteNotif = async (id: string) => { 
        if (window.confirm("Delete notification?")) { 
            await deleteNotification(id); 
            showSuccess("Notification Removed"); 
        } 
    };

    const handleUserSearch = async () => {
        if(!userDetailsInput.trim()) return;
        setIsSearching(true);
        setSearchedUser(null);
        const input = userDetailsInput.trim();
        let user = await findUserByNumericId(input) || await findUserByEmail(input) || await getUserProfile(input);
        setSearchedUser(user);
        setIsSearching(false);
        if(!user) alert("Player not found");
    };

    const handleReferralSearch = async () => {
        if (!searchRefInput.trim()) return;
        setIsRefSearching(true);
        setSearchStatus('Searching Team...');
        setReferredUsers([]);
        
        let targetUid = searchRefInput.trim();
        if (targetUid.length < 15) {
            const resolved = await getUidFromReferralCode(targetUid);
            if (resolved) targetUid = resolved;
            else {
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
        setSearchStatus(referrals.length > 0 ? `Found ${referrals.length} referrals` : 'No team members found');
        setIsRefSearching(false);
    };

    const handleCreatePromo = async () => {
        if (!promoCode || !promoAmount || !promoUsers || !promoDays) { 
            alert("All fields are required"); 
            return; 
        }
        await createPromoCode(
            promoCode.trim().toUpperCase(), 
            Number(promoAmount), 
            Number(promoUsers), 
            Number(promoDays), 
            promoMsg, 
            Number(promoRequiredDeposit) > 0, 
            Number(promoRequiredDeposit) || 0
        );
        showSuccess("Gift Code Created!");
        setPromoCode(''); setPromoAmount('');
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim()) return;
        const user = await findUserByEmail(newAdminEmail);
        if (!user) { alert("User not found"); return; }
        if(window.confirm(`Promote ${user.displayName} to Admin?`)) { 
            await updateUserRole(user.uid, 'admin'); 
            showSuccess("User Promoted"); 
            setNewAdminEmail(''); 
            loadAdmins(); 
        }
    };

    const handleWingoControl = async (reset: boolean = false) => {
        if (reset) { 
            await setWingoNextResult(null); 
            setCurrentWingoForced(null); 
            setWingoResultInput(''); 
            showSuccess("Switched to Auto Mode"); 
        } else {
            const val = Number(wingoResultInput);
            if (wingoResultInput === '' || isNaN(val) || val < 0 || val > 9) { 
                alert("Enter 0-9"); 
                return; 
            }
            await setWingoNextResult(val); 
            setCurrentWingoForced(val); 
            showSuccess("Next Round Forced: " + val);
        }
    };

    const updateLbEntry = (index: number, field: keyof LeaderboardEntry, value: any) => {
        const newEntries = [...lbEntries]; 
        newEntries[index] = { ...newEntries[index], [field]: value }; 
        setLbEntries(newEntries);
    };

    if(!isAdmin) return <div className="p-20 text-center font-black text-red-600">UNAUTHORIZED ACCESS</div>;

    const navItemClass = (tab: AdminTab) => `flex-1 py-4 text-[10px] font-black uppercase tracking-tight flex flex-col items-center gap-1 ${activeTab === tab ? 'text-black border-b-4 border-black' : 'text-gray-400 hover:bg-gray-100 transition'}`;

    return (
        <div className="bg-[#f0f2f5] min-h-screen pb-20">
            {/* Nav Header */}
            <div className="bg-black text-white p-4 shadow-xl sticky top-0 z-[100]">
                <div className="flex items-center justify-between mb-4 px-2">
                    <button onClick={() => navigate('/profile')} className="p-2 bg-white/10 rounded-full"><ChevronLeft size={20}/></button>
                    <h1 className="text-lg font-black italic tracking-widest flex items-center gap-2">
                        <ShieldCheck size={20} className="text-blue-500" fill="currentColor"/> ADMIN CONSOLE
                    </h1>
                    <div className="w-8"></div>
                </div>
                <div className="flex bg-white rounded-2xl overflow-hidden shadow-inner">
                    <button onClick={() => setActiveTab('finance')} className={navItemClass('finance')}><IndianRupee size={16}/> Finance</button>
                    <button onClick={() => setActiveTab('users')} className={navItemClass('users')}><Users size={16}/> Players</button>
                    <button onClick={() => setActiveTab('link')} className={navItemClass('link')}><LinkIcon size={16}/> Links</button>
                    <button onClick={() => setActiveTab('system')} className={navItemClass('system')}><Settings size={16}/> System</button>
                    <button onClick={() => setActiveTab('leaderboard')} className={navItemClass('leaderboard')}><Trophy size={16}/> Rankings</button>
                    <button onClick={() => setActiveTab('wingo')} className={navItemClass('wingo')}><LayoutDashboard size={16}/> Game</button>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* FINANCE TAB: PENDING TRANSACTIONS */}
                {activeTab === 'finance' && (
                    <div className="space-y-4">
                        <h2 className="text-black font-black text-lg border-l-4 border-red-600 pl-3">Pending Requests</h2>
                        {transactions.filter(t => t.status === 'pending').map(tx => (
                            <div key={tx.id} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${tx.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {tx.type}
                                        </span>
                                        <p className="text-xs text-gray-500 mt-2 font-mono">{new Date(tx.timestamp).toLocaleString()}</p>
                                    </div>
                                    <span className="text-2xl font-black text-black">₹{tx.amount}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl mb-4 font-mono text-[11px] break-all border border-gray-200">
                                    {tx.details}
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => handleAction(tx, 'approved')} className="flex-1 bg-green-600 text-white font-black py-3 rounded-xl shadow-lg active:scale-95 transition uppercase text-xs">Approve</button>
                                    <button onClick={() => handleAction(tx, 'rejected')} className="flex-1 bg-red-600 text-white font-black py-3 rounded-xl shadow-lg active:scale-95 transition uppercase text-xs">Reject</button>
                                </div>
                            </div>
                        ))}
                        {transactions.filter(t => t.status === 'pending').length === 0 && (
                            <div className="text-center py-20 text-gray-400 font-bold italic">No pending requests</div>
                        )}
                    </div>
                )}

                {/* PLAYERS TAB: SEARCH, TEAM, GIFTS, ADMINS */}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                        {/* Player Explorer */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black text-black uppercase tracking-wider mb-4 flex items-center gap-2"><Search size={18}/> Player Explorer</h3>
                            <div className="flex gap-2">
                                <input type="text" placeholder="ID / Email / UID" value={userDetailsInput} onChange={e => setUserDetailsInput(e.target.value)} className="flex-1 bg-gray-100 p-3 rounded-xl text-sm font-bold outline-none border-2 border-transparent focus:border-black transition" />
                                <button onClick={handleUserSearch} className="bg-black text-white px-5 rounded-xl font-black text-xs uppercase shadow-lg">Find</button>
                            </div>
                            {searchedUser && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200 animate-fade-in">
                                    <div className="flex justify-between mb-2">
                                        <p className="font-black text-black">{searchedUser.displayName}</p>
                                        <span className="font-mono text-xs text-gray-500">ID: {searchedUser.numericId}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                                        <div className="bg-white p-2 rounded-lg">Bal: <span className="text-green-600">₹{searchedUser.balance.toFixed(2)}</span></div>
                                        <div className="bg-white p-2 rounded-lg">Wager: ₹{searchedUser.totalWagered}</div>
                                        <div className="bg-white p-2 rounded-lg">Deps: ₹{searchedUser.totalDeposited}</div>
                                        <div className="bg-white p-2 rounded-lg">Role: {searchedUser.role}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Team Lookup */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black text-black uppercase tracking-wider mb-4 flex items-center gap-2"><Users size={18}/> Team Lookup</h3>
                            <div className="flex gap-2 mb-3">
                                <input type="text" placeholder="Ref Code / Player ID" value={searchRefInput} onChange={e => setSearchRefInput(e.target.value)} className="flex-1 bg-gray-100 p-3 rounded-xl text-sm font-bold outline-none" />
                                <button onClick={handleReferralSearch} className="bg-green-600 text-white px-5 rounded-xl font-black text-xs uppercase shadow-lg">Scan</button>
                            </div>
                            {searchStatus && <p className="text-[10px] font-black text-gray-500 uppercase px-2 mb-2">{searchStatus}</p>}
                            <div className="max-h-40 overflow-y-auto space-y-2">
                                {referredUsers.map(u => (
                                    <div key={u.uid} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg text-[11px] font-bold border border-gray-100">
                                        <span>{u.displayName} ({u.numericId})</span>
                                        <span className="text-green-600">₹{u.balance.toFixed(0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gift Code Creator */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black text-black uppercase tracking-wider mb-6 flex items-center gap-2 text-red-600"><Key size={18}/> Gift Code Creator</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Code</label>
                                        <input type="text" placeholder="KING777" value={promoCode} onChange={e => setPromoCode(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Reward ₹</label>
                                        <input type="number" placeholder="100" value={promoAmount} onChange={e => setPromoAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Max Claims</label>
                                        <input type="number" placeholder="10" value={promoUsers} onChange={e => setPromoUsers(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Valid (Days)</label>
                                        <input type="number" placeholder="7" value={promoDays} onChange={e => setPromoDays(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Min Cumulative Deposit To Claim (₹)</label>
                                    <input type="number" placeholder="0 = No requirement" value={promoRequiredDeposit} onChange={e => setPromoRequiredDeposit(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Claim Success Message</label>
                                    <textarea value={promoMsg} onChange={e => setPromoMsg(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl font-bold text-[11px] h-20 outline-none" />
                                </div>
                                <button onClick={handleCreatePromo} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition uppercase tracking-widest text-sm">Generate Gift Code</button>
                            </div>
                        </div>

                        {/* Admin Management */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black text-black uppercase tracking-wider mb-4 flex items-center gap-2"><Shield size={18}/> Admin Management</h3>
                            <div className="flex gap-2 mb-4">
                                <input type="email" placeholder="Email Address" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="flex-1 bg-gray-100 p-3 rounded-xl text-sm font-bold outline-none" />
                                <button onClick={handleAddAdmin} className="bg-blue-600 text-white px-4 rounded-xl font-black text-xs uppercase">Promote</button>
                            </div>
                            <div className="space-y-2">
                                {adminList.map(adm => (
                                    <div key={adm.uid} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-gray-900">{adm.displayName}</span>
                                            <span className="text-[9px] text-gray-500 font-mono">{adm.email}</span>
                                        </div>
                                        {adm.uid !== currentAdminUid && (
                                            <button onClick={() => updateUserRole(adm.uid, 'user').then(loadAdmins)} className="text-red-500 p-2"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* LINKS TAB: BONUSES, VIP, PAYMENT & SUPPORT LINKS */}
                {activeTab === 'link' && (
                    <div className="space-y-6">
                        {/* Economy Variables */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black text-black uppercase tracking-wider mb-6 flex items-center gap-2"><Settings size={18}/> Economy Variables</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">Sign-Up Bonus (₹)</label>
                                    <input type="number" value={settings.referralBonus} onChange={e => setSettings({...settings, referralBonus: Number(e.target.value)})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">Referral Deposit Commission (%)</label>
                                    <input type="number" value={settings.referralDepositBonusPercent} onChange={e => setSettings({...settings, referralDepositBonusPercent: Number(e.target.value)})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">User Deposit Bonus (%)</label>
                                    <input type="number" value={settings.depositBonusPercent} onChange={e => setSettings({...settings, depositBonusPercent: Number(e.target.value)})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                                <div className="pt-4 border-t border-gray-100">
                                    <h4 className="text-[10px] font-black text-blue-600 uppercase mb-3">VIP Tier Management</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Wager Thresholds (10 Values)</label>
                                            <textarea value={vipThresholdsStr} onChange={e => setVipThresholdsStr(e.target.value)} className="w-full bg-gray-100 p-2 rounded-lg font-mono text-[10px] h-16 outline-none" placeholder="0, 1000, 10000..."/>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Daily Rewards (10 Values)</label>
                                            <textarea value={vipDailyStr} onChange={e => setVipDailyStr(e.target.value)} className="w-full bg-gray-100 p-2 rounded-lg font-mono text-[10px] h-16 outline-none" placeholder="10, 20, 50..."/>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Level-Up Rewards (10 Values)</label>
                                            <textarea value={vipLevelUpStr} onChange={e => setVipLevelUpStr(e.target.value)} className="w-full bg-gray-100 p-2 rounded-lg font-mono text-[10px] h-16 outline-none" placeholder="100, 200, 500..."/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* External Support Links */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl border-2 border-blue-50">
                            <h3 className="font-black text-black uppercase tracking-wider mb-6 flex items-center gap-2 text-blue-600"><Globe size={18}/> External Service Links</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">Customer Service URL</label>
                                    <input type="text" value={settings.customerServiceUrl} onChange={e => setSettings({...settings, customerServiceUrl: e.target.value})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" placeholder="https://t.me/your_support" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">Forgot Password URL (Support Link)</label>
                                    <input type="text" value={settings.forgotPasswordUrl} onChange={e => setSettings({...settings, forgotPasswordUrl: e.target.value})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">Privacy Policy URL</label>
                                    <input type="text" value={settings.privacyPolicyUrl} onChange={e => setSettings({...settings, privacyPolicyUrl: e.target.value})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                            </div>
                        </div>

                        {/* Payment Gateways */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black text-black uppercase tracking-wider mb-6 flex items-center gap-2"><CreditCard size={18}/> Payment Gateways</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">Admin UPI ID</label>
                                    <input type="text" value={settings.adminUpiId} onChange={e => setSettings({...settings, adminUpiId: e.target.value})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">UPI QR Image URL</label>
                                    <input type="text" value={settings.adminQrCodeUrl} onChange={e => setSettings({...settings, adminQrCodeUrl: e.target.value})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                                <div className="pt-2 border-t border-gray-100">
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">USDT (TRC20) Address</label>
                                    <input type="text" value={settings.adminUsdtAddress} onChange={e => setSettings({...settings, adminUsdtAddress: e.target.value})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-500 uppercase ml-1">USDT QR Image URL</label>
                                    <input type="text" value={settings.adminUsdtQrCodeUrl} onChange={e => setSettings({...settings, adminUsdtQrCodeUrl: e.target.value})} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none mt-1" />
                                </div>
                            </div>
                        </div>

                        <button onClick={saveSettings} className="w-full bg-black text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-sm">Save All Variable Data</button>
                    </div>
                )}

                {/* SYSTEM TAB: WELCOME & ANNOUNCEMENTS */}
                {activeTab === 'system' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black text-black uppercase tracking-wider mb-4 flex items-center gap-2"><PartyPopper size={18}/> Welcome Messaging</h3>
                            <textarea value={settings.welcomeMessage} onChange={e => setSettings({...settings, welcomeMessage: e.target.value})} className="w-full bg-gray-100 p-4 rounded-2xl font-bold text-sm h-32 outline-none border-2 border-transparent focus:border-orange-400 transition" />
                            <p className="text-[9px] text-gray-400 mt-2 font-black">TAGS: #username, #userid, #balance, #refercode</p>
                        </div>

                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black text-black uppercase tracking-wider mb-6 flex items-center gap-2 text-red-600"><Bell size={18}/> Announcement Broadcast</h3>
                            <div className="space-y-4">
                                <input type="text" placeholder="Title" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl font-black text-sm outline-none" />
                                <textarea placeholder="Content..." value={notifContent} onChange={e => setNotifContent(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl font-bold text-xs h-24 outline-none" />
                                <button onClick={handlePublishNotification} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg uppercase tracking-widest text-xs">Send Broadcast</button>
                            </div>

                            <div className="mt-8 space-y-3">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b pb-1">Previous Announcements</p>
                                {notifications.map(n => (
                                    <div key={n.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="min-w-0 pr-3">
                                            <p className="text-xs font-black truncate">{n.title}</p>
                                            <p className="text-[9px] text-gray-500 truncate">{n.content}</p>
                                        </div>
                                        <button onClick={() => handleDeleteNotif(n.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* LEADERBOARD TAB: TOP 10 MANAGEMENT */}
                {activeTab === 'leaderboard' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-black font-black text-lg border-l-4 border-yellow-500 pl-3">Official Rankings</h2>
                            <span className="text-[10px] font-black text-gray-400">10 Slots</span>
                        </div>
                        {lbEntries.map((entry, i) => (
                            <div key={i} className="bg-white p-5 rounded-[2rem] shadow-md border border-gray-100 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i < 3 ? 'bg-yellow-400 text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
                                        <span className="text-xs font-black text-black">Rank Position {i + 1}</span>
                                    </div>
                                    <select value={entry.gender} onChange={e => updateLbEntry(i, 'gender', e.target.value)} className="text-[10px] font-black bg-gray-100 p-1 px-3 rounded-full outline-none">
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <input placeholder="Name" value={entry.name} onChange={e => updateLbEntry(i, 'name', e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs font-bold outline-none" />
                                    <input placeholder="Public ID" value={entry.userId} onChange={e => updateLbEntry(i, 'userId', e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs font-bold outline-none" />
                                    <input type="number" placeholder="Income" value={entry.amount || ''} onChange={e => updateLbEntry(i, 'amount', Number(e.target.value))} className="bg-gray-50 p-2 rounded-lg text-xs font-bold outline-none" />
                                </div>
                            </div>
                        ))}
                        <button onClick={saveSettings} className="w-full bg-yellow-500 text-black font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-sm">Update Official Rankings</button>
                    </div>
                )}

                {/* WINGO TAB: PREDICTION CONTROL */}
                {activeTab === 'wingo' && (
                    <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
                        <h2 className="text-black font-black mb-6 text-xl flex items-center gap-3"><LayoutDashboard size={24} className="text-indigo-600"/> Wingo Controller</h2>
                        <div className="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100 mb-6 shadow-inner text-center">
                            <p className="text-[11px] text-indigo-700 font-black uppercase mb-2">Operational Mode</p>
                            {currentWingoForced !== null ? (
                                <div className="bg-red-600 text-white p-2 px-4 rounded-full inline-block font-black text-sm shadow-md animate-pulse">FORCED: {currentWingoForced}</div>
                            ) : (
                                <div className="bg-green-600 text-white p-2 px-4 rounded-full inline-block font-black text-sm shadow-md">SMART AUTO MODE</div>
                            )}
                            <p className="text-[10px] text-indigo-400 font-bold mt-4 italic leading-tight">In auto mode, the system selects the number with the lowest total payout from active bets to maximize profit.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <label className="text-[10px] font-black text-gray-400 mb-1">Target # (0-9)</label>
                                <input type="number" max={9} min={0} value={wingoResultInput} onChange={e => setWingoResultInput(e.target.value === '' ? '' : Number(e.target.value))} className="w-20 border-4 border-gray-100 rounded-2xl text-center font-black text-4xl p-3 outline-none focus:border-indigo-400 transition" />
                            </div>
                            <div className="flex-1 flex flex-col gap-2 pt-5">
                                <button onClick={() => handleWingoControl(false)} className="bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition uppercase text-xs">Force Result</button>
                                <button onClick={() => handleWingoControl(true)} className="bg-gray-100 text-gray-500 font-black py-3 rounded-2xl uppercase text-[10px]">Reset to Auto</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Success Notification */}
            {successMessage && (
                <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-black text-white px-8 py-4 rounded-full shadow-2xl z-[1000] flex items-center gap-3 animate-slide-up border border-white/20">
                    <CheckCircle size={20} className="text-green-500" />
                    <span className="font-black text-xs uppercase tracking-widest">{successMessage}</span>
                </div>
            )}
        </div>
    );
};
