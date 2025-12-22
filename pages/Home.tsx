
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, SystemSettings } from '../types';
import { getUserProfile, claimDailyReward, getSystemSettings } from '../services/userService';
import { auth } from '../firebase';
import { Gamepad2, Plane, Ticket, Bomb, Crown, Trophy, Zap, Bird, LayoutGrid, CircleDot, Castle, Repeat, Swords, Grid3X3, Dices } from 'lucide-react';
import { WelcomePopup } from '../components/WelcomePopup';
import { FirstDepositBonusPopup } from '../components/FirstDepositBonusPopup';
import { LoginPopup } from '../components/LoginPopup';

const LOGO_URL = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133446.png";
const IMG_DEPOSIT = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133444.png";
const IMG_WITHDRAW = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133443.png";
const IMG_DAILY = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133449.png";
const IMG_SPIN = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133439.png";
const IMG_LEADER = "https://cdn-icons-png.flaticon.com/512/3112/3112946.png";

export const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showDepositBonus, setShowDepositBonus] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        const profile = await getUserProfile(u.uid);
        setUser(profile);
        const sys = await getSystemSettings();
        setSettings(sys);
        if (profile && !profile.hasSeenWelcome) setShowWelcome(true);
      } else navigate('/login');
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
      if (!loading && user && !showWelcome && settings?.loginPopupMessage) {
          const seen = sessionStorage.getItem('seenLoginBanner');
          if (!seen) setTimeout(() => setShowLoginPopup(true), 300);
      }
  }, [loading, user, showWelcome, settings]);

  useEffect(() => {
      if (!loading && user && !showWelcome && !showLoginPopup) {
          if ((user.totalDeposited || 0) > 0) return;
          const today = new Date().toDateString();
          if (localStorage.getItem('hideDepositBonusDate') !== today) {
              setTimeout(() => setShowDepositBonus(true), 1000);
          }
      }
  }, [showWelcome, showLoginPopup, user, loading]);

  useEffect(() => {
      if (settings?.homeBanners && settings.homeBanners.length > 1) {
          const timer = setInterval(() => {
              setBannerIndex(prev => (prev + 1) % settings.homeBanners.length);
          }, 4000);
          return () => clearTimeout(timer);
      }
  }, [settings]);

  const handleDailyCheckIn = async () => {
    if (!user) return;
    try {
        const amount = await claimDailyReward(user.uid);
        const updated = await getUserProfile(user.uid);
        setUser(updated);
        alert(`Daily reward claimed: ₹${amount}`);
    } catch (e: any) { alert(e.message); }
  };

  const handleAviatorClick = () => {
      if (!user) return;
      if (user.balance >= 100 || (user.totalDeposited && user.totalDeposited > 0)) navigate('/game/aviator');
      else alert("Access Denied: You need a balance of ₹100 or at least one deposit to play Aviator.");
  };

  if (loading) return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#050a12] gap-6">
      <div className="w-28 h-28 relative">
        <div className="absolute inset-0 rounded-full border-4 border-yellow-500/20 border-t-yellow-500 animate-spin"></div>
        <img src={LOGO_URL} className="w-full h-full object-contain p-2 animate-pulse" alt="Loading" />
      </div>
    </div>
  );

  return (
    <div className="pb-4 relative bg-[#0a0a0a] min-h-screen text-white">
      {/* Popups */}
      {showWelcome && user && settings && <WelcomePopup user={user} settings={settings} onClose={() => setShowWelcome(false)} />}
      {showLoginPopup && user && settings && <LoginPopup user={user} title={settings.loginPopupTitle} message={settings.loginPopupMessage} onClose={() => setShowLoginPopup(false)} />}
      {showDepositBonus && user && <FirstDepositBonusPopup user={user} onClose={() => setShowDepositBonus(false)} />}

      {/* Floating Action */}
      <div className="fixed bottom-24 right-4 z-[60] flex flex-col gap-4 items-center">
        <button onClick={() => navigate('/spin')} className="w-14 h-14 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)] border-2 border-white flex items-center justify-center animate-bounce-slow active:scale-90 transition-transform">
          <img src={IMG_SPIN} className="w-9 h-9 object-contain" alt="Spin" />
        </button>
        <button onClick={() => window.open(settings?.customerServiceUrl, '_blank')} className="w-14 h-14 bg-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] border-2 border-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <img src={LOGO_URL} className="w-9 h-9 object-contain rounded-full" alt="Support" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-black animate-pulse"></div>
        </button>
      </div>

      {/* New Header */}
      <header className="bg-gradient-to-br from-[#1a0b2e] via-[#0f0f0f] to-[#0a0a0a] p-6 pb-10 rounded-b-[3rem] shadow-2xl border-b border-white/5 relative overflow-hidden">
        {/* Background FX */}
        <div className="absolute top-[-50%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.15),_transparent_70%)] pointer-events-none animate-pulse"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[80px]"></div>

        <div className="flex justify-between items-center mb-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-black/40 border border-white/10 p-1 flex items-center justify-center shadow-lg relative">
              <img src={LOGO_URL} className="w-full h-full object-contain rounded-full" alt="Logo" />
              <div className="absolute inset-0 rounded-full border border-yellow-500/30 animate-spin-slow"></div>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Hi, {user?.displayName}</h1>
              <div onClick={() => navigate('/profile')} className="flex items-center gap-2 mt-1 cursor-pointer bg-white/5 px-3 py-1 rounded-full border border-white/5 hover:bg-white/10 transition">
                 <Crown size={12} className="text-yellow-500" fill="currentColor"/>
                 <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">VIP {user?.vipLevel || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
             <span className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-1">Balance</span>
             <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-900/20 px-4 py-2 rounded-xl border border-yellow-600/30 backdrop-blur-md shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                <span className="text-xl font-black text-yellow-400 tracking-tighter">₹{(user?.balance || 0).toFixed(2)}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 relative z-10">
            <ActionBtn label="Deposit" icon={IMG_DEPOSIT} onClick={() => navigate('/wallet', { state: { tab: 'deposit' } })} color="from-green-600 to-emerald-800" />
            <ActionBtn label="Withdraw" icon={IMG_WITHDRAW} onClick={() => navigate('/wallet', { state: { tab: 'withdraw' } })} color="from-red-600 to-rose-800" />
            <ActionBtn label="Daily" icon={IMG_DAILY} onClick={handleDailyCheckIn} color="from-yellow-500 to-orange-700" />
            <ActionBtn label="Rank" icon={IMG_LEADER} onClick={() => navigate('/leaderboard')} color="from-blue-500 to-indigo-700" />
        </div>
      </header>

      {/* Banner */}
      <div onClick={() => settings?.homeBanners[bannerIndex]?.link && window.open(settings.homeBanners[bannerIndex].link, '_blank')} className="mx-4 mt-6 h-48 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group border border-white/5 bg-[#121212] cursor-pointer">
          {settings?.homeBanners && settings.homeBanners.length > 0 ? (
             <img src={settings.homeBanners[bannerIndex].imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Banner" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#2a0a18] via-[#1a0b2e] to-black flex items-center justify-center">
                <h2 className="text-3xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 drop-shadow-lg">KING CLUB</h2>
            </div>
          )}
          
          {settings?.homeBanners && settings.homeBanners.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
                  {settings.homeBanners.map((_, i) => (
                      <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === bannerIndex ? 'bg-white w-6 shadow-[0_0_10px_white]' : 'bg-white/20 w-2'}`}></div>
                  ))}
              </div>
          )}
      </div>

      {/* Games Section */}
      <div className="p-4 mt-2 mb-20 space-y-6">
        <div className="flex justify-between items-center px-2 border-l-4 border-red-600 pl-3">
            <h3 className="text-white font-black text-lg uppercase tracking-wider flex items-center gap-2">
                <Zap className="text-red-500 fill-red-500 animate-pulse" size={18}/> Hot Games
            </h3>
            <button className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition">See All</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GameTile title="Win Go" img="https://uploads.onecompiler.io/43yf4q9cp/4479hms35/f351f075730277cb8af52d230428b249.jpg" icon={<Ticket/>} to="/game/wingo" hot />
          <GameTile title="Dice" img="https://uploads.onecompiler.io/43yf4q9cp/44897n5xj/1000134146.jpg" icon={<Dices/>} to="/game/dice" hot />
          <GameTile title="Keno" img="https://uploads.onecompiler.io/43yf4q9cp/44897n5xj/1000134136.png" icon={<Grid3X3/>} to="/game/keno" />
          <GameTile title="Coin Flip" img="https://uploads.onecompiler.io/43yf4q9cp/448335hgt/1000133828.jpg" icon={<Repeat/>} to="/game/coinflip" />
          <GameTile title="Chicken" img="https://uploads.onecompiler.io/43yf4q9cp/4482kdrxk/1000133796.png" icon={<Bird/>} to="/game/chickenroad" />
          <GameTile title="Dragon Tiger" img="https://uploads.onecompiler.io/43yf4q9cp/4479hms35/unnamed.webp" icon={<Swords/>} to="/game/dragontiger" />
          <GameTile title="Dragon Tower" img="https://uploads.onecompiler.io/43yf4q9cp/4482xrnmc/1000133815.jpg" icon={<Castle/>} to="/game/dragontower" />
          <GameTile title="Plinko" img="https://uploads.onecompiler.io/43yf4q9cp/4482kdrxk/1000133797.jpg" icon={<CircleDot/>} to="/game/plinko" />
          <GameTile title="Mines" img="https://uploads.onecompiler.io/43yf4q9cp/4479yhnbk/1000132485.jpg" icon={<Bomb/>} to="/game/mines" />
          <GameTile title="Aviator" img="https://uploads.onecompiler.io/43yf4q9cp/4479hms35/download.jpeg" icon={<Plane/>} action={handleAviatorClick} />
          <GameTile title="Roulette" img="https://uploads.onecompiler.io/43yf4q9cp/4479hms35/classic-roulette.webp" icon={<div className="w-3 h-3 rounded-full border-2 border-white"/>} to="/game/roulette" />
        </div>
      </div>
    </div>
  );
};

const ActionBtn = ({ label, icon, onClick, color }: any) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group w-full">
        <div className={`w-full aspect-square bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center shadow-lg border border-white/10 group-active:scale-95 transition-transform duration-300 relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            <img src={icon} alt={label} className="w-[60%] h-[60%] object-contain drop-shadow-md z-10 filter group-hover:brightness-110 transition" />
        </div>
        <span className="text-[10px] font-black text-gray-400 tracking-widest group-hover:text-white transition uppercase">{label}</span>
    </button>
);

const GameTile = ({ title, img, icon, to, action, hot }: any) => {
    const navigate = useNavigate();
    return (
        <div onClick={action || (() => navigate(to))} className="relative h-40 bg-[#151515] rounded-[1.5rem] overflow-hidden cursor-pointer group border border-white/5 hover:border-red-500/50 transition-all active:scale-95 shadow-xl">
            <img src={img} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" alt={title} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
            {hot && <div className="absolute top-2 right-2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase animate-pulse shadow-lg">Hot</div>}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-wider drop-shadow-md">{title}</h4>
                    <div className="h-0.5 w-8 bg-red-500 rounded-full mt-1 group-hover:w-full transition-all duration-500"></div>
                </div>
                <div className="text-white/50 group-hover:text-white transition-colors p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">{icon}</div>
            </div>
        </div>
    );
}
