import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { Transaction, SystemSettings, UserProfile, BannerItem } from '../types';
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
    deleteUserAccount, 
    findUserByNumericId 
} from '../services/userService';
import { 
    ChevronLeft, Shield, CheckCircle, RefreshCcw, Gift, Users, Trash2, 
    ArrowDownCircle, Settings, IndianRupee, Image as ImageIcon, 
    LayoutDashboard, Database, Bitcoin, CreditCard, ExternalLink, Link as LinkIcon, UserPlus, Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Type Definitions
type AdminTab = 'finance' | 'system' | 'users' | 'wingo';

// Helper function
function snapshotToArray<T>(snapshot: any): T[] {
    const val = snapshot.val();
    if (!val) return [];
    return Object.values(val) as T[];
}

export const Admin = () => {
    const navigate = useNavigate();
    
    // State Declarations
    const [activeTab, setActiveTab] = useState<AdminTab>('finance');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentAdminUid, setCurrentAdminUid] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
    // Config State
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
        notificationText: ''
    });
    
    // Config strings for editing
    const [spinPrizesStr, setSpinPrizesStr] = useState('');
    const [vipThresholdsStr, setVipThresholdsStr] = useState('');
    const [vipDailyStr, setVipDailyStr] = useState('');
    const [vipLevelUpStr, setVipLevelUpStr] = useState('');
    const [newBannerUrl, setNewBannerUrl] = useState('');
    const [newBannerLink, setNewBannerLink] = useState('');

    // Wingo Control State
    const [wingoResultInput, setWingoResultInput] = useState<number | ''>('');
    const [currentWingoForced, setCurrentWingoForced] = useState<number | null>(null);

    // Referral Lookup State
    const [searchRefInput, setSearchRefInput] = useState('');
    const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
    const [searchStatus, setSearchStatus] = useState('');
    
    // Promo Code State
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState<number | ''>('');
    const [promoUsers, setPromoUsers] = useState<number | ''>('');
    const [promoDays, setPromoDays] = useState<number | ''>('');
    const [promoMsg, setPromoMsg] = useState('Congratulations #username! Here is your gift.');
    const [promoRequiresDeposit, setPromoRequiresDeposit] = useState(false);
    const [promoRequiredDepositAmount, setPromoRequiredDepositAmount] = useState<number | ''>('');

    // Admin Management State
    const [adminList, setAdminList] = useState<UserProfile[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');

    // User Search State
    const [userDetailsInput, setUserDetailsInput] = useState('');
    const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        const checkAdmin = async () => {
            const u = auth.currentUser;
            if(u) {
                setCurrentAdminUid(u.uid);
                const profile = await getUserProfile(u.uid);
                if(profile?.role === 'admin') {
                    setIsAdmin(true);
                    loadAdmins();
                } else {
                    navigate('/');
                }
            } else {
                navigate('/login');
            }
        };
        checkAdmin();

        const txRef = ref(db, 'transactions');
        const unsub = onValue(txRef, (snap) => {
            const data = snapshotToArray<Transaction>(snap);
            data.sort((a, b) => b.timestamp - a.timestamp);
            setTransactions(data);
        });

        getSystemSettings().then(s => {
            setSettings(s);
            setSpinPrizesStr(s.spinPrizes ? s.spinPrizes.join(', ') : '');
            setVipThresholdsStr(s.vipThresholds ? s.vipThresholds.join(', ') : '');
            setVipDailyStr(s.vipDailyRewards ? s.vipDailyRewards.join(', ') : '');
            setVipLevelUpStr(s.vipLevelUpRewards ? s.vipLevelUpRewards.join(', ') : '');
        });

        const checkWingo = async () => {
            const res = await getWingoNextResult();
            setCurrentWingoForced(res);
        };
        checkWingo();
        
        return () => unsub();
    }, [navigate]);

    const loadAdmins = async () => {
        const admins = await getAdmins();
        setAdminList(admins);
    };

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

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
            vipLevelUpRewards: levelUpRewards
        };
        await updateSystemSettings(newSettings);
        setSettings(newSettings);
        showSuccess("Settings Saved Successfully!");
    };

    const addBanner = () => {
        if (!newBannerUrl.trim()) return;
        const newBanner: BannerItem = { imageUrl: newBannerUrl.trim() };
        if (newBannerLink.trim()) newBanner.link = newBannerLink.trim();
        
        const updatedBanners = [...(settings.homeBanners || []), newBanner];
        setSettings({...settings, homeBanners: updatedBanners});
        setNewBannerUrl('');
        setNewBannerLink('');
    };

    const removeBanner = (index: number) => {
        const updatedBanners = (settings.homeBanners || []).filter((_, i) => i !== index);
        setSettings({...settings, homeBanners: updatedBanners});
    };

    const handleWingoControl = async (reset: boolean = false) => {
        if (reset) {
            await setWingoNextResult(null);
            setCurrentWingoForced(null);
            setWingoResultInput('');
            showSuccess("Wingo set to Automatic Mode (Lowest Payout)");
        } else {
            const val = Number(wingoResultInput);
            if (wingoResultInput === '' || isNaN(val) || val < 0 || val > 9) {
                alert("Please enter a valid number (0-9)");
                return;
            }
            await setWingoNextResult(val);
            setCurrentWingoForced(val);
            showSuccess("Wingo Next Result Set: " + val);
        }
    };

    const handleReferralSearch = async () => {
        setSearchStatus('Searching...');
        setReferredUsers([]);
        let targetUid = searchRefInput.trim();
        if (targetUid.length < 15) {
            const resolvedUid = await getUidFromReferralCode(targetUid);
            if (resolvedUid) targetUid = resolvedUid;
            else { setSearchStatus('Invalid Referral Code'); return; }
        }
        const referrals = await getReferrals(targetUid);
        setReferredUsers(referrals);
        setSearchStatus(referrals.length > 0 ? `Found ${referrals.length} users` : 'No referrals found for this user.');
    };

    const handleCreatePromo = async () => {
        if (!promoCode || !promoAmount || !promoUsers || !promoDays) {
            alert("Please fill all promo fields");
            return;
        }
        await createPromoCode(promoCode, Number(promoAmount), Number(promoUsers), Number(promoDays), promoMsg, promoRequiresDeposit, Number(promoRequiredDepositAmount) || 0);
        showSuccess("Promo Code Created Successfully!");
        setPromoCode('');
        setPromoAmount('');
        setPromoRequiredDepositAmount('');
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim()) return;
        const user = await findUserByEmail(newAdminEmail);
        if (!user) { alert("User not found."); return; }
        if (user.role === 'admin') { alert("User is already an admin."); return; }
        if(window.confirm(`Promote ${user.displayName} to Admin?`)) {
            await updateUserRole(user.uid, 'admin');
            showSuccess("User promoted to Admin");
            setNewAdminEmail('');
            loadAdmins();
        }
    };

    const handleDemoteAdmin = async (uid: string) => {
        if (uid === currentAdminUid) return;
        if(window.confirm("Demote admin?")) {
            await updateUserRole(uid, 'user');
            loadAdmins();
        }
    };

    const handleUserSearch = async () => {
        if(!userDetailsInput.trim()) return;
        setSearchLoading(true);
        setSearchedUser(null);
        const input = userDetailsInput.trim();
        let user = await findUserByNumericId(input);
        if (!user) user = await findUserByEmail(input);
        if (!user) user = await getUserProfile(input);
        setSearchedUser(user);
        if(!user) showSuccess("User not found");
        setSearchLoading(false);
    };

    if(!isAdmin) return <div className="p-10 text-center text-red-500 font-bold">Access Denied</div>;

    const navItemClass = (tab: AdminTab) => 
        `flex-1 py-3 text-xs font-bold uppercase tracking-wide flex flex-col items-center gap-1 ${activeTab === tab ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:bg-gray-50'}`;

    return (
        <div className="bg-[#f0f2f5] pb-24 relative min-h-full">
             <div className="bg-black text-white p-4 shadow-lg sticky top-0 z-50">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => navigate('/profile')} className="p-1 hover:bg-white/20 rounded-full"><ChevronLeft /></button>
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        <Shield size={18} fill="white" className="text-blue-500" /> Admin Console
                    </h1>
                    <div className="w-6"></div>
                </div>

                <div className="flex bg-white rounded-lg overflow-hidden shadow-sm">
                    <button onClick={() => setActiveTab('finance')} className={navItemClass('finance')}><IndianRupee size={16} /> Finance</button>
                    <button onClick={() => setActiveTab('system')} className={navItemClass('system')}><Settings size={16} /> System</button>
                    <button onClick={() => setActiveTab('users')} className={navItemClass('users')}><Users size={16} /> Users</button>
                    <button onClick={() => setActiveTab('wingo')} className={navItemClass('wingo')}><LayoutDashboard size={16} /> Games</button>
                </div>
            </div>
            
            <div className="p-4 space-y-6">

                {/* FINANCE TAB */}
                {activeTab === 'finance' && (
                    <div>
                        <h2 className="text-gray-800 font-bold text-lg mb-3">Pending Approvals</h2>
                        <div className="space-y-3">
                            {transactions.filter(t => t.status === 'pending').map(tx => (
                                <div key={tx.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex justify-between mb-2">
                                        <span className={`font-black uppercase text-sm px-2 py-0.5 rounded ${tx.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.type}</span>
                                        <span className="text-gray-900 font-black">₹{tx.amount}</span>
                                    </div>
                                    <div className="text-xs text-gray-400 mb-3 font-mono break-all bg-gray-50 p-2 rounded">{tx.details}</div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleAction(tx, 'approved')} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-bold shadow">Approve</button>
                                        <button onClick={() => handleAction(tx, 'rejected')} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-bold shadow">Reject</button>
                                    </div>
                                </div>
                            ))}
                            {transactions.filter(t => t.status === 'pending').length === 0 && (
                                <div className="bg-white p-10 rounded-xl text-center text-gray-400 text-sm border border-dashed border-gray-200">
                                    <CheckCircle className="mx-auto mb-2 opacity-50" size={32} /> No pending transactions
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SYSTEM TAB */}
                {activeTab === 'system' && (
                    <div className="space-y-6">
                        {/* Global Notification Section */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border-2 border-[#d93025]/20">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Bell size={18} className="text-[#d93025]"/> Global Notification</h3>
                            <div className="mb-4">
                                <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Message Content</label>
                                <textarea 
                                    value={settings.notificationText} 
                                    onChange={e => setSettings({...settings, notificationText: e.target.value})}
                                    className="w-full bg-gray-50 border rounded-lg p-3 text-sm min-h-[80px]"
                                    placeholder="Use #username, #balance etc."
                                />
                                <div className="mt-2 bg-gray-50 p-2 rounded border text-[9px] text-gray-500 grid grid-cols-3 gap-1">
                                    <span>#username</span>
                                    <span>#userid</span>
                                    <span>#balance</span>
                                    <span>#totaldeposit</span>
                                    <span>#lastdeposit</span>
                                    <span>#winbalance</span>
                                    <span>#referearn</span>
                                    <span>#vip</span>
                                    <span>#bet</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18}/> Transaction Limits</h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase">Min Deposit</label>
                                    <input type="number" value={settings.minDeposit} onChange={e => setSettings({...settings, minDeposit: Number(e.target.value)})} className="w-full bg-gray-50 border rounded-lg p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase">Max Deposit</label>
                                    <input type="number" value={settings.maxDeposit} onChange={e => setSettings({...settings, maxDeposit: Number(e.target.value)})} className="w-full bg-gray-50 border rounded-lg p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase">Min Withdraw</label>
                                    <input type="number" value={settings.minWithdraw} onChange={e => setSettings({...settings, minWithdraw: Number(e.target.value)})} className="w-full bg-gray-50 border rounded-lg p-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase">Max Withdraw</label>
                                    <input type="number" value={settings.maxWithdraw} onChange={e => setSettings({...settings, maxWithdraw: Number(e.target.value)})} className="w-full bg-gray-50 border rounded-lg p-2 text-sm" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ImageIcon size={18}/> Home Banners</h3>
                            <div className="space-y-3 mb-4">
                                <input type="text" value={newBannerUrl} onChange={e => setNewBannerUrl(e.target.value)} placeholder="Image URL" className="w-full bg-gray-50 border rounded-lg p-2 text-xs" />
                                <div className="flex gap-2">
                                    <input type="text" value={newBannerLink} onChange={e => setNewBannerLink(e.target.value)} placeholder="Click URL (Optional)" className="flex-1 bg-gray-50 border rounded-lg p-2 text-xs" />
                                    <button onClick={addBanner} className="bg-blue-600 text-white px-4 rounded-lg text-xs font-bold">Add</button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {settings.homeBanners?.map((banner, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
                                        <img src={banner.imageUrl} className="w-10 h-6 object-cover rounded" alt="bn" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-gray-500 truncate">{banner.imageUrl}</p>
                                            {banner.link && <p className="text-[9px] text-blue-500 flex items-center gap-1 mt-0.5"><LinkIcon size={8}/> {banner.link}</p>}
                                        </div>
                                        <button onClick={() => removeBanner(index)} className="text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><IndianRupee size={18}/> Payment Config</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-gray-500 text-xs font-bold mb-1">Admin UPI ID</label>
                                    <input type="text" value={settings.adminUpiId} onChange={e => setSettings({...settings, adminUpiId: e.target.value})} className="w-full bg-gray-50 border rounded-lg p-3 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-xs font-bold mb-1">UPI QR URL</label>
                                    <input type="text" value={settings.adminQrCodeUrl} onChange={e => setSettings({...settings, adminQrCodeUrl: e.target.value})} className="w-full bg-gray-50 border rounded-lg p-3 text-xs" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-xs font-bold mb-1">USDT Address (TRC20)</label>
                                    <input type="text" value={settings.adminUsdtAddress} onChange={e => setSettings({...settings, adminUsdtAddress: e.target.value})} className="w-full bg-gray-50 border rounded-lg p-3 text-xs" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-xs font-bold mb-1">USDT QR URL</label>
                                    <input type="text" value={settings.adminUsdtQrCodeUrl} onChange={e => setSettings({...settings, adminUsdtQrCodeUrl: e.target.value})} className="w-full bg-gray-50 border rounded-lg p-3 text-xs" />
                                </div>
                            </div>
                        </div>

                        <button onClick={saveSettings} className="w-full bg-black text-white font-bold py-4 rounded-xl shadow-lg">Save System Settings</button>
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                         {/* Promote Admin Section */}
                         <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h2 className="text-gray-800 font-bold mb-4 text-sm flex items-center gap-2"><UserPlus size={16}/> Admin Management</h2>
                            <div className="flex gap-2 mb-4">
                                <input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="User Email to promote" className="flex-1 bg-gray-50 border rounded-lg p-2 text-sm" />
                                <button onClick={handleAddAdmin} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">Promote</button>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Current Admins</p>
                                {adminList.map(adm => (
                                    <div key={adm.uid} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold">{adm.displayName}</span>
                                            <span className="text-[10px] text-gray-400">{adm.email}</span>
                                        </div>
                                        {adm.uid !== currentAdminUid && (
                                            <button onClick={() => handleDemoteAdmin(adm.uid)} className="text-red-500 p-1"><Trash2 size={14}/></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                         {/* Referral Search Section */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h2 className="text-gray-800 font-bold mb-4 text-sm flex items-center gap-2"><Users size={16}/> Referral Lookup</h2>
                            <div className="flex gap-2 mb-2">
                                <input type="text" value={searchRefInput} onChange={e => setSearchRefInput(e.target.value)} placeholder="Referral Code or UID" className="flex-1 bg-gray-50 border rounded-lg p-2 text-sm" />
                                <button onClick={handleReferralSearch} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">Find</button>
                            </div>
                            {searchStatus && <p className="text-[10px] font-bold text-blue-500 mb-2">{searchStatus}</p>}
                            <div className="max-h-40 overflow-y-auto space-y-2 no-scrollbar">
                                {referredUsers.map(u => (
                                    <div key={u.uid} className="bg-gray-50 p-2 rounded-lg border text-[10px] flex justify-between">
                                        <span>{u.displayName} ({u.email})</span>
                                        <span className="font-bold">Bal: ₹{u.balance.toFixed(0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Promo Code Generation */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h2 className="text-gray-800 font-bold mb-4 text-sm flex items-center gap-2"><Gift size={16}/> Generate Gift Code</h2>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="CODE" className="bg-gray-50 border rounded p-2 text-xs font-bold" />
                                <input type="number" value={promoAmount} onChange={e => setPromoAmount(Number(e.target.value))} placeholder="₹ Amount" className="bg-gray-50 border rounded p-2 text-xs" />
                                <input type="number" value={promoUsers} onChange={e => setPromoUsers(Number(e.target.value))} placeholder="Max Uses" className="bg-gray-50 border rounded p-2 text-xs" />
                                <input type="number" value={promoDays} onChange={e => setPromoDays(Number(e.target.value))} placeholder="Days Valid" className="bg-gray-50 border rounded p-2 text-xs" />
                            </div>
                            <div className="mb-3">
                                <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">Min Required Cum. Deposit (₹)</label>
                                <input type="number" value={promoRequiredDepositAmount} onChange={e => setPromoRequiredDepositAmount(e.target.value)} placeholder="0 for none" className="w-full bg-gray-50 border rounded p-2 text-xs" />
                            </div>
                            <div className="mb-3">
                                <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">Redemption Message (Supports Commands)</label>
                                <textarea 
                                    value={promoMsg} 
                                    onChange={e => setPromoMsg(e.target.value)} 
                                    className="w-full bg-gray-50 border rounded p-2 text-xs min-h-[60px]"
                                    placeholder="Use #username, #balance etc."
                                />
                            </div>
                            <button onClick={handleCreatePromo} className="w-full bg-yellow-500 text-white font-bold py-2 rounded-lg text-sm">Generate Code</button>
                        </div>

                        {/* General User Search */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h2 className="text-gray-800 font-bold mb-4 text-sm flex items-center gap-2"><Users size={16}/> User Lookup</h2>
                            <div className="flex gap-2 mb-4">
                                <input type="text" value={userDetailsInput} onChange={e => setUserDetailsInput(e.target.value)} placeholder="Numeric ID or Email" className="flex-1 bg-gray-50 border rounded-lg p-2 text-sm" />
                                <button onClick={handleUserSearch} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">Search</button>
                            </div>
                            {searchedUser && (
                                <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                                    <p className="font-bold">{searchedUser.displayName} <span className="text-xs font-normal text-gray-500">({searchedUser.numericId})</span></p>
                                    <p className="text-xs text-green-600 font-black">Bal: ₹{searchedUser.balance.toFixed(2)}</p>
                                    <p className="text-[10px] text-gray-400">Total Deposited: ₹{searchedUser.totalDeposited || 0}</p>
                                    <p className="text-[10px] text-gray-400">Total Wagered: ₹{searchedUser.totalWagered || 0}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* GAMES TAB */}
                {activeTab === 'wingo' && (
                     <div className="bg-white p-6 rounded-xl shadow-sm">
                        <h2 className="text-gray-800 font-bold mb-4 text-lg flex items-center gap-2">🎲 Wingo Control</h2>
                        <div className="bg-blue-50 p-4 rounded-xl border mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-blue-600 font-bold uppercase">Status</span>
                                {currentWingoForced !== null ? <span className="text-red-500 font-bold text-sm bg-white px-2 py-1 rounded shadow-sm">Forced: {currentWingoForced}</span> : <span className="text-green-600 font-bold text-sm bg-white px-2 py-1 rounded shadow-sm">Automatic</span>}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <input type="number" max={9} min={0} value={wingoResultInput} onChange={e => setWingoResultInput(e.target.value === '' ? '' : Number(e.target.value))} placeholder="#" className="w-20 bg-gray-50 border rounded-xl text-center font-black text-xl" />
                            <button onClick={() => handleWingoControl(false)} className="flex-1 bg-blue-600 text-white font-bold rounded-xl text-sm shadow">Set Result</button>
                            <button onClick={() => handleWingoControl(true)} className="px-4 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm">Reset</button>
                        </div>
                    </div>
                )}
            </div>

            {successMessage && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 animate-slide-up">
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="font-bold text-sm">{successMessage}</span>
                </div>
            )}
        </div>
    );
};
