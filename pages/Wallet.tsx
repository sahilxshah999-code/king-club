import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { createTransaction, getUserProfile, getSystemSettings } from '../services/userService';
import { UserProfile, SystemSettings } from '../types';
import { ref, onValue } from 'firebase/database';
import { ChevronLeft, History, CreditCard, Bitcoin, Copy, CheckCircle, Wallet as WalletIcon, Trophy, Gift } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Toast } from '../components/Toast';

export const Wallet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [method, setMethod] = useState<'UPI' | 'USDT'>('UPI');
  
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState(''); // UTR or TxHash or UPI ID or Wallet Addr
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
      // Check for navigation state (e.g. clicked Withdraw on Home)
      if (location.state && (location.state as any).tab) {
          setActiveTab((location.state as any).tab);
      }
  }, [location]);

  useEffect(() => {
    const load = async () => {
        const s = await getSystemSettings();
        setSettings(s);
    };
    load();

    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(await getUserProfile(u.uid));
        // Listen to transaction history
        const txRef = ref(db, 'transactions');
        onValue(txRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const myTx = Object.values(data)
                    .filter((t: any) => t.uid === u.uid)
                    .sort((a: any, b: any) => b.timestamp - a.timestamp);
                setHistoryList(myTx);
            }
        });
        
        // Listen to live balance updates
        const userRef = ref(db, `users/${u.uid}`);
        onValue(userRef, (snapshot) => {
            if(snapshot.exists()) {
                setUser(snapshot.val());
            }
        });
      }
    });
    return () => unsub();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      showToast("Copied to clipboard!", 'success');
  };

  const handleSubmit = async () => {
    if (!user || !amount) {
        showToast("Please enter an amount", 'error');
        return;
    }
    const val = parseFloat(amount);
    
    if (isNaN(val) || val <= 0) {
        showToast("Invalid amount", 'error');
        return;
    }

    if (activeTab === 'deposit') {
        if (settings?.minDeposit && val < settings.minDeposit) {
            showToast(`Minimum deposit is ₹${settings.minDeposit}`, 'error');
            return;
        }
        if (settings?.maxDeposit && val > settings.maxDeposit) {
            showToast(`Maximum deposit is ₹${settings.maxDeposit}`, 'error');
            return;
        }
    }

    if (activeTab === 'withdraw') {
        if (settings?.minWithdraw && val < settings.minWithdraw) {
            showToast(`Minimum withdrawal is ₹${settings.minWithdraw}`, 'error');
            return;
        }
        if (settings?.maxWithdraw && val > settings.maxWithdraw) {
            showToast(`Maximum withdrawal is ₹${settings.maxWithdraw}`, 'error');
            return;
        }

        // Enforce restriction: Only withdraw winning balance
        if (val > (user.winningBalance || 0)) {
            showToast(`Insufficient Winning Balance. Max: ₹${(user.winningBalance || 0).toFixed(2)}`, 'error');
            return;
        }
        
        if (val > user.balance) {
             showToast("Insufficient total balance", 'error');
             return;
        }
    }

    if (!details.trim()) {
        const msg = activeTab === 'deposit' 
            ? "Please enter the Transaction Reference/Hash" 
            : method === 'UPI' ? "Please enter your UPI ID" : "Please enter your Wallet Address";
        showToast(msg, 'error');
        return;
    }

    let detailsString = "";
    if (activeTab === 'deposit') {
        detailsString = method === 'UPI' ? `UTR: ${details}` : `TxHash: ${details}`;
    } else {
        detailsString = method === 'UPI' ? `UPI: ${details}` : `Address: ${details}`;
    }

    try {
        await createTransaction({
            uid: user.uid,
            type: activeTab,
            amount: val,
            method: method,
            details: detailsString
        });
        
        showToast(`${activeTab === 'deposit' ? 'Deposit request sent! Admin approval required.' : 'Withdrawal request sent!'}`, 'success');
        setAmount('');
        setDetails('');
    } catch (err: any) {
        showToast(err.message, 'error');
    }
  };

  if (!settings) return <div className="p-10 text-center">Loading Wallet...</div>;

  return (
    <div className="min-h-screen bg-[#f7f8ff] flex flex-col">
        {/* Header */}
        <div className="bg-[#d93025] p-4 text-white pb-10 rounded-b-[2rem] shadow-lg relative shrink-0 z-0">
             <div className="flex justify-between items-center mb-2">
                <button onClick={() => navigate('/')} className="p-1 hover:bg-white/10 rounded-full transition"><ChevronLeft /></button>
                <h1 className="text-xl font-bold">Wallet</h1>
                <div className="w-6"></div> 
            </div>
            
            <div className="text-center">
                <p className="text-white/80 text-sm mb-1 font-medium">Total Balance</p>
                <h1 className="text-3xl font-black tracking-tight">₹{(user?.balance || 0).toFixed(2)}</h1>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="px-4 -mt-8 flex-1 flex flex-col pb-24 relative z-10">
            
            {/* Balance Breakdown Cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                 <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                     <div className="bg-blue-100 p-2 rounded-full mb-1">
                        <WalletIcon size={16} className="text-blue-600" />
                     </div>
                     <span className="text-[10px] text-gray-500 font-bold uppercase">Deposit</span>
                     <span className="font-black text-gray-800 text-sm">₹{(user?.depositBalance || 0).toFixed(0)}</span>
                 </div>
                 <div className="bg-white p-3 rounded-xl shadow-sm border-2 border-green-100 flex flex-col items-center text-center relative overflow-hidden">
                     <div className="absolute top-0 right-0 bg-green-500 text-white text-[8px] font-bold px-1.5 rounded-bl">WITHDRAW</div>
                     <div className="bg-green-100 p-2 rounded-full mb-1">
                        <Trophy size={16} className="text-green-600" />
                     </div>
                     <span className="text-[10px] text-gray-500 font-bold uppercase">Winning</span>
                     <span className="font-black text-green-600 text-sm">₹{(user?.winningBalance || 0).toFixed(0)}</span>
                 </div>
                 <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                     <div className="bg-yellow-100 p-2 rounded-full mb-1">
                        <Gift size={16} className="text-yellow-600" />
                     </div>
                     <span className="text-[10px] text-gray-500 font-bold uppercase">Bonus</span>
                     <span className="font-black text-gray-800 text-sm">₹{(user?.bonusBalance || 0).toFixed(0)}</span>
                 </div>
            </div>

            {/* Action Tabs (Deposit/Withdraw) */}
            <div className="bg-white rounded-2xl shadow-md p-1.5 flex mb-4">
                <button 
                    onClick={() => { setActiveTab('deposit'); setDetails(''); }} 
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${activeTab === 'deposit' ? 'bg-gradient-to-r from-[#d93025] to-red-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    Deposit
                </button>
                <button 
                    onClick={() => { setActiveTab('withdraw'); setDetails(''); }} 
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${activeTab === 'withdraw' ? 'bg-gradient-to-r from-[#d93025] to-red-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    Withdraw
                </button>
            </div>

            {/* Input Card */}
            <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">
                
                {/* Method Selector (UPI/USDT) */}
                <div className="flex gap-3 mb-6">
                    <button 
                        onClick={() => setMethod('UPI')}
                        className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${method === 'UPI' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                    >
                        <CreditCard size={24} />
                        <span className="text-xs font-bold">UPI / Bank</span>
                    </button>
                    <button 
                        onClick={() => setMethod('USDT')}
                        className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${method === 'USDT' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                    >
                        <Bitcoin size={24} />
                        <span className="text-xs font-bold">USDT (TRC20)</span>
                    </button>
                </div>

                {/* Amount Input */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-gray-500 font-bold text-xs uppercase tracking-wide">Amount (₹)</label>
                        {activeTab === 'withdraw' && (
                            <span className="text-xs text-green-600 font-bold">Max: ₹{(user?.winningBalance || 0).toFixed(0)}</span>
                        )}
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center focus-within:border-gray-300 transition">
                        <span className="text-gray-400 font-bold mr-2">₹</span>
                        <input 
                            type="number" 
                            value={amount} 
                            onChange={(e) => setAmount(e.target.value)} 
                            className="w-full bg-transparent outline-none text-black font-bold text-lg placeholder-gray-300" 
                            placeholder={activeTab === 'deposit' ? `${settings.minDeposit}` : `${settings.minWithdraw}`} 
                        />
                    </div>
                    <div className="flex justify-between mt-1 px-1 text-[10px] font-bold text-gray-400">
                        <span>Min: ₹{activeTab === 'deposit' ? settings.minDeposit : settings.minWithdraw}</span>
                        <span>Max: ₹{activeTab === 'deposit' ? settings.maxDeposit : settings.maxWithdraw}</span>
                    </div>
                </div>

                {/* Dynamic Content Based on Tab & Method */}
                <div className="mb-6">
                    {/* DEPOSIT VIEW */}
                    {activeTab === 'deposit' && (
                        <>
                            <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center">
                                <p className="text-xs text-gray-500 font-medium mb-2">
                                    {method === 'UPI' ? 'Scan to Pay' : 'Scan USDT (TRC20)'}
                                </p>
                                
                                {method === 'UPI' && settings.adminQrCodeUrl && (
                                    <div className="flex justify-center mb-3">
                                         <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                                            <img 
                                                src={settings.adminQrCodeUrl} 
                                                alt="Payment QR" 
                                                className="w-32 h-32 object-contain" 
                                            />
                                         </div>
                                    </div>
                                )}

                                {method === 'USDT' && settings.adminUsdtQrCodeUrl && (
                                    <div className="flex justify-center mb-3">
                                         <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                                            <img 
                                                src={settings.adminUsdtQrCodeUrl} 
                                                alt="USDT QR" 
                                                className="w-32 h-32 object-contain" 
                                            />
                                         </div>
                                    </div>
                                )}

                                {method === 'UPI' && (
                                    <div className="flex flex-col items-center">
                                        <p className="text-xs font-bold text-gray-700 mb-1">UPI ID</p>
                                        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border border-gray-200">
                                            <span className="text-sm font-mono select-all">{settings.adminUpiId}</span>
                                            <button onClick={() => copyToClipboard(settings.adminUpiId)}><Copy size={14} className="text-gray-400 hover:text-black"/></button>
                                        </div>
                                    </div>
                                )}

                                {method === 'USDT' && (
                                     <div className="flex flex-col items-center">
                                        <p className="text-xs font-bold text-gray-700 mb-1">USDT (TRC20) Address</p>
                                        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border border-gray-200 max-w-full overflow-hidden">
                                            <span className="text-xs font-mono select-all truncate">{settings.adminUsdtAddress || 'Address not set'}</span>
                                            <button onClick={() => copyToClipboard(settings.adminUsdtAddress)}><Copy size={14} className="text-gray-400 hover:text-black"/></button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <label className="block text-gray-500 font-bold text-xs mb-2 uppercase tracking-wide">
                                {method === 'UPI' ? 'UTR / Reference Number' : 'Transaction Hash (TxID)'}
                            </label>
                            <input 
                                type="text" 
                                value={details} 
                                onChange={(e) => setDetails(e.target.value)} 
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-black outline-none focus:border-red-200 transition text-sm" 
                                placeholder={method === 'UPI' ? '12 digit UTR' : 'Paste transaction hash'} 
                            />
                        </>
                    )}

                    {/* WITHDRAW VIEW */}
                    {activeTab === 'withdraw' && (
                        <>
                            <label className="block text-gray-500 font-bold text-xs mb-2 uppercase tracking-wide">
                                {method === 'UPI' ? 'Your UPI ID' : 'Your USDT (TRC20) Address'}
                            </label>
                            <input 
                                type="text" 
                                value={details} 
                                onChange={(e) => setDetails(e.target.value)} 
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-black outline-none focus:border-red-200 transition text-sm" 
                                placeholder={method === 'UPI' ? 'example@upi' : 'T...'} 
                            />
                            <p className="text-[10px] text-gray-400 mt-2">
                                {method === 'USDT' ? '*Ensure the address is on the TRC20 network. Wrong network transfers are lost.' : '*Verify your UPI ID before submitting.'}
                            </p>
                        </>
                    )}
                </div>
                
                <button onClick={handleSubmit} className="w-full bg-gradient-to-r from-[#d93025] to-red-600 text-white font-bold py-4 rounded-full shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition transform active:scale-95">
                    {activeTab === 'deposit' ? 'Confirm Deposit' : 'Request Withdrawal'}
                </button>
            </div>

            {/* History List */}
            <div className="flex-1">
                <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
                    <History size={20} className="text-[#d93025]" /> Transaction History
                </h3>
                <div className="space-y-3">
                    {historyList.map((tx) => (
                        <div key={tx.id} className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border border-gray-50">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold capitalize text-gray-800">{tx.type}</p>
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{tx.method || 'UPI'}</span>
                                </div>
                                <p className="text-xs text-gray-400">{new Date(tx.timestamp).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-500'}`}>
                                    {tx.type === 'deposit' ? '+' : '-'}₹{tx.amount}
                                </p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${tx.status === 'approved' || tx.status === 'completed' ? 'bg-green-100 text-green-700' : tx.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {tx.status}
                                </span>
                            </div>
                        </div>
                    ))}
                    {historyList.length === 0 && <div className="text-center text-gray-400 text-sm py-4">No transactions yet</div>}
                </div>
            </div>

            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type} 
                    onClose={() => setToast(null)} 
                />
            )}
        </div>
    </div>
  );
};
