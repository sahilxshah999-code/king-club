import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { createUserProfile, getSystemSettings } from '../../services/userService';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ChevronLeft, Globe, User, Keyboard, Eye, EyeOff } from 'lucide-react';

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [referCode, setReferCode] = useState('');
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [privacyUrl, setPrivacyUrl] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getSystemSettings().then(settings => {
      setPrivacyUrl(settings.privacyPolicyUrl || '');
    });
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
        setError("Please agree to the privacy agreement");
        return;
    }
    if (password !== confirmPass) {
        setError("Passwords do not match");
        return;
    }
    if (!name.trim()) {
        setError("Please enter your name");
        return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await createUserProfile(userCredential.user.uid, email, name, referCode);
      navigate('/');
    } catch (err: any) {
      setError("Registration failed: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#101011] font-sans text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#fa3c3c] to-[#f52c2c] p-4 text-white pb-8 rounded-b-[2rem] shadow-md relative">
        <div className="flex justify-between items-center mb-6">
            <button className="p-1" onClick={() => navigate('/login')}><ChevronLeft /></button>
            <h1 className="text-2xl font-bold italic tracking-wide">KING CLUB</h1>
            <div className="flex items-center gap-1">
                <span className="text-sm">EN</span>
                <Globe size={16} />
            </div>
        </div>
        <div className="px-2 mb-4">
            <h2 className="text-2xl font-bold mb-1">Register</h2>
            <p className="text-sm opacity-80 text-white">Please register by email</p>
        </div>
        
        {/* Tab-like Visual */}
        <div className="flex justify-center">
             <div className="flex flex-col items-center gap-2">
                 <Mail className="text-white drop-shadow-md" size={32} />
                 <span className="font-bold text-sm">Register your email</span>
                 <div className="w-12 h-1 bg-white rounded-full"></div>
             </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-6 mt-6">
        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* Name */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#fa3c3c]">
                <User size={20} />
                <span className="font-bold text-gray-300 text-sm">Name</span>
            </div>
            <div className="bg-[#1b1c1d] p-3 rounded-xl shadow-sm border border-gray-700 flex items-center gap-3">
                 <input 
                    type="text"
                    placeholder="Please enter your name"
                    className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500 caret-[#fa3c3c]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                 />
            </div>
          </div>

          {/* Email */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#fa3c3c]">
                <Mail size={20} />
                <span className="font-bold text-gray-300 text-sm">Email</span>
            </div>
            <div className="bg-[#1b1c1d] p-3 rounded-xl shadow-sm border border-gray-700 flex items-center gap-3">
                 <span className="font-bold text-gray-400">@</span>
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

          {/* Password */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#fa3c3c]">
                <Lock size={20} />
                <span className="font-bold text-gray-300 text-sm">Set password</span>
            </div>
            <div className="bg-[#1b1c1d] p-3 rounded-xl shadow-sm border border-gray-700 flex items-center gap-3">
                 <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Set password"
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

          {/* Confirm Password */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#fa3c3c]">
                <Lock size={20} />
                <span className="font-bold text-gray-300 text-sm">Confirm password</span>
            </div>
            <div className="bg-[#1b1c1d] p-3 rounded-xl shadow-sm border border-gray-700 flex items-center gap-3">
                 <input 
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500 caret-[#fa3c3c]"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    required
                 />
                 <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-500 hover:text-white transition p-1"
                 >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                 </button>
            </div>
          </div>

          {/* Invite Code */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#fa3c3c]">
                <Keyboard size={20} />
                <span className="font-bold text-gray-300 text-sm">Invite code</span>
            </div>
            <div className="bg-[#1b1c1d] p-3 rounded-xl shadow-sm border border-gray-700 flex items-center gap-3">
                 <input 
                    type="text"
                    placeholder="Please enter the invitation code"
                    className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500 uppercase caret-[#fa3c3c]"
                    value={referCode}
                    onChange={(e) => setReferCode(e.target.value)}
                 />
            </div>
          </div>

          {/* Privacy */}
          <div className="flex items-center gap-2 mt-4">
             <div 
                onClick={() => setAgreed(!agreed)}
                className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${agreed ? 'bg-[#fa3c3c] border-[#fa3c3c]' : 'border-gray-400'}`}
             >
                {agreed && <div className="w-2 h-2 bg-white rounded-full"></div>}
             </div>
             <p className="text-xs text-gray-400">
                I have read and agree 
                <span 
                    onClick={() => privacyUrl && window.open(privacyUrl, '_blank')}
                    className={`text-[#fa3c3c] ml-1 ${privacyUrl ? 'cursor-pointer hover:underline' : ''}`}
                >
                    【Privacy Agreement】
                </span>
             </p>
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <button type="submit" className="w-full bg-gradient-to-r from-[#fa3c3c] to-[#f52c2c] text-white font-bold py-3.5 rounded-full shadow-lg shadow-red-500/30 text-lg mt-2">
            Register
          </button>

          <button type="button" onClick={() => navigate('/login')} className="w-full bg-transparent border border-[#fa3c3c] text-[#fa3c3c] font-bold py-3.5 rounded-full text-lg hover:bg-[#fa3c3c]/10 transition">
            I have an account <span className="font-black">Login</span>
          </button>

        </form>
      </div>
    </div>
  );
};
