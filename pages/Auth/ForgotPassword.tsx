
import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { Mail, ChevronLeft, Globe, KeyRound } from 'lucide-react';

const LOGO_URL = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133446.png";

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!email.trim()) {
        setError("Please enter your email");
        setLoading(false);
        return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage(`Password reset email sent to ${email}. Please check your inbox.`);
    } catch (err: any) {
      console.error(err.code);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setError("It is a non - register email");
      } else {
        setError(err.message || "Failed to reset password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e10] font-sans text-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f52c2c] to-[#a31a1a] p-4 text-white pb-16 rounded-b-[3rem] shadow-2xl relative border-b border-white/10">
        <div className="flex justify-between items-center mb-10 px-2">
            <button onClick={() => navigate('/login')} className="p-2 bg-white/10 rounded-full backdrop-blur-md"><ChevronLeft size={20}/></button>
            <h1 className="text-2xl font-black italic tracking-widest text-shadow-lg">KING CLUB</h1>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-bold">
                <span>EN</span>
                <Globe size={14} />
            </div>
        </div>
        
        <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-xl rounded-[2rem] border-2 border-white/40 p-3 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
            </div>
            <div className="text-center">
                <h2 className="text-3xl font-black mb-1 uppercase tracking-tighter">Recovery</h2>
                <p className="text-sm opacity-60 font-medium">Reset Your Password</p>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 -mt-8 relative z-10">
        <form onSubmit={handleReset} className="space-y-6 bg-[#16171a] p-8 rounded-[2rem] shadow-2xl border border-white/5">
          <div className="space-y-5">
             {/* Email Input */}
             <div>
                <label className="text-gray-400 font-black text-[10px] uppercase tracking-widest ml-1 mb-2 block">Registered Email</label>
                <div className="bg-[#1b1c1d] p-4 rounded-2xl shadow-inner border border-white/5 focus-within:border-[#f52c2c]/50 transition-all flex items-center gap-4">
                    <Mail className="text-[#f52c2c]" size={20} />
                    <input 
                        type="email" 
                        placeholder="Enter your email"
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-600 font-bold"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
             </div>
          </div>

          {error && <p className="bg-red-500/10 text-red-500 text-xs text-center py-3 rounded-lg font-bold border border-red-500/20 uppercase tracking-wide">{error}</p>}
          
          {message && <p className="bg-green-500/10 text-green-500 text-xs text-center py-3 rounded-lg font-bold border border-green-500/20">{message}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#f52c2c] to-[#8a1414] text-white font-black py-4 rounded-2xl shadow-[0_10px_20px_rgba(245,44,44,0.3)] text-lg uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Sending...' : (
                <>
                    <KeyRound size={20} /> RESET PASSWORD
                </>
            )}
          </button>

          <button type="button" onClick={() => navigate('/login')} className="w-full bg-transparent text-gray-500 font-bold py-2 text-xs hover:text-white transition-all uppercase tracking-widest">
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
};
