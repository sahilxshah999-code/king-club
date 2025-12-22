import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { Transaction, SystemSettings, UserProfile, ActivityTask, LeaderboardEntry } from '../types';
import { 
    getUserProfile, 
    getSystemSettings, 
    updateSystemSettings, 
    setWingoNextResult, 
    getWingoNextResult, 
    approveDeposit, 
    approveWithdrawal, 
    rejectWithdrawal,
    createPromoCode, 
    findUserByEmail, 
    updateUserRole, 
    findUserByNumericId,
    publishNotification,
    fetchAllUsers,
    manualTransfer,
    settleActivityForUser,
    getReferrals
} from '../services/userService';
import { 
    ChevronLeft, ShieldCheck, CheckCircle, Users, Trash2, 
    Settings, IndianRupee, LayoutDashboard, CreditCard, 
    Link as LinkIcon, Bell, Trophy, Search, Key, 
    ClipboardList, Wallet, CheckSquare, Save, Network, Send, UserCog, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AdminTab = 'player' | 'link' | 'system' | 'ranking' | 'finance' | 'wingo';

const COMMANDS_LEGEND = (
    <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4 text-[10px] text-blue-800 space-y-1">
        <div className="flex items-center gap-1 font-bold mb-1"><Info size={12}/> Available Placeholders:</div>
        <div className="grid grid-cols-2 gap-1 font-mono">
            <span>#username</span> <span>#userid</span>
            <span>#balance</span> <span>#winbalance</span>
            <span>#bonus</span> <span>#bet</span>
            <span>#totaldeposit</span> <span>#lastdeposit</span>
            <span>#userclaim</span> <span>#vip</span>
            <span>#referearn</span> <span>#refercount</span>
            <span>#referby</span> <span>#email</span>
        </div>
    </div>
);

export const Admin = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<AdminTab>('player');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [userCache, setUserCache] = useState<Record<string, string>>({});
    
    // Core Settings State
    const [settings, setSettings] = useState<SystemSettings>({
        referralBonus: 0, referralDepositBonusPercent: 0, referralCommission: 0, depositBonusPercent: 0,
        homeBanners: [], adminUpiId: '', adminQrCodeUrl: '', adminUsdtAddress: '',
        adminUsdtQrCodeUrl: '', spinPrizes: [], vipThresholds: [], vipDailyRewards: [],
        vipLevelUpRewards: [], customerServiceUrl: '', forgotPasswordUrl: '',
        privacyPolicyUrl: '', minDeposit: 100, maxDeposit: 100000, minWithdraw: 100,
        maxWithdraw: 100000, welcomeMessage: '', leaderboard: [], loginPopupTitle: '', loginPopupMessage: '',
        activities: []
    });
    
    // -- PLAYER TAB STATE --
    const [playerSearchInput, setPlayerSearchInput] = useState('');
    const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
    const [teamSearchId, setTeamSearchId] = useState('');
    const [teamData, setTeamData] = useState<UserProfile[]>([]);
    
    // Gift Code State
    const [giftCode, setGiftCode] = useState('');
    const [giftAmount, setGiftAmount] = useState<number | ''>('');
    const [giftMaxUsers, setGiftMaxUsers] = useState<number | ''>('');
    const [giftExpiryDate, setGiftExpiryDate] = useState(''); 
    const [giftMinDep, setGiftMinDep] = useState<number | ''>('');
    const [giftMsg, setGiftMsg] = useState('Gift Code Reward');
    
    const [privateId, setPrivateId] = useState('');
    const [privateSubject, setPrivateSubject] = useState('');
    const [privateMsg, setPrivateMsg] = useState('');
    const [settleId, setSettleId] = useState('');
    const [settleActId, setSettleActId] = useState('');
    const [settleAmt, setSettleAmt] = useState<number | ''>('');
    const [manualId, setManualId] = useState('');
    const [manualAmt, setManualAmt] = useState<number | ''>('');
    const [manualMsg, setManualMsg] = useState('System Adjustment');

    // -- SYSTEM TAB STATE --
    const [actTitle, setActTitle] = useState('');
    const [actDesc, setActDesc] = useState('');
    const [actAmt, setActAmt] = useState<number | ''>('');
    const [newBannerUrl, setNewBannerUrl] = useState('');
    const [newBannerLink, setNewBannerLink] = useState('');
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMsg, setBroadcastMsg] = useState('');

    // -- LINK TAB STRINGS (For Array Parsing) --
    const [vipTiersStr, setVipTiersStr] = useState('');

    // -- GAME CONTROL --
    const [wingoForced, setWingoForced] = useState<number | null>(null);
    const [wingoInput, setWingoInput] = useState<number | ''>('');

    useEffect(() => {
        auth.onAuthStateChanged(async (u) => {
            if(u) {
                const profile = await getUserProfile(u.uid);
                if(profile?.role === 'admin') setIsAdmin(true);
                else navigate('/');
            } else navigate('/login');
        });

        const unsubTx = onValue(ref(db, 'transactions'), (snap) => {
            if (snap.exists()) {
                const data = Object.values(snap.val()) as Transaction[];
                data.sort((a, b) => b.timestamp - a.timestamp);
                setTransactions(data);
            }
        });

        getSystemSettings().then(s => {
            setSettings(s);
            setVipTiersStr(s.vipThresholds?.join(', ') || '');
        });
        getWingoNextResult().then(setWingoForced);
        
        return () => unsubTx();
    }, [navigate]);

    // Fetch user IDs for legacy transactions
    useEffect(() => {
        const pendingWithoutId = transactions.filter(t => t.status === 'pending' && !t.userNumericId);
        const uniqueUids = Array.from(new Set(pendingWithoutId.map(t => t.uid)));
        
        uniqueUids.forEach((uid: string) => {
            if (!userCache[uid]) {
                getUserProfile(uid).then(u => {
                    if (u && u.numericId) {
                        setUserCache(prev => ({...prev, [uid]: u.numericId!}));
                    }
                });
            }
        });
    }, [transactions]);

    const showSuccess = (msg: string) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(''), 3000); };

    // --- HANDLERS ---

    const handleSaveSettings = async (partialSettings: Partial<SystemSettings>, msg = "Settings Saved") => {
        const newSettings = { ...settings, ...partialSettings };
        await updateSystemSettings(newSettings);
        setSettings(newSettings);
        showSuccess(msg);
    };

    const handleAction = async (tx: Transaction, action: 'approved' | 'rejected') => {
        await update(ref(db, `transactions/${tx.id}`), { status: action });
        if(action === 'approved') {
            if (tx.type === 'deposit') await approveDeposit(tx.uid, tx.amount);
            else if (tx.type === 'withdraw') await approveWithdrawal(tx.uid, tx.amount);
        } else if (action === 'rejected' && tx.type === 'withdraw') {
            await rejectWithdrawal(tx.uid, tx.amount);
        }
        showSuccess(`Tx ${action}`);
    };

    // Player Tab Handlers
    const handlePlayerSearch = async () => {
        if (!playerSearchInput) return;
        const u = await findUserByNumericId(playerSearchInput) || await findUserByEmail(playerSearchInput);
        setSearchedUser(u);
        if(!u) alert("Player not found.");
    };

    const handleTeamSearch = async () => {
        if(!teamSearchId) return;
        const u = await findUserByNumericId(teamSearchId);
        if(!u) { alert("Leader not found"); return; }
        const referrals = await getReferrals(u.uid);
        setTeamData(referrals);
    };

    const handleCreateGift = async () => {
        if(!giftCode || !giftAmount || !giftExpiryDate) return alert("Fill Code, Amount and Expiry Date.");
        
        const expiryTimestamp = new Date(giftExpiryDate).getTime();
        if (expiryTimestamp <= Date.now()) return alert("Expiry date must be in the future.");

        await createPromoCode(
            giftCode.toUpperCase(), 
            Number(giftAmount), 
            Number(giftMaxUsers) || 100, 
            expiryTimestamp, 
            giftMsg, 
            Number(giftMinDep) > 0, 
            Number(giftMinDep) || 0
        );
        showSuccess("Gift Code Created!");
        setGiftCode(''); setGiftAmount(''); setGiftExpiryDate('');
    };

    const handlePrivateAlert = async () => {
        const u = await findUserByNumericId(privateId);
        if(!u) return alert("User not found");
        await publishNotification(privateSubject || "System Message", privateMsg, u.uid);
        showSuccess("Message Sent");
        setPrivateId(''); setPrivateMsg('');
    };

    const handleSettleActivity = async () => {
        if(!settleId || !settleActId || !settleAmt) return alert("Missing fields");
        try {
            await settleActivityForUser(settleId, settleActId, Number(settleAmt), "Activity Reward");
            showSuccess(`Paid ${settleId}`);
        } catch(e:any) { alert(e.message); }
    };

    const handleManualPay = async () => {
        if(!manualId || !manualAmt) return alert("Missing fields");
        try {
            await manualTransfer(manualId, Number(manualAmt), manualMsg);
            showSuccess(`Transferred to ${manualId}`);
        } catch(e:any) { alert(e.message); }
    };

    // Link/System Handlers
    const handleAddActivity = async () => {
        if(!actTitle || !actAmt) return alert("Title/Amount needed");
        const newTask: ActivityTask = { id: Math.random().toString(36).substring(2,9), title: actTitle, description: actDesc, amount: Number(actAmt), timestamp: Date.now() };
        const newActs = [...(settings.activities || []), newTask];
        handleSaveSettings({ activities: newActs }, "Activity Created");
        setActTitle(''); setActAmt('');
    };

    const handleAddBanner = async () => {
        if(!newBannerUrl) return;
        const newBanners = [...(settings.homeBanners || []), { imageUrl: newBannerUrl, link: newBannerLink }];
        handleSaveSettings({ homeBanners: newBanners }, "Banner Added");
        setNewBannerUrl('');
    };

    const handleRankingUpdate = async (index: number, field: keyof LeaderboardEntry, value: any) => {
        const list = [...(settings.leaderboard || [])];
        // Ensure list is populated
        while(list.length <= index) list.push({ name: 'Player', userId: '000000', amount: 0, gender: 'male' });
        
        // Correct way to update computed property in TS to avoid type errors
        const entry = { ...list[index] };
        (entry as any)[field] = value;
        list[index] = entry;

        setSettings({ ...settings, leaderboard: list });
    };

    if(!isAdmin) return null;

    const navBtn = (id: AdminTab, label: string, Icon: any) => (
        <button onClick={() => setActiveTab(id)} className={`flex-1 py-4 flex flex-col items-center gap-1 text-[10px] font-black uppercase transition-all ${activeTab === id ? 'text-black border-b-4 border-black bg-gray-50' : 'text-gray-400 hover:text-gray-600'}`}>
            <Icon size={18} strokeWidth={2.5}/> {label}
        </button>
    );

    return (
        <div className="bg-[#f0f2f5] min-h-screen pb-20 font-sans">
            <div className="bg-black text-white p-4 sticky top-0 z-[100] shadow-2xl">
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => navigate('/profile')} className="p-2 bg-white/10 rounded-full"><ChevronLeft size={20}/></button>
                    <h1 className="font-black italic tracking-widest uppercase text-lg flex items-center gap-2"><ShieldCheck className="text-blue-500" /> ADMIN PANEL</h1>
                </div>
                <div className="flex bg-white rounded-2xl overflow-x-auto no-scrollbar shadow-inner p-1">
                    {navBtn('player', 'Player', Users)}
                    {navBtn('link', 'Link', LinkIcon)}
                    {navBtn('system', 'System', Settings)}
                    {navBtn('ranking', 'Rank', Trophy)}
                    {navBtn('finance', 'Pay', IndianRupee)}
                    {navBtn('wingo', 'Game', LayoutDashboard)}
                </div>
            </div>

            <div className="p-4 max-w-lg mx-auto space-y-6">
                
                {/* 1. PLAYER TAB */}
                {activeTab === 'player' && (
                    <div className="space-y-8">
                        {/* Player Management */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-blue-600 flex gap-2"><UserCog size={14}/> 1. Player Management</h3>
                            <div className="flex gap-2 mb-4">
                                <input placeholder="ID or Email" value={playerSearchInput} onChange={e => setPlayerSearchInput(e.target.value)} className="flex-1 bg-gray-50 p-3 rounded-xl text-sm border font-bold" />
                                <button onClick={handlePlayerSearch} className="bg-blue-600 text-white px-4 rounded-xl font-bold text-xs uppercase">Find</button>
                            </div>
                            {searchedUser && (
                                <div className="p-4 bg-blue-50 rounded-2xl text-xs space-y-2">
                                    <p><strong>Name:</strong> {searchedUser.displayName}</p>
                                    <p><strong>Role:</strong> {searchedUser.role}</p>
                                    <p><strong>Balance:</strong> ₹{searchedUser.balance}</p>
                                    <p><strong>Refs:</strong> {searchedUser.referralCount || 0}</p>
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => updateUserRole(searchedUser.uid, 'admin').then(() => showSuccess("Promoted"))} className="bg-black text-white px-2 py-1 rounded">Make Admin</button>
                                        <button onClick={() => updateUserRole(searchedUser.uid, 'demo').then(() => showSuccess("Demo Mode"))} className="bg-gray-500 text-white px-2 py-1 rounded">Make Demo</button>
                                        <button onClick={() => updateUserRole(searchedUser.uid, 'user').then(() => showSuccess("Demoted"))} className="bg-blue-500 text-white px-2 py-1 rounded">Make User</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Team Hierarchy */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-indigo-600 flex gap-2"><Network size={14}/> 2. Team Hierarchy</h3>
                            <div className="flex gap-2 mb-4">
                                <input placeholder="Upline ID" value={teamSearchId} onChange={e => setTeamSearchId(e.target.value)} className="flex-1 bg-gray-50 p-3 rounded-xl text-sm border font-bold" />
                                <button onClick={handleTeamSearch} className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-xs uppercase">Show</button>
                            </div>
                            {teamData.length > 0 && (
                                <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded-xl">
                                    {teamData.map(u => (
                                        <div key={u.uid} className="flex justify-between p-2 border-b text-xs">
                                            <span>{u.displayName} ({u.numericId})</span>
                                            <span className="font-bold">₹{u.balance.toFixed(0)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Gift Code */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-red-600 flex gap-2"><Key size={14}/> 3. Gift Code</h3>
                            {COMMANDS_LEGEND}
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input placeholder="Code" value={giftCode} onChange={e => setGiftCode(e.target.value)} className="bg-gray-50 p-3 rounded-xl text-xs font-bold border" />
                                <input placeholder="Amount" type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value===''?'':Number(e.target.value))} className="bg-gray-50 p-3 rounded-xl text-xs font-bold border" />
                                <input placeholder="Max Users" type="number" value={giftMaxUsers} onChange={e => setGiftMaxUsers(e.target.value===''?'':Number(e.target.value))} className="bg-gray-50 p-3 rounded-xl text-xs font-bold border" />
                                <input placeholder="Min Dep" type="number" value={giftMinDep} onChange={e => setGiftMinDep(e.target.value===''?'':Number(e.target.value))} className="bg-gray-50 p-3 rounded-xl text-xs font-bold border" />
                            </div>
                            <div className="mb-2">
                                <label className="text-[10px] text-gray-400 font-bold block mb-1">Expiry Date & Time</label>
                                <input type="datetime-local" value={giftExpiryDate} onChange={e => setGiftExpiryDate(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border" />
                            </div>
                            <input placeholder="Custom Message (Use placeholders)" value={giftMsg} onChange={e => setGiftMsg(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2" />
                            <button onClick={handleCreateGift} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold uppercase text-xs">Create Code</button>
                        </div>

                        {/* Private Alert */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-orange-500 flex gap-2"><Bell size={14}/> 4. Private Alert</h3>
                            {COMMANDS_LEGEND}
                            <input placeholder="Target ID" value={privateId} onChange={e => setPrivateId(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2" />
                            <input placeholder="Subject" value={privateSubject} onChange={e => setPrivateSubject(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2" />
                            <textarea placeholder="Message... (Use placeholders)" value={privateMsg} onChange={e => setPrivateMsg(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2 h-16" />
                            <button onClick={handlePrivateAlert} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold uppercase text-xs">Send Alert</button>
                        </div>

                    
                        {/* Activity Settlement */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-teal-600 flex gap-2"><CheckSquare size={14}/> 6. Activity Settlement</h3>
                            <input placeholder="Target ID" value={settleId} onChange={e => setSettleId(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2" />
                            <select value={settleActId} onChange={e => {setSettleActId(e.target.value); const a = settings.activities?.find(x=>x.id===e.target.value); if(a) setSettleAmt(a.amount);}} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2">
                                <option value="">Select Activity</option>
                                {settings.activities?.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                            </select>
                            <input placeholder="Amount" type="number" value={settleAmt} onChange={e => setSettleAmt(Number(e.target.value))} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2" />
                            <button onClick={handleSettleActivity} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold uppercase text-xs">Pay</button>
                        </div>

                        {/* Manual Payment */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-green-600 flex gap-2"><Wallet size={14}/> 7. Manual Payment</h3>
                            {COMMANDS_LEGEND}
                            <input placeholder="Target ID" value={manualId} onChange={e => setManualId(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2" />
                            <input placeholder="Amount" type="number" value={manualAmt} onChange={e => setManualAmt(Number(e.target.value))} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2" />
                            <input placeholder="Command/Message (Use placeholders)" value={manualMsg} onChange={e => setManualMsg(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-xs font-bold border mb-2" />
                            <button onClick={handleManualPay} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold uppercase text-xs">Execute</button>
                        </div>
                    </div>
                )}

                {/* 2. LINK TAB */}
                {activeTab === 'link' && (
                    <div className="space-y-6">
                        {/* Economy Commission */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-black uppercase text-xs text-indigo-600">1. Economy & Commission</h3><Save size={16} className="text-gray-400 cursor-pointer" onClick={() => handleSaveSettings(settings)} /></div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="text-[10px] text-gray-400 font-bold">Ref Bonus</label><input type="number" value={settings.referralBonus} onChange={e => setSettings({...settings, referralBonus: Number(e.target.value)})} className="w-full bg-gray-50 p-2 rounded-lg border font-bold text-sm"/></div>
                                <div><label className="text-[10px] text-gray-400 font-bold">Ref Comm %</label><input type="number" value={settings.referralCommission} onChange={e => setSettings({...settings, referralCommission: Number(e.target.value)})} className="w-full bg-gray-50 p-2 rounded-lg border font-bold text-sm"/></div>
                                <div><label className="text-[10px] text-gray-400 font-bold">Dep Bonus %</label><input type="number" value={settings.depositBonusPercent} onChange={e => setSettings({...settings, depositBonusPercent: Number(e.target.value)})} className="w-full bg-gray-50 p-2 rounded-lg border font-bold text-sm"/></div>
                            </div>
                            <button onClick={() => handleSaveSettings(settings)} className="mt-3 w-full bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold">Save Economy</button>
                        </div>

                        {/* Limit Management */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-black uppercase text-xs text-red-600">2. Limit Management</h3></div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="text-[10px] text-gray-400 font-bold">Min Deposit</label><input type="number" value={settings.minDeposit} onChange={e => setSettings({...settings, minDeposit: Number(e.target.value)})} className="w-full bg-gray-50 p-2 rounded-lg border font-bold text-sm"/></div>
                                <div><label className="text-[10px] text-gray-400 font-bold">Max Deposit</label><input type="number" value={settings.maxDeposit} onChange={e => setSettings({...settings, maxDeposit: Number(e.target.value)})} className="w-full bg-gray-50 p-2 rounded-lg border font-bold text-sm"/></div>
                                <div><label className="text-[10px] text-gray-400 font-bold">Min Withdraw</label><input type="number" value={settings.minWithdraw} onChange={e => setSettings({...settings, minWithdraw: Number(e.target.value)})} className="w-full bg-gray-50 p-2 rounded-lg border font-bold text-sm"/></div>
                                <div><label className="text-[10px] text-gray-400 font-bold">Max Withdraw</label><input type="number" value={settings.maxWithdraw} onChange={e => setSettings({...settings, maxWithdraw: Number(e.target.value)})} className="w-full bg-gray-50 p-2 rounded-lg border font-bold text-sm"/></div>
                            </div>
                            <button onClick={() => handleSaveSettings(settings)} className="mt-3 w-full bg-red-600 text-white py-2 rounded-lg text-xs font-bold">Save Limits</button>
                        </div>

                        {/* Payment Gateway */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-black uppercase text-xs text-green-600">3. Payment Gateway</h3></div>
                            <div className="space-y-2">
                                <input placeholder="UPI ID" value={settings.adminUpiId} onChange={e => setSettings({...settings, adminUpiId: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-sm" />
                                <input placeholder="UPI QR URL" value={settings.adminQrCodeUrl} onChange={e => setSettings({...settings, adminQrCodeUrl: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-sm" />
                                <input placeholder="USDT Addr" value={settings.adminUsdtAddress} onChange={e => setSettings({...settings, adminUsdtAddress: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-sm" />
                                <input placeholder="USDT QR URL" value={settings.adminUsdtQrCodeUrl} onChange={e => setSettings({...settings, adminUsdtQrCodeUrl: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-sm" />
                            </div>
                            <button onClick={() => handleSaveSettings(settings)} className="mt-3 w-full bg-green-600 text-white py-2 rounded-lg text-xs font-bold">Save Payment</button>
                        </div>

                        {/* Support Links */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-black uppercase text-xs text-blue-600">4. Support Links</h3></div>
                            <div className="space-y-2">
                                <input placeholder="Customer Care URL" value={settings.customerServiceUrl} onChange={e => setSettings({...settings, customerServiceUrl: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-sm" />
                                <input placeholder="Forgot Password URL" value={settings.forgotPasswordUrl} onChange={e => setSettings({...settings, forgotPasswordUrl: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-sm" />
                                <input placeholder="Privacy Policy URL" value={settings.privacyPolicyUrl} onChange={e => setSettings({...settings, privacyPolicyUrl: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-sm" />
                            </div>
                            <button onClick={() => handleSaveSettings(settings)} className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold">Save Links</button>
                        </div>

                        {/* VIP Tiers */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-black uppercase text-xs text-yellow-600">5. VIP Tiers Management</h3></div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1">Thresholds (Comma separated)</label>
                            <textarea 
                                value={vipTiersStr} 
                                onChange={e => setVipTiersStr(e.target.value)} 
                                className="w-full bg-gray-50 p-3 rounded-lg border text-xs font-mono h-20 mb-2"
                                placeholder="0, 1000, 5000, 10000..." 
                            />
                            <button onClick={() => {
                                const arr = vipTiersStr.split(',').map(s => parseInt(s.trim()) || 0);
                                handleSaveSettings({ vipThresholds: arr });
                            }} className="w-full bg-yellow-600 text-white py-2 rounded-lg text-xs font-bold">Save Tiers</button>
                        </div>
                    </div>
                )}

                {/* 3. SYSTEM TAB */}
                {activeTab === 'system' && (
                    <div className="space-y-6">
                        {/* Task Creator */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-[#f52c2c] flex gap-2"><ClipboardList size={14}/> 1. Task Creator</h3>
                            <input placeholder="Title" value={actTitle} onChange={e => setActTitle(e.target.value)} className="w-full bg-gray-50 p-2 rounded-lg border text-sm mb-2" />
                            <textarea placeholder="Description" value={actDesc} onChange={e => setActDesc(e.target.value)} className="w-full bg-gray-50 p-2 rounded-lg border text-sm mb-2 h-16" />
                            <input placeholder="Amount" type="number" value={actAmt} onChange={e => setActAmt(e.target.value===''?'':Number(e.target.value))} className="w-full bg-gray-50 p-2 rounded-lg border text-sm mb-2" />
                            <button onClick={handleAddActivity} className="w-full bg-[#f52c2c] text-white py-2 rounded-lg font-bold text-xs uppercase">Create Task</button>
                        </div>

                        {/* Messages */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-purple-600">2 & 3. System Messages</h3>
                            {COMMANDS_LEGEND}
                            <div className="space-y-3">
                                <div><label className="text-[10px] text-gray-400 font-bold">Welcome Message</label><textarea value={settings.welcomeMessage} onChange={e => setSettings({...settings, welcomeMessage: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-xs h-16"/></div>
                                <div><label className="text-[10px] text-gray-400 font-bold">Login Popup Title</label><input value={settings.loginPopupTitle} onChange={e => setSettings({...settings, loginPopupTitle: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-xs"/></div>
                                <div><label className="text-[10px] text-gray-400 font-bold">Login Popup Message</label><textarea value={settings.loginPopupMessage} onChange={e => setSettings({...settings, loginPopupMessage: e.target.value})} className="w-full bg-gray-50 p-2 rounded-lg border text-xs h-16"/></div>
                            </div>
                            <button onClick={() => handleSaveSettings(settings)} className="mt-3 w-full bg-purple-600 text-white py-2 rounded-lg text-xs font-bold">Save Messages</button>
                        </div>

                        {/* Banner */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-blue-500">4. Banner Create</h3>
                            <input placeholder="Image URL" value={newBannerUrl} onChange={e => setNewBannerUrl(e.target.value)} className="w-full bg-gray-50 p-2 rounded-lg border text-sm mb-2" />
                            <input placeholder="Link (Optional)" value={newBannerLink} onChange={e => setNewBannerLink(e.target.value)} className="w-full bg-gray-50 p-2 rounded-lg border text-sm mb-2" />
                            <button onClick={handleAddBanner} className="w-full bg-blue-500 text-white py-2 rounded-lg font-bold text-xs uppercase">Add Banner</button>
                            <div className="mt-4 border-t pt-2">
                                {settings.homeBanners?.map((b, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs p-1">
                                        <span className="truncate w-3/4">{b.imageUrl}</span>
                                        <button onClick={() => {
                                            const nb = settings.homeBanners.filter((_, idx) => idx !== i);
                                            handleSaveSettings({ homeBanners: nb }, "Banner Removed");
                                        }} className="text-red-500 font-bold">X</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Broadcast */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl">
                            <h3 className="font-black uppercase text-xs mb-4 text-orange-600 flex gap-2"><Send size={14}/> 5. Global Broadcast</h3>
                            {COMMANDS_LEGEND}
                            <input placeholder="Title" value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} className="w-full bg-gray-50 p-2 rounded-lg border text-sm mb-2" />
                            <textarea placeholder="Message... (Use placeholders)" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} className="w-full bg-gray-50 p-2 rounded-lg border text-sm mb-2 h-16" />
                            <button onClick={() => {
                                if(broadcastTitle && broadcastMsg) {
                                    publishNotification(broadcastTitle, broadcastMsg);
                                    showSuccess("Broadcast Sent");
                                    setBroadcastTitle(''); setBroadcastMsg('');
                                }
                            }} className="w-full bg-orange-600 text-white py-2 rounded-lg font-bold text-xs uppercase">Push Broadcast</button>
                        </div>
                    </div>
                )}

                {/* 4. RANKING TAB */}
                {activeTab === 'ranking' && (
                    <div className="space-y-4">
                        <h2 className="font-black uppercase border-l-4 border-yellow-500 pl-3 text-black text-xs">Top 10 Player Manual Control</h2>
                        {Array.from({length: 10}).map((_, i) => {
                            const entry = settings.leaderboard?.[i] || {name:'', userId:'', amount:0, gender:'male'};
                            return (
                                <div key={i} className="bg-white p-4 rounded-3xl shadow-md border border-gray-100 flex gap-2 items-center">
                                    <span className="font-black text-yellow-600 text-xs w-6">#{i+1}</span>
                                    <input placeholder="Name" value={entry.name} onChange={e => handleRankingUpdate(i, 'name', e.target.value)} className="bg-gray-50 p-2 rounded-lg border text-[10px] w-1/4" />
                                    <input placeholder="ID" value={entry.userId} onChange={e => handleRankingUpdate(i, 'userId', e.target.value)} className="bg-gray-50 p-2 rounded-lg border text-[10px] w-1/4" />
                                    <input placeholder="₹" type="number" value={entry.amount} onChange={e => handleRankingUpdate(i, 'amount', Number(e.target.value))} className="bg-gray-50 p-2 rounded-lg border text-[10px] w-1/4" />
                                    <select value={entry.gender} onChange={e => handleRankingUpdate(i, 'gender', e.target.value)} className="bg-gray-50 p-2 rounded-lg border text-[10px] w-16">
                                        <option value="male">M</option>
                                        <option value="female">F</option>
                                    </select>
                                </div>
                            );
                        })}
                        <button onClick={() => handleSaveSettings(settings, "Rankings Synced")} className="w-full bg-yellow-500 text-black font-black py-5 rounded-3xl shadow-xl uppercase active:scale-95 transition">Save Rankings</button>
                    </div>
                )}

                {/* FINANCE TAB */}
                {activeTab === 'finance' && (
                    <div className="space-y-4">
                        <h2 className="font-black uppercase border-l-4 border-red-600 pl-3 text-black text-xs">Pending Transactions</h2>
                        {transactions.filter(t => t.status === 'pending').length === 0 && <p className="text-gray-400 text-xs text-center py-4">No pending requests</p>}
                        {transactions.filter(t => t.status === 'pending').map(tx => (
                            <div key={tx.id} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-xl flex justify-between items-center animate-fade-in">
                                <div>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${tx.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.type}</span>
                                    <p className="font-black text-sm mt-1 text-black">ID: <span className="text-red-600 text-lg bg-red-100 px-2 py-0.5 rounded border border-red-200">{tx.userNumericId || userCache[tx.uid] || 'Loading...'}</span></p>
                                    <p className="text-[10px] text-gray-400 mt-1">{tx.details}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-xl text-black">₹{tx.amount}</p>
                                    <div className="flex gap-2 mt-2">
                               <button onClick={() => handleAction(tx, 'approved')} className="bg-green-600 text-white p-2 rounded-xl shadow-lg active:scale-90 transition"><CheckCircle size={20}/></button>
                                        <button onClick={() => handleAction(tx, 'rejected')} className="bg-red-600 text-white p-2 rounded-xl shadow-lg active:scale-90 transition"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* WINGO TAB */}
                {activeTab === 'wingo' && (
                    <div className="bg-white p-8 rounded-[3rem] border shadow-2xl text-center space-y-6">
                        <h2 className="font-black uppercase flex items-center justify-center gap-2 text-indigo-700"><LayoutDashboard size={24}/> Force Results</h2>
                        <div className={`p-6 rounded-[2rem] font-black text-white shadow-lg transition-all ${wingoForced !== null ? 'bg-red-600 animate-pulse' : 'bg-green-600'}`}>
                            {wingoForced !== null ? `CURRENTLY FORCING: ${wingoForced}` : 'STATUS: AI AUTO MODE'}
                        </div>
                        <div className="flex gap-3">
                            <input type="number" max={9} min={0} value={wingoInput} onChange={e => setWingoInput(e.target.value===''?'':Number(e.target.value))} className="w-24 bg-gray-50 border-4 border-gray-100 p-5 rounded-3xl text-center font-black text-4xl shadow-inner outline-none" placeholder="?" />
                            <div className="flex-1 flex flex-col gap-3">
                                <button onClick={async () => { if(wingoInput==='') return; await setWingoNextResult(Number(wingoInput)); setWingoForced(Number(wingoInput)); showSuccess("Locked result: " + wingoInput); }} className="bg-black text-white font-black py-4 rounded-2xl uppercase shadow-xl active:scale-95 transition">Lock Next</button>
                                <button onClick={async () => { await setWingoNextResult(null); setWingoForced(null); setWingoInput(''); showSuccess("Returned to Auto"); }} className="bg-gray-200 text-gray-500 font-black py-3 rounded-2xl uppercase active:scale-95 transition">Auto Mode</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {successMessage && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-black text-white px-10 py-4 rounded-full shadow-2xl z-[1000] flex items-center gap-4 border border-white/20">
                    <div className="bg-green-500 rounded-full p-1"><CheckCircle size={20} className="text-black" /></div>
                    <span className="font-black text-xs uppercase tracking-widest">{successMessage}</span>
                </div>
            )}
        </div>
    );
};
                
