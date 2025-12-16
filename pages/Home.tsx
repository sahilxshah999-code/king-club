import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, SystemSettings } from '../types';
import { getUserProfile, claimDailyReward, getSystemSettings } from '../services/userService';
import { auth } from '../firebase';
import { Gamepad2, Plane, Ticket, Bomb, Crown } from 'lucide-react';

export const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        const profile = await getUserProfile(u.uid);
        setUser(profile);
        const sys = await getSystemSettings();
        setSettings(sys);
      } else {
        navigate('/login');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
      if (settings?.homeBanners && settings.homeBanners.length > 1) {
          const timer = setInterval(() => {
              setBannerIndex(prev => (prev + 1) % settings.homeBanners.length);
          }, 4000);
          return () => clearInterval(timer);
      }
  }, [settings]);

  const handleDailyCheckIn = async () => {
    if (!user) return;
    try {
        const amount = await claimDailyReward(user.uid);
        const updated = await getUserProfile(user.uid);
        setUser(updated);
        alert(`Daily reward claimed: ₹${amount}`);
    } catch (e: any) {
        alert(e.message);
    }
  };

  const handleAviatorClick = () => {
      if (!user) return;
      if (user.balance >= 100 || (user.totalDeposited && user.totalDeposited > 0)) {
          navigate('/game/aviator');
      } else {
          alert("Access Denied: You need a balance of ₹100 or at least one deposit to play Aviator.");
      }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gold-500">Loading King Club...</div>;

  return (
    <div className="pb-4">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-b-[2rem] shadow-xl border-b border-gold-600/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="flex justify-between items-center mb-6 relative z-10">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Hello, {user?.displayName}</h1>
            {user?.numericId && (
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {user.numericId}</div>
            )}
            <div onClick={() => navigate('/profile')} className="flex items-center gap-1 text-xs text-gold-400 cursor-pointer hover:text-gold-300 transition mt-1">
               <Crown size={14} fill="currentColor" />
               <span className="font-bold">VIP Level {user?.vipLevel || 1}</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-2 pl-4 pr-4 rounded-xl border border-white/10 flex flex-col items-end shadow-lg">
             <span className="text-[10px] text-gray-300 uppercase tracking-wider font-bold">Balance</span>
             <span className="text-xl font-black text-white text-shadow-sm">₹{(user?.balance || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4 mt-6 px-1 relative z-10">
            <ActionButton 
                label="Deposit" 
                icon="https://img.icons8.com/fluency/96/initiate-money-transfer.png" 
                onClick={() => navigate('/wallet', { state: { tab: 'deposit' } })}
            />
            <ActionButton 
                label="Withdraw" 
                icon="https://img.icons8.com/fluency/96/request-money.png" 
                onClick={() => navigate('/wallet', { state: { tab: 'withdraw' } })}
            />
            <ActionButton 
                label="Daily" 
                icon="https://img.icons8.com/fluency/96/gift--v1.png" 
                onClick={handleDailyCheckIn}
            />
            <ActionButton 
                label="Spin" 
                icon="https://img.icons8.com/fluency/96/roulette.png" 
                onClick={() => navigate('/spin')}
            />
        </div>
      </header>

      {/* Banner Slider */}
      <div className="mx-4 mt-6 h-36 rounded-2xl shadow-lg overflow-hidden relative group bg-gray-900">
          {settings?.homeBanners && settings.homeBanners.length > 0 ? (
             <img 
                src={settings.homeBanners[bannerIndex]} 
                className="w-full h-full object-cover transition-all duration-500" 
                alt="Banner" 
             />
          ) : (
            <div className="bg-gradient-to-r from-gold-600 to-yellow-400 w-full h-full flex items-center justify-between p-5">
                <div className="z-10 relative">
                    <h2 className="text-slate-900 font-black text-3xl italic tracking-tighter drop-shadow-sm">KING CLUB</h2>
                    <p className="text-slate-800 font-bold text-sm mb-3 opacity-80">Premium Gold Edition</p>
                </div>
            </div>
          )}
          
          {/* Dots Indicator */}
          {settings?.homeBanners && settings.homeBanners.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-20">
                  {settings.homeBanners.map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition ${i === bannerIndex ? 'bg-white scale-125' : 'bg-white/50'}`}></div>
                  ))}
              </div>
          )}
      </div>

      {/* Games Grid */}
      <div className="p-4 mt-2 mb-16">
        <h3 className="text-gray-800 font-black mb-4 flex items-center gap-2 text-lg">
            <Gamepad2 className="text-red-500" size={24}/> Popular Games
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <GameCard 
            title="Mines" 
            image="https://uploads.onecompiler.io/43yf4q9cp/4479yhnbk/1000132485.jpg" 
            color="from-yellow-600 to-yellow-900" 
            icon={<Bomb />}
            onClick={() => navigate('/game/mines')}
          />
          <GameCard 
            title="Aviator" 
            image="https://uploads.onecompiler.io/43yf4q9cp/4479hms35/download.jpeg" 
            color="from-red-600 to-red-900" 
            icon={<Plane />}
            onClick={handleAviatorClick}
          />
          <GameCard 
            title="Win Go" 
            image="https://uploads.onecompiler.io/43yf4q9cp/4479hms35/f351f075730277cb8af52d230428b249.jpg" 
            color="from-green-600 to-green-900" 
            icon={<Ticket />}
            onClick={() => navigate('/game/wingo')}
          />
          <GameCard 
            title="Roulette" 
            image="https://uploads.onecompiler.io/43yf4q9cp/4479hms35/classic-roulette.webp" 
            color="from-blue-600 to-blue-900" 
            icon={<div className="w-4 h-4 rounded-full border-2 border-white"/>}
            onClick={() => navigate('/game/roulette')}
          />
          <GameCard 
            title="Dragon Tiger" 
            image="https://uploads.onecompiler.io/43yf4q9cp/4479hms35/unnamed.webp" 
            color="from-purple-600 to-purple-900" 
            icon={<span className="text-lg font-bold">VS</span>}
            onClick={() => navigate('/game/dragontiger')}
          />
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ label, icon, onClick }: any) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group w-full">
        <div className="w-full aspect-square bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-lg group-active:scale-95 transition-all duration-200 hover:bg-white/15 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition"></div>
            <img src={icon} alt={label} className="w-1/2 h-1/2 object-contain drop-shadow-lg filter group-hover:brightness-110 transition" />
        </div>
        <span className="text-xs font-bold text-gray-200 tracking-wide drop-shadow-sm group-hover:text-white transition">{label}</span>
    </button>
);

const GameCard = ({ title, color, icon, onClick, image }: any) => (
  <div onClick={onClick} className={`relative h-40 rounded-2xl overflow-hidden cursor-pointer shadow-lg transform transition active:scale-95 group bg-gray-900`}>
      <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
      <div className="absolute bottom-0 left-0 p-3 w-full">
          <div className="flex justify-between items-center">
             <span className="font-black text-white text-lg tracking-wide drop-shadow-md">{title}</span>
             <div className="text-white/90 bg-white/20 p-1.5 rounded-lg backdrop-blur-sm shadow-sm">{icon}</div>
          </div>
      </div>
  </div>
);
