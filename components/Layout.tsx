
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Wallet, User, ShieldCheck } from 'lucide-react';
import { auth, db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { UserProfile } from '../types';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
        if (u) {
            onValue(ref(db, `users/${u.uid}`), (snap) => {
                if (snap.exists()) setUser(snap.val());
            });
        }
    });
    return () => unsub();
  }, []);

  const isActive = (path: string) => location.pathname === path ? 'text-white scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'text-gray-600 hover:text-gray-400';

  const canSeeAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-black flex justify-center items-center">
      <div className="w-full max-w-md h-[100dvh] bg-[#0a0a0a] relative shadow-2xl overflow-hidden flex flex-col">
        
        <main className="flex-1 overflow-y-auto no-scrollbar pb-20">
          {children}
        </main>
        
        <div className="absolute bottom-0 w-full bg-[#121212]/90 backdrop-blur-xl border-t border-white/5 h-20 flex justify-around items-center z-50 px-2 pb-2">
          <button onClick={() => navigate('/')} className={`flex-1 flex flex-col items-center transition-all duration-300 ${isActive('/')}`}>
            <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
            <span className="text-[9px] mt-1.5 font-black uppercase tracking-widest">Home</span>
          </button>
          
          <button onClick={() => navigate('/wallet')} className={`flex-1 flex flex-col items-center transition-all duration-300 ${isActive('/wallet')}`}>
            <Wallet size={24} strokeWidth={isActive('/wallet') ? 2.5 : 2} />
            <span className="text-[9px] mt-1.5 font-black uppercase tracking-widest">Wallet</span>
          </button>
          
          <button onClick={() => navigate('/profile')} className={`flex-1 flex flex-col items-center transition-all duration-300 ${isActive('/profile')}`}>
            <User size={24} strokeWidth={isActive('/profile') ? 2.5 : 2} />
            <span className="text-[9px] mt-1.5 font-black uppercase tracking-widest">Account</span>
          </button>

          {canSeeAdmin && (
             <button onClick={() => navigate('/admin')} className={`flex-1 flex flex-col items-center transition-all duration-300 ${isActive('/admin')}`}>
             <ShieldCheck size={24} strokeWidth={isActive('/admin') ? 2.5 : 2} />
             <span className="text-[9px] mt-1.5 font-black uppercase tracking-widest">Admin</span>
           </button>
          )}
        </div>
      </div>
    </div>
  );
};
