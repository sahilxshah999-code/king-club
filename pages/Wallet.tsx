import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { createTransaction, getUserProfile, getSystemSettings } from '../services/userService';
import { UserProfile, SystemSettings } from '../types';
import { ref, onValue } from 'firebase/database';
import { ChevronLeft, History, CreditCard, Bitcoin, Copy, Wallet as WalletIcon, Trophy, Gift } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Toast } from '../components/Toast';

const BalanceCard = ({label, amount, icon, color}: any) => (
    <div className="bg-[#151515] p-3 rounded-2xl shadow-lg border border-white/5 flex flex-col items-center text-center group hover:border-white/10 transition">
        <div className={`p-2 rounded-xl mb-2 bg-${color}-500/10 text-${color}-500 group-hover:scale-110 transition`}>{icon}</div>
        <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-0.5">{label}</span>
        <span className={`font-black text-sm text-${color}-400`}>₹{(amount||0).toFixed(0)}</span>
    </div>
);

const MethodBtn = ({label, icon, active, onClick, color}: any) => (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border transition active:scale-95 ${active ? `border-${color}-500 bg-${color}-500/10 text-${color}-500` : 'border-white/5 bg-black/20 text-gray-500 hover:border-white/20'}`}>
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
    </button>
);

export const Wallet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [method, setMethod] = useState<'UPI' | 'USDT'>('UPI');
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState(''); 
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
      if (location.state && (location.state as any).tab) setActiveTab((location.state as any).tab);
  }, [location]);

  useEffect(() => {
    getSystemSettings().then(setSettings);
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(await getUserProfile(u.uid));
        onValue(ref(db, 'transactions'), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const myTx = Object.values(data).filter((t: any) => t.uid === u.uid).sort((a: any, b: any) => b.timestamp - a.timestamp);
                setHistoryList(myTx);
            }
        });
        onValue(ref(db, `users/${u.uid}`), (snapshot) => { if(snapshot.exists()) setUser(snapshot.val()); });
      }
    });
    return () => unsub();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); showToast("Copied!", 'success'); };

  const handleSubmit = async () => {
    if (!user || !amount) { showToast("Please enter an amount", 'error'); return; }
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { showToast("Invalid amount", 'error'); return; }

    if (activeTab === 'deposit') {
        if (settings?.minDeposit && val < settings.minDeposit) return showToast(`Min deposit ₹${settings.minDeposit}`, 'error');
        if (settings?.maxDeposit && val > settings.maxDeposit) return showToast(`Max deposit ₹${settings.maxDeposit}`, 'error');
    }
    if (activeTab === 'withdraw') {
        if (settings?.minWithdraw && val < settings.minWithdraw) return showToast(`Min withdrawal ₹${settings.minWithdraw}`, 'error');
        if (settings?.maxWithdraw && val > settings.maxWithdraw) return showToast(`Max withdrawal ₹${settings.maxWithdraw}`, 'error');
        if (val > (user.winningBalance || 0)) return showToast(`Insufficient Winning Balance.`, 'error');
    }
    if (!details.trim()) return showToast(activeTab === 'deposit' ? "Enter UTR/TxHash" : "Enter Payment Details", 'error');

    try {
        await createTransaction({
            uid: user.uid, type: activeTab, amount: val, method: method,
            details: activeTab === 'deposit' ? (method === 'UPI' ? `UTR: ${details}` : `TxHash: ${details}`) : (method === 'UPI' ? `UPI: ${details}` : `Address: ${details}`)
        });
        showToast("Request Submitted!", 'success');
        setAmount(''); setDetails('');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  if (!settings) return <div className="p-10 text-center bg-[#0a0a0a] text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col font-sans text-white">
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] p-4 text-white pb-10 rounded-b-[2.5rem] shadow-2xl relative shrink-0 z-0 border-b border-white/5">
             <div className="flex justify-between items-center mb-4">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition"><ChevronLeft /></button>
                <h1 className="text-lg font-black tracking-widest uppercase">Wallet</h1>
                <div className="w-10"></div> 
            </div>
            
            <div className="text-center">
                <p className="text-gray-500 text-xs mb-1 font-bold uppercase tracking-widest">Total Balance</p>
                <h1 className="text-4xl font-black tracking-tight text-white">₹{(user?.balance || 0).toFixed(2)}</h1>
            </div>
        </div>

        <div className="px-4 -mt-8 flex-1 flex flex-col pb-24 relative z-10">
            <div className="grid grid-cols-3 gap-3 mb-6">
                 <BalanceCard label="Deposit" amount={user?.depositBalance} icon={<WalletIcon size={16}/>} color="blue"/>
                 <BalanceCard label="Winning" amount={user?.winningBalance} icon={<Trophy size={16}/>} color="green"/>
                 <BalanceCard label="Bonus" amount={user?.bonusBalance} icon={<Gift size={16}/>} color="purple"/>
            </div>

            <div className="bg-[#151515] rounded-2xl border border-white/5 p-1.5 flex mb-6 shadow-lg">
                <button onClick={() => { setActiveTab('deposit'); setDetails(''); }} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition ${activeTab === 'deposit' ? 'bg-[#d93025] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Deposit</button>
                <button onClick={() => { setActiveTab('withdraw'); setDetails(''); }} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition ${activeTab === 'withdraw' ? 'bg-[#d93025] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Withdraw</button>
            </div>

            <div className="bg-[#151515] p-6 rounded-[2rem] shadow-xl border border-white/5 mb-6">
                <div className="flex gap-3 mb-6">
                    <MethodBtn label="UPI / Bank" icon={<CreditCard size={20}/>} active={method==='UPI'} onClick={()=>setMethod('UPI')} color="red"/>
                    <MethodBtn label="USDT (TRC20)" icon={<Bitcoin size={20}/>} active={method==='USDT'} onClick={()=>setMethod('USDT')} color="green"/>
                </div>

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-gray-500 font-bold text-[10px] uppercase tracking-wide">Amount (₹)</label>
                        {activeTab === 'withdraw' && <span className="text-[10px] text-green-500 font-bold">Max: ₹{(user?.winningBalance || 0).toFixed(0)}</span>}
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 flex items-center focus-within:border-white/30 transition">
                        <span className="text-gray-400 font-bold mr-2">₹</span>
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent outline-none text-white font-bold text-lg placeholder-gray-700" placeholder="0.00" />
                    </div>
                    <div className="flex justify-between mt-1 px-1 text-[9px] font-bold text-gray-500 uppercase">
                        <span>Min: {activeTab === 'deposit' ? settings.minDeposit : settings.minWithdraw}</span>
                        <span>Max: {activeTab === 'deposit' ? settings.maxDeposit : settings.maxWithdraw}</span>
                    </div>
                </div>

                <div className="mb-6 space-y-4">
                    {activeTab === 'deposit' && (
                        <div className="p-6 bg-black/30 rounded-xl border border-dashed border-white/20 text-center">
                            {method === 'UPI' && settings.adminQrCodeUrl && (
                                <div className="bg-white p-2 rounded-xl inline-block mb-4">
                                    <img src={settings.adminQrCodeUrl} className="w-64 h-64 object-contain rounded-lg" alt="QR" />
                                </div>
                            )}
                            {method === 'USDT' && settings.adminUsdtQrCodeUrl && (
                                <div className="bg-white p-2 rounded-xl inline-block mb-4">
                                    <img src={settings.adminUsdtQrCodeUrl} className="w-64 h-64 object-contain rounded-lg" alt="QR" />
                                </div>
                            )}
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase">{method === 'UPI' ? 'UPI ID' : 'Wallet Address'}</p>
                                <div className="flex items-center gap-2 bg-white/5 px-4 py-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition w-full justify-between" onClick={() => copyToClipboard(method === 'UPI' ? settings.adminUpiId : settings.adminUsdtAddress)}>
                                    <span className="text-xs font-mono text-white select-all truncate">{method === 'UPI' ? settings.adminUpiId : settings.adminUsdtAddress}</span>
                                    <Copy size={14} className="text-gray-400 shrink-0"/>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-gray-500 font-bold text-[10px] mb-2 uppercase tracking-wide">
                            {activeTab === 'deposit' ? (method === 'UPI' ? 'UTR / Ref No.' : 'Transaction Hash') : (method === 'UPI' ? 'Your UPI ID' : 'Your Wallet Address')}
                        </label>
                        <input type="text" value={details} onChange={(e) => setDetails(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-white/30 transition text-sm font-medium" placeholder={activeTab === 'deposit' ? 'Enter details...' : 'Receiver details...'} />
                    </div>
                </div>
                
                <button onClick={handleSubmit} className="w-full bg-gradient-to-r from-[#d93025] to-red-800 text-white font-black py-4 rounded-xl shadow-lg shadow-red-900/40 hover:shadow-red-900/60 transition transform active:scale-95 uppercase tracking-widest text-sm">
                    {activeTab === 'deposit' ? 'Confirm Deposit' : 'Request Withdrawal'}
                </button>
            </div>

            <div className="flex-1">
                <h3 className="text-gray-400 font-black mb-4 flex items-center gap-2 text-sm uppercase tracking-widest"><History size={16} className="text-[#d93025]" /> History</h3>
                <div className="space-y-3">
                    {historyList.map((tx) => (
                        <div key={tx.id} className="bg-[#151515] p-4 rounded-xl flex justify-between items-center shadow-sm border border-white/5">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-black uppercase text-white">{tx.type}</p>
                                    <span className="text-[9px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded font-bold">{tx.method || 'UPI'}</span>
                                </div>
                                <p className="text-[10px] text-gray-600 font-mono">{new Date(tx.timestamp).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                                <p className={`font-black text-sm mb-1 ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>{tx.type === 'deposit' ? '+' : '-'}₹{tx.amount}</p>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${tx.status === 'approved' || tx.status === 'completed' ? 'bg-green-900/30 text-green-500' : tx.status === 'rejected' ? 'bg-red-900/30 text-red-500' : 'bg-yellow-900/30 text-yellow-500'}`}>{tx.status}</span>
                            </div>
                        </div>
                    ))}
                    {historyList.length === 0 && <div className="text-center text-gray-600 text-xs py-10 font-bold uppercase tracking-widest">No history found</div>}
                </div>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    </div>
  );
};
      
