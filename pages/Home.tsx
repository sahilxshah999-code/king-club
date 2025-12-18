import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, SystemSettings } from '../types';
import { getUserProfile, claimDailyReward, getSystemSettings } from '../services/userService';
import { auth } from '../firebase';
import { Gamepad2, Plane, Ticket, Bomb, Crown, Headphones } from 'lucide-react';

const LOGO_URL = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133446.png";
const IMG_DEPOSIT = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133444.png";
const IMG_WITHDRAW = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133443.png";
const IMG_DAILY = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133449.png";
const IMG_SPIN = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133439.png";

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

  const handleSupportClick = () => {
      if (settings?.customerServiceUrl) {
          window.open(settings.customerServiceUrl, '_blank');
      } else {
          alert("Customer support is currently unavailable.");
      }
  };

  const handleBannerClick = () => {
      if (settings?.homeBanners && settings.homeBanners[bannerIndex]?.link) {
          window.open(settings.homeBanners[bannerIndex].link, '_blank');
      }
  };

  if (loading) return (
    <div className="flex flex-col h-screen items-center justify-center bg-slate-900 gap-6">
      <div className="w-28 h-28 relative">
        <div className="absolute inset-0 rounded-full border-4 border-gold-500/20 border-t-gold-500 animate-spin"></div>
        <img 
          src={LOGO_URL} 
          className="w-full h-full object-contain p-2 animate-pulse" 
          alt="Loading Logo" 
        />
      </div>
      <div className="text-gold-500 font-black tracking-[0.4em] text-2xl animate-pulse">KING CLUB</div>
    </div>
  );

  return (
    <div className="pb-4 relative">
      {/* Floating Support Button */}
      <button 
        onClick={handleSupportClick}
        className="fixed bottom-24 right-4 w-14 h-14 bg-white rounded-full shadow-[0_10px_25px_rgba(0,0,0,0.3)] border-2 border-gold-500 flex items-center justify-center z-[60] animate-bounce-slow active:scale-90 transition-transform duration-200 ring-4 ring-gold-500/20"
      >
        <img src={LOGO_URL} className="w-10 h-10 object-contain rounded-full" alt="Support" />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
      </button>

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-b-[2.5rem] shadow-2xl border-b border-gold-600/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden p-1 shadow-inner flex items-center justify-center ring-2 ring-gold-500/30">
              <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
            </div>
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
          </div>
          <div className="bg-white/10 backdrop-blur-md p-2 pl-4 pr-4 rounded-xl border border-white/10 flex flex-col items-end shadow-lg">
             <span className="text-[10px] text-gray-300 uppercase tracking-wider font-bold">Balance</span>
             <span className="text-xl font-black text-white text-shadow-sm">₹{(user?.balance || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4 mt-8 px-1 relative z-10">
            <ActionButton 
                label="Deposit" 
                icon={IMG_DEPOSIT} 
                onClick={() => navigate('/wallet', { state: { tab: 'deposit' } })}
            />
            <ActionButton 
                label="Withdraw" 
                icon={IMG_WITHDRAW} 
                onClick={() => navigate('/wallet', { state: { tab: 'withdraw' } })}
            />
            <ActionButton 
                label="Daily" 
                icon={IMG_DAILY} 
                onClick={handleDailyCheckIn}
            />
            <ActionButton 
                label="Spin" 
                icon={IMG_SPIN} 
                onClick={() => navigate('/spin')}
            />
        </div>
      </header>

      {/* Banner Slider */}
      <div 
        onClick={handleBannerClick}
        className={`mx-4 mt-6 h-40 rounded-3xl shadow-xl overflow-hidden relative group bg-gray-900 border border-gray-100 ${settings?.homeBanners && settings.homeBanners[bannerIndex]?.link ? 'cursor-pointer' : ''}`}
      >
          {settings?.homeBanners && settings.homeBanners.length > 0 ? (
             <img 
                src={settings.homeBanners[bannerIndex].imageUrl} 
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
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-20">
                  {settings.homeBanners.map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === bannerIndex ? 'bg-white w-4 scale-110' : 'bg-white/50'}`}></div>
                  ))}
              </div>
          )}
      </div>

      {/* Games Grid */}
      <div className="p-4 mt-2 mb-20">
        <h3 className="text-gray-800 font-black mb-4 flex items-center gap-2 text-xl px-2">
            <Gamepad2 className="text-red-500" size={26}/> Trending Games
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
        <div className="w-full aspect-square bg-white/10 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center border border-white/20 shadow-xl group-active:scale-95 transition-all duration-300 hover:bg-white/15 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition"></div>
            <img src={icon} alt={label} className="w-[85%] h-[85%] object-contain drop-shadow-xl filter group-hover:brightness-110 group-hover:scale-110 transition-all duration-300" />
        </div>
        <span className="text-xs font-black text-gray-200 tracking-wide drop-shadow-sm group-hover:text-white transition uppercase text-[10px]">{label}</span>
    </button>
);

const GameCard = ({ title, color, icon, onClick, image }: any) => (
  <div onClick={onClick} className={`relative h-44 rounded-3xl overflow-hidden cursor-pointer shadow-xl transform transition active:scale-95 group bg-gray-900 border border-white/10`}>
      <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent"></div>
      <div className="absolute bottom-0 left-0 p-4 w-full">
          <div className="flex justify-between items-center">
             <span className="font-black text-white text-xl tracking-tight drop-shadow-2xl">{title}</span>
             <div className="text-white/95 bg-white/20 p-2 rounded-xl backdrop-blur-md shadow-inner ring-1 ring-white/10">{icon}</div>
          </div>
      </div>
  </div>
);
