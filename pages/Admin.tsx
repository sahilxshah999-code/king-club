import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { Transaction, SystemSettings, UserProfile } from '../types';
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
    LayoutDashboard, Database, Bitcoin, CreditCard, ExternalLink 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Type Definitions
type AdminTab = 'finance' | 'system' | 'users' | 'wingo';

// Helper function moved outside component to prevent linting errors
function snapshotToArray<T>(snapshot: any): T[] {
    const val = snapshot.val();
    if (!val) return [];
    // Cast to T[] to satisfy TypeScript compiler
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
        minWithdraw: 100
    });
    
    // Config strings for editing
    const [spinPrizesStr, setSpinPrizesStr] = useState('');
    const [vipThresholdsStr, setVipThresholdsStr] = useState('');
    const [vipDailyStr, setVipDailyStr] = useState('');
    const [vipLevelUpStr, setVipLevelUpStr] = useState('');
    const [newBannerUrl, setNewBannerUrl] = useState('');

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
            // Sort by timestamp desc
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
            if (tx.type === 'deposit') {
                await approveDeposit(tx.uid, tx.amount);
            } else if (tx.type === 'withdraw') {
                await approveWithdrawal(tx.uid, tx.amount);
            }
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
        const updatedBanners = [...(settings.homeBanners || []), newBannerUrl.trim()];
        setSettings({...settings, homeBanners: updatedBanners});
        setNewBannerUrl('');
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
            if (resolvedUid) {
                targetUid = resolvedUid;
            } else {
                setSearchStatus('Invalid Referral Code');
                return;
            }
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
        await createPromoCode(promoCode, Number(promoAmount), Number(promoUsers), Number(promoDays), promoMsg, promoRequiresDeposit);
        showSuccess("Promo Code Created Successfully!");
        setPromoCode('');
        setPromoAmount('');
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim()) {
            alert("Enter user email");
            return;
        }
        const user = await findUserByEmail(newAdminEmail);
        if (!user) {
            alert("User not found. Ensure they have registered.");
            return;
        }
        if (user.role === 'admin') {
            alert("User is already an admin.");
            return;
        }
        
        if(window.confirm(`Promote ${user.displayName} (${user.email}) to Admin?`)) {
            await updateUserRole(user.uid, 'admin');
            showSuccess("User promoted to Admin");
            setNewAdminEmail('');
            loadAdmins();
        }
    };

    const handleDemoteAdmin = async (uid: string) => {
        if (uid === currentAdminUid) {
            alert("You cannot demote yourself.");
            return;
        }
        if(window.confirm("Are you sure you want to remove Admin rights from this user?")) {
            await updateUserRole(uid, 'user');
            loadAdmins();
        }
    };

    const handleDeleteAdmin = async (uid: string) => {
         if (uid === currentAdminUid) {
            alert("You cannot delete yourself.");
            return;
        }
        if(window.confirm("WARNING: This will delete the user account from the database. This action is irreversible. Continue?")) {
            await deleteUserAccount(uid);
            loadAdmins();
        }
    };

    const handleUserSearch = async () => {
        if(!userDetailsInput.trim()) return;
        setSearchLoading(true);
        setSearchedUser(null);
        
        const input = userDetailsInput.trim();
        let user = await findUserByNumericId(input);
        
        if (!user) {
            user = await findUserByEmail(input);
        }
        if (!user) {
            // Try as raw UID
            user = await getUserProfile(input);
        }
        
        setSearchedUser(user);
        if(!user) showSuccess("User not found");
        setSearchLoading(false);
    };

    if(!isAdmin) return <div className="p-10 text-center text-red-500 font-bold">Access Denied</div>;

    const navItemClass = (tab: AdminTab) => 
        `flex-1 py-3 text-xs font-bold uppercase tracking-wide flex flex-col items-center gap-1 ${activeTab === tab ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:bg-gray-50'}`;

    return (
        <div className="bg-[#f0f2f5] pb-24 relative min-h-full">
             {/* Admin Header */}
             <div className="bg-black text-white p-4 shadow-lg sticky top-0 z-50">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => navigate('/profile')} className="p-1 hover:bg-white/20 rounded-full"><ChevronLeft /></button>
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        <Shield size={18} fill="white" className="text-blue-500" /> Admin Console
                    </h1>
                    <div className="w-6"></div>
                </div>

                {/* Nav Bar */}
                <div className="flex bg-white rounded-lg overflow-hidden shadow-sm">
                    <button onClick={() => setActiveTab('finance')} className={navItemClass('finance')}>
                        <IndianRupee size={16} /> Finance
                    </button>
                    <button onClick={() => setActiveTab('system')} className={navItemClass('system')}>
                        <Settings size={16} /> System
                    </button>
                    <button onClick={() => setActiveTab('users')} className={navItemClass('users')}>
                        <Users size={16} /> Users
                    </button>
                    <button onClick={() => setActiveTab('wingo')} className={navItemClass('wingo')}>
                        <LayoutDashboard size={16} /> Games
                    </button>
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
                                    <div className="text-xs text-gray-500 mb-1">Method: {tx.method}</div>
                                    <div className="text-xs text-gray-400 mb-3 font-mono break-all bg-gray-50 p-2 rounded">
                                        {tx.details}
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <button onClick={() => handleAction(tx, 'approved')} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-green-600">Approve</button>
                                        <button onClick={() => handleAction(tx, 'rejected')} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-red-600">Reject</button>
                                    </div>
                                </div>
                            ))}
                            {transactions.filter(t => t.status === 'pending').length === 0 && (
                                <div className="bg-white p-10 rounded-xl text-center text-gray-400 text-sm border border-dashed border-gray-200">
                                    <CheckCircle className="mx-auto mb-2 opacity-50" size={32} />
                                    No pending transactions
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SYSTEM TAB */}
                {activeTab === 'system' && (
                    <div className="space-y-6">
                         {/* Payment Limits Config */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18}/> Payment Limits</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-500 text-xs font-bold mb-1">Min Deposit (₹)</label>
                                    <input 
                                        type="number" 
                                        value={settings.minDeposit} 
                                        onChange={e => setSettings({...settings, minDeposit: Number(e.target.value)})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black font-mono text-sm"
                                        placeholder="100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-xs font-bold mb-1">Min Withdrawal (₹)</label>
                                    <input 
                                        type="number" 
                                        value={settings.minWithdraw} 
                                        onChange={e => setSettings({...settings, minWithdraw: Number(e.target.value)})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black font-mono text-sm"
                                        placeholder="100"
                                    />
                                </div>
                            </div>
                        </div>

                         {/* Payment Config - UPI */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><IndianRupee size={18}/> UPI Payment</h3>
                            
                            <div className="mb-4">
                                <label className="block text-gray-500 text-xs font-bold mb-1">Admin UPI ID</label>
                                <input 
                                    type="text" 
                                    value={settings.adminUpiId} 
                                    onChange={e => setSettings({...settings, adminUpiId: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black font-mono text-sm"
                                    placeholder="example@upi"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-500 text-xs font-bold mb-1">UPI QR Code Image URL</label>
                                <input 
                                    type="text" 
                                    value={settings.adminQrCodeUrl} 
                                    onChange={e => setSettings({...settings, adminQrCodeUrl: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black text-xs"
                                    placeholder="https://..."
                                />
                                {settings.adminQrCodeUrl && (
                                    <img src={settings.adminQrCodeUrl} alt="Preview" className="w-20 h-20 object-contain mt-2 border rounded" />
                                )}
                            </div>
                        </div>

                         {/* Payment Config - USDT */}
                         <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Bitcoin size={18}/> USDT (TRC20) Payment</h3>
                            
                            <div className="mb-4">
                                <label className="block text-gray-500 text-xs font-bold mb-1">Admin USDT Address (TRC20)</label>
                                <input 
                                    type="text" 
                                    value={settings.adminUsdtAddress} 
                                    onChange={e => setSettings({...settings, adminUsdtAddress: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black font-mono text-xs"
                                    placeholder="T..."
                                />
                            </div>

                            <div>
                                <label className="block text-gray-500 text-xs font-bold mb-1">USDT QR Code Image URL</label>
                                <input 
                                    type="text" 
                                    value={settings.adminUsdtQrCodeUrl} 
                                    onChange={e => setSettings({...settings, adminUsdtQrCodeUrl: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black text-xs"
                                    placeholder="https://..."
                                />
                                {settings.adminUsdtQrCodeUrl && (
                                    <img src={settings.adminUsdtQrCodeUrl} alt="Preview" className="w-20 h-20 object-contain mt-2 border rounded" />
                                )}
                            </div>
                        </div>

                         {/* Support Links Config */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Settings size={18}/> Support Links</h3>
                            
                            <div className="mb-4">
                                <label className="block text-gray-500 text-xs font-bold mb-1">Customer Service URL</label>
                                <input 
                                    type="text" 
                                    value={settings.customerServiceUrl || ''} 
                                    onChange={e => setSettings({...settings, customerServiceUrl: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black text-sm"
                                    placeholder="https://t.me/..."
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-500 text-xs font-bold mb-1">Forgot Password URL</label>
                                <input 
                                    type="text" 
                                    value={settings.forgotPasswordUrl || ''} 
                                    onChange={e => setSettings({...settings, forgotPasswordUrl: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black text-sm"
                                    placeholder="https://..."
                                />
                            </div>

                             <div>
                                <label className="block text-gray-500 text-xs font-bold mb-1">Privacy Policy URL</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={settings.privacyPolicyUrl || ''} 
                                        onChange={e => setSettings({...settings, privacyPolicyUrl: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-black text-sm"
                                        placeholder="https://..."
                                    />
                                    {settings.privacyPolicyUrl && (
                                        <a 
                                            href={settings.privacyPolicyUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="px-4 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200"
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Banner Config */}
                         <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ImageIcon size={18}/> Home Banners</h3>
                            
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    value={newBannerUrl} 
                                    onChange={e => setNewBannerUrl(e.target.value)}
                                    placeholder="Image URL"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs"
                                />
                                <button onClick={addBanner} className="bg-blue-600 text-white px-3 rounded-lg text-xs font-bold">Add</button>
                            </div>

                            <div className="space-y-2">
                                {settings.homeBanners?.map((url, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <img src={url} className="w-10 h-6 object-cover rounded" alt="bn" />
                                        <p className="flex-1 text-[10px] text-gray-500 truncate">{url}</p>
                                        <button onClick={() => removeBanner(index)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {(!settings.homeBanners || settings.homeBanners.length === 0) && <p className="text-xs text-gray-400 italic">No banners set</p>}
                            </div>
                        </div>

                        {/* System Settings */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Database size={18}/> Game Variables</h3>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-gray-500 text-xs font-bold mb-1">Signup Referral Bonus (₹)</label>
                                    <input 
                                        type="number" 
                                        value={settings.referralBonus} 
                                        onChange={e => setSettings({...settings, referralBonus: Number(e.target.value)})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-black text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-xs font-bold mb-1">Referral Deposit Commission (%)</label>
                                    <input 
                                        type="number" 
                                        value={settings.referralDepositBonusPercent} 
                                        onChange={e => setSettings({...settings, referralDepositBonusPercent: Number(e.target.value)})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-black text-sm"
                                        placeholder="e.g. 5"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Earned by referrer when user deposits.</p>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-gray-500 text-xs font-bold mb-1">User Deposit Bonus (%)</label>
                                    <input 
                                        type="number" 
                                        value={settings.depositBonusPercent} 
                                        onChange={e => setSettings({...settings, depositBonusPercent: Number(e.target.value)})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-black text-sm"
                                        placeholder="e.g. 2"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Extra bonus added to user wallet upon approval.</p>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-500 text-xs font-bold mb-1">Spin Prizes (csv)</label>
                                <textarea 
                                    value={spinPrizesStr}
                                    onChange={e => setSpinPrizesStr(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-black text-xs h-16"
                                />
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-800 mt-4">VIP Configuration</h3>
                                <div className="mb-2">
                                    <label className="block text-gray-500 text-xs font-bold mb-1">VIP Thresholds (Wager Amount)</label>
                                    <textarea value={vipThresholdsStr} onChange={e => setVipThresholdsStr(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-black text-xs h-12" />
                                </div>
                                <div className="mb-2">
                                    <label className="block text-gray-500 text-xs font-bold mb-1">VIP Daily Rewards</label>
                                    <textarea value={vipDailyStr} onChange={e => setVipDailyStr(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-black text-xs h-12" />
                                </div>
                                <div className="mb-2">
                                    <label className="block text-gray-500 text-xs font-bold mb-1">VIP Level-Up Rewards</label>
                                    <textarea value={vipLevelUpStr} onChange={e => setVipLevelUpStr(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-black text-xs h-12" />
                                </div>
                            </div>
                        </div>

                        <button onClick={saveSettings} className="w-full bg-black text-white font-bold py-4 rounded-xl shadow-lg hover:bg-gray-900 transition">
                            Save All Configurations
                        </button>
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div className="space-y-6">

                        {/* User Details Search */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h2 className="text-gray-800 font-bold mb-4 text-sm flex items-center gap-2">
                                <Users size={16} className="text-blue-500"/> User Details Search
                            </h2>
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    value={userDetailsInput} 
                                    onChange={e => setUserDetailsInput(e.target.value)} 
                                    placeholder="Enter User ID (e.g. 123456) or Email"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm"
                                />
                                <button onClick={handleUserSearch} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">
                                    {searchLoading ? '...' : 'Search'}
                                </button>
                            </div>

                            {searchedUser && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                                    <div className="flex justify-between items-start border-b border-gray-200 pb-2">
                                        <div>
                                            <h3 className="font-bold text-lg">{searchedUser.displayName}</h3>
                                            <p className="text-xs text-gray-500 font-mono">{searchedUser.email}</p>
                                            <p className="text-[10px] text-gray-400 font-mono break-all">UID: {searchedUser.uid}</p>
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                                                ID: {searchedUser.numericId}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Role</p>
                                            <p className="font-bold capitalize">{searchedUser.role}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-3 rounded-lg shadow-sm">
                                            <p className="text-xs text-gray-400 font-bold uppercase">Total Balance</p>
                                            <p className="text-xl font-black text-green-600">₹{searchedUser.balance.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg shadow-sm">
                                            <p className="text-xs text-gray-400 font-bold uppercase">Winning Bal</p>
                                            <p className="text-lg font-bold">₹{(searchedUser.winningBalance || 0).toFixed(2)}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg shadow-sm">
                                            <p className="text-xs text-gray-400 font-bold uppercase">Deposit Bal</p>
                                            <p className="text-lg font-bold">₹{(searchedUser.totalDeposited || 0).toFixed(2)}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg shadow-sm">
                                            <p className="text-xs text-gray-400 font-bold uppercase">Bonus Bal</p>
                                            <p className="text-lg font-bold">₹{(searchedUser.bonusBalance || 0).toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-400">VIP Level</p>
                                            <p className="font-bold">{searchedUser.vipLevel}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-400">Wagered</p>
                                            <p className="font-bold">₹{(searchedUser.totalWagered || 0).toFixed(0)}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-400">Deposited</p>
                                            <p className="font-bold">₹{(searchedUser.totalDeposited || 0).toFixed(0)}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-400">Ref Code</p>
                                            <p className="font-bold">{searchedUser.referralCode}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-400">Ref Count</p>
                                            <p className="font-bold">{searchedUser.referralCount || 0}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-400">Ref Earn</p>
                                            <p className="font-bold">₹{(searchedUser.referralEarnings || 0).toFixed(0)}</p>
                                        </div>
                                    </div>
                                    
                                    {searchedUser.referredBy && (
                                        <p className="text-xs text-gray-400 text-center">Referred By: {searchedUser.referredBy}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Admin List */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h2 className="text-gray-800 font-bold mb-4 text-sm flex items-center gap-2">
                                <Shield size={16} className="text-blue-500"/> Manage Admins
                            </h2>

                            <div className="mb-4 flex gap-2">
                                <input 
                                    type="email" 
                                    value={newAdminEmail}
                                    onChange={(e) => setNewAdminEmail(e.target.value)}
                                    placeholder="User Email"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm"
                                />
                                <button onClick={handleAddAdmin} className="bg-blue-600 text-white font-bold px-4 rounded-lg text-sm shadow-md">Promote</button>
                            </div>

                            <div className="space-y-2">
                                {adminList.map(admin => (
                                    <div key={admin.uid} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">{admin.displayName} {admin.uid === currentAdminUid && '(You)'}</p>
                                            <p className="text-[10px] text-gray-400">{admin.email}</p>
                                        </div>
                                        {admin.uid !== currentAdminUid && (
                                            <div className="flex gap-1">
                                                <button onClick={() => handleDemoteAdmin(admin.uid)} className="p-1.5 bg-yellow-100 text-yellow-700 rounded"><ArrowDownCircle size={14} /></button>
                                                <button onClick={() => handleDeleteAdmin(admin.uid)} className="p-1.5 bg-red-100 text-red-700 rounded"><Trash2 size={14} /></button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Referral Lookup */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h2 className="text-gray-800 font-bold mb-4 text-sm">Referral Tree Lookup</h2>
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    value={searchRefInput} 
                                    onChange={e => setSearchRefInput(e.target.value)} 
                                    placeholder="Code or UID"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2 text-black text-sm"
                                />
                                <button onClick={handleReferralSearch} className="bg-gray-800 text-white px-4 rounded-lg font-bold text-sm">Search</button>
                            </div>
                            {searchStatus && <p className="text-xs text-gray-400 mb-2 italic">{searchStatus}</p>}
                            
                            {referredUsers.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-2">
                                    <table className="w-full text-left text-xs">
                                        <thead className="text-gray-500 border-b">
                                            <tr><th className="p-1">Name</th><th className="p-1 text-right">Bonus</th></tr>
                                        </thead>
                                        <tbody>
                                            {referredUsers.map(user => (
                                                <tr key={user.uid}>
                                                    <td className="p-1 font-bold">{user.displayName}</td>
                                                    <td className="p-1 text-right text-green-600">₹{settings.referralBonus}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Gift Code */}
                        <div className="bg-white p-5 rounded-xl shadow-sm">
                            <h2 className="text-gray-800 font-bold mb-4 text-sm flex items-center gap-2"><Gift size={16} className="text-yellow-500"/> Generate Gift Code</h2>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="CODE" className="bg-gray-50 border rounded p-2 text-xs font-bold" />
                                <input type="number" value={promoAmount} onChange={e => setPromoAmount(Number(e.target.value))} placeholder="Amount" className="bg-gray-50 border rounded p-2 text-xs" />
                                <input type="number" value={promoUsers} onChange={e => setPromoUsers(Number(e.target.value))} placeholder="Max Users" className="bg-gray-50 border rounded p-2 text-xs" />
                                <input type="number" value={promoDays} onChange={e => setPromoDays(Number(e.target.value))} placeholder="Days Valid" className="bg-gray-50 border rounded p-2 text-xs" />
                            </div>
                            <div className="mb-3">
                                <input type="text" value={promoMsg} onChange={e => setPromoMsg(e.target.value)} className="w-full bg-gray-50 border rounded p-2 text-xs" />
                            </div>
                            <div className="mb-3 flex items-center gap-2">
                                <div onClick={() => setPromoRequiresDeposit(!promoRequiresDeposit)} className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${promoRequiresDeposit ? 'bg-black border-black' : 'bg-gray-100'}`}>
                                     {promoRequiresDeposit && <CheckCircle size={10} className="text-white" />}
                                </div>
                                <span className="text-xs text-gray-500">Depositors Only</span>
                            </div>
                            <button onClick={handleCreatePromo} className="w-full bg-yellow-500 text-white font-bold py-2 rounded-lg text-sm shadow">Generate</button>
                        </div>
                    </div>
                )}

                {/* GAMES TAB */}
                {activeTab === 'wingo' && (
                     <div className="bg-white p-6 rounded-xl shadow-sm">
                        <h2 className="text-gray-800 font-bold mb-4 text-lg border-b pb-2 flex items-center gap-2">
                            <span>🎲</span> Wingo Result Control
                        </h2>
                        
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">Current Status</span>
                                {currentWingoForced !== null ? (
                                    <span className="flex items-center gap-1 text-red-500 font-bold text-sm bg-white px-2 py-1 rounded shadow-sm">
                                        <CheckCircle size={14} /> Forced: {currentWingoForced}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-green-600 font-bold text-sm bg-white px-2 py-1 rounded shadow-sm">
                                        <RefreshCcw size={14} /> Automatic (Profit)
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-blue-400">
                                Automatic mode selects the result that minimizes house payout. Forced mode overrides this for the next round.
                            </p>
                        </div>

                        <div className="flex gap-3 items-stretch">
                            <div className="relative">
                                <input 
                                    type="number" 
                                    max={9} min={0}
                                    value={wingoResultInput} 
                                    onChange={e => setWingoResultInput(e.target.value === '' ? '' : Number(e.target.value))} 
                                    placeholder="#"
                                    className="w-20 h-full bg-gray-50 border border-gray-200 rounded-xl text-center font-black text-xl outline-none focus:border-blue-500 transition"
                                />
                            </div>
                            <button 
                                onClick={() => handleWingoControl(false)} 
                                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/30 active:scale-95 transition"
                            >
                                Set Result
                            </button>
                            <button 
                                onClick={() => handleWingoControl(true)} 
                                className="px-4 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-200 transition active:scale-95 border border-gray-200"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Success Toast */}
            {successMessage && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 animate-slide-up border border-white/10">
                    <div className="bg-green-500 rounded-full p-1 text-black">
                        <CheckCircle size={16} />
                    </div>
                    <span className="font-bold text-sm tracking-wide">{successMessage}</span>
                </div>
            )}
        </div>
    );
};
