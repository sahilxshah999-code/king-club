import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ChevronLeft, Globe, Headphones, Eye, EyeOff } from 'lucide-react';
import { getUserProfile, getSystemSettings } from '../../services/userService';

const LOGO_URL = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133446.png";

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [serviceUrl, setServiceUrl] = useState('');
  const [forgotUrl, setForgotUrl] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getSystemSettings().then(settings => {
        setServiceUrl(settings.customerServiceUrl || '');
        setForgotUrl(settings.forgotPasswordUrl || '');
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = await getUserProfile(userCredential.user.uid);
      
      if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError("Login failed: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e10] font-sans text-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f52c2c] to-[#a31a1a] p-4 text-white pb-16 rounded-b-[3rem] shadow-2xl relative border-b border-white/10">
        <div className="flex justify-between items-center mb-10 px-2">
            <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-full backdrop-blur-md"><ChevronLeft size={20}/></button>
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
                <h2 className="text-3xl font-black mb-1 uppercase tracking-tighter">Log in</h2>
                <p className="text-sm opacity-60 font-medium">Elevate Your Casino Experience</p>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 -mt-8 relative z-10">
        <form onSubmit={handleLogin} className="space-y-6 bg-[#16171a] p-8 rounded-[2rem] shadow-2xl border border-white/5">
          <div className="space-y-5">
             {/* Email Input */}
             <div>
                <label className="text-gray-400 font-black text-[10px] uppercase tracking-widest ml-1 mb-2 block">Account Email</label>
                <div className="bg-[#1b1c1d] p-4 rounded-2xl shadow-inner border border-white/5 focus-within:border-[#f52c2c]/50 transition-all flex items-center gap-4">
                    <Mail className="text-[#f52c2c]" size={20} />
                    <input 
                        type="email" 
                        placeholder="Please enter your email"
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-600 font-bold"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
             </div>

             {/* Password Input */}
             <div>
                <label className="text-gray-400 font-black text-[10px] uppercase tracking-widest ml-1 mb-2 block">Secure Password</label>
                <div className="bg-[#1b1c1d] p-4 rounded-2xl shadow-inner border border-white/5 focus-within:border-[#f52c2c]/50 transition-all flex items-center gap-4">
                    <Lock className="text-[#f52c2c]" size={20} />
                    <input 
                        type={showPassword ? "text" : "password"}
                        placeholder="Please enter Password"
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-600 font-bold"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-600 hover:text-[#f52c2c] transition p-1"
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
             </div>
          </div>

          {error && <p className="bg-red-500/10 text-red-500 text-xs text-center py-2 rounded-lg font-bold border border-red-500/20">{error}</p>}
          
          <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wider px-1">
              <span className="text-gray-500 cursor-pointer hover:text-white transition">Save Account</span>
              <span 
                onClick={() => forgotUrl && window.open(forgotUrl, '_blank')} 
                className={`text-gray-500 cursor-pointer hover:text-white transition ${!forgotUrl && 'opacity-30 pointer-events-none'}`}
              >
                Forgot Password?
              </span>
          </div>

          <button type="submit" className="w-full bg-gradient-to-r from-[#f52c2c] to-[#8a1414] text-white font-black py-4 rounded-2xl shadow-[0_10px_20px_rgba(245,44,44,0.3)] text-lg uppercase tracking-widest active:scale-95 transition-all">
            Log in
          </button>

          <button type="button" onClick={() => navigate('/register')} className="w-full bg-white/5 border border-white/10 text-white font-black py-4 rounded-2xl text-lg hover:bg-white/10 transition-all uppercase tracking-widest">
            Register
          </button>
        </form>

        <div className="mt-10 flex flex-col items-center gap-4">
            <div 
                onClick={() => serviceUrl && window.open(serviceUrl, '_blank')}
                className={`group flex flex-col items-center gap-2 cursor-pointer transition-all ${!serviceUrl && 'opacity-20 pointer-events-none'}`}
            >
                <div className="bg-white/5 p-4 rounded-full shadow-xl text-[#f52c2c] border border-white/10 group-hover:bg-[#f52c2c] group-hover:text-white transition-all duration-300">
                    <Headphones size={28} />
                </div>
                <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-gray-400 tracking-widest">Support</span>
            </div>
            <p className="text-[10px] text-gray-700 font-bold uppercase tracking-[0.2em] mt-2">© 2025 KING CLUB PLATFORM</p>
        </div>
      </div>
    </div>
  );
};
              
