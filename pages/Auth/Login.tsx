import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ChevronLeft, Globe, Headphones, Eye, EyeOff } from 'lucide-react';
import { getUserProfile, getSystemSettings } from '../../services/userService';

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
    <div className="min-h-screen bg-[#101011] font-sans text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#fa3c3c] to-[#f52c2c] p-4 text-white pb-12 rounded-b-[2rem] shadow-md relative">
        <div className="flex justify-between items-center mb-6">
            <button className="p-1"><ChevronLeft /></button>
            <h1 className="text-2xl font-bold italic tracking-wide">KING CLUB</h1>
            <div className="flex items-center gap-1">
                <span className="text-sm">EN</span>
                <Globe size={16} />
            </div>
        </div>
        <div className="px-2">
            <h2 className="text-2xl font-bold mb-1">Log in</h2>
            <p className="text-sm opacity-80 text-white">Please log in with your email</p>
            <p className="text-[10px] opacity-60 mt-1">If you forget your password, please contact customer service</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 -mt-6">
        <form onSubmit={handleLogin} className="space-y-6 pt-4">
          <div className="space-y-4">
             {/* Email Input */}
             <div>
                <div className="flex items-center gap-2 mb-2">
                    <Mail className="text-[#fa3c3c]" size={20} />
                    <label className="text-gray-300 font-medium text-sm">Email</label>
                </div>
                <div className="bg-[#1b1c1d] p-3 rounded-lg shadow-sm border border-gray-700 focus-within:border-[#fa3c3c] transition flex items-center gap-3">
                    <span className="text-gray-400 font-bold pr-2">@</span>
                    <input 
                        type="email" 
                        placeholder="Please enter your email"
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500 caret-[#fa3c3c]"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
             </div>

             {/* Password Input */}
             <div>
                <div className="flex items-center gap-2 mb-2">
                    <Lock className="text-[#fa3c3c]" size={20} />
                    <label className="text-gray-300 font-medium text-sm">Password</label>
                </div>
                <div className="bg-[#1b1c1d] p-3 rounded-lg shadow-sm border border-gray-700 focus-within:border-[#fa3c3c] transition flex items-center gap-3">
                    <input 
                        type={showPassword ? "text" : "password"}
                        placeholder="Please enter Password"
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500 caret-[#fa3c3c]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-500 hover:text-white transition p-1"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
             </div>
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          
          <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-gray-400 cursor-pointer hover:text-white">Remember Password</span>
              <span 
                onClick={() => forgotUrl && window.open(forgotUrl, '_blank')} 
                className={`text-gray-400 cursor-pointer hover:text-white ${!forgotUrl && 'opacity-50 cursor-default'}`}
              >
                Forgot Password?
              </span>
          </div>

          <button type="submit" className="w-full bg-gradient-to-r from-[#fa3c3c] to-[#f52c2c] text-white font-bold py-3.5 rounded-full shadow-lg shadow-red-500/30 text-lg">
            Log in
          </button>

          <button type="button" onClick={() => navigate('/register')} className="w-full bg-transparent border border-[#fa3c3c] text-[#fa3c3c] font-bold py-3.5 rounded-full text-lg hover:bg-[#fa3c3c]/10 transition">
            Register
          </button>
        </form>

        <div className="mt-8 flex justify-center">
            <div 
                onClick={() => serviceUrl && window.open(serviceUrl, '_blank')}
                className={`flex flex-col items-center gap-2 cursor-pointer transition active:scale-95 ${!serviceUrl && 'opacity-50 cursor-default pointer-events-none'}`}
            >
                <div className="bg-[#1b1c1d] p-3 rounded-full shadow-md text-[#fa3c3c] border border-gray-800 hover:bg-[#fa3c3c] hover:text-white transition-colors">
                    <Headphones size={24} />
                </div>
                <span className="text-xs text-gray-500">Customer Service</span>
            </div>
        </div>
      </div>
    </div>
  );
};
