import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Wallet, User, ShieldCheck } from 'lucide-react';

interface LayoutProps {
  children?: React.ReactNode;
  isAdmin?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, isAdmin }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path ? 'text-[#d93025]' : 'text-gray-400';

  return (
    <div className="min-h-screen bg-gray-900 flex justify-center items-center">
      {/* 
         Changed min-h-screen to h-[100dvh] (dynamic viewport height) 
         This forces the container to exactly fit the screen, disabling body scroll 
         and enabling internal scroll for 'main'.
      */}
      <div className="w-full max-w-md h-[100dvh] bg-[#f7f8ff] relative shadow-2xl overflow-hidden flex flex-col">
        
        {/* Main Content: Takes remaining space and scrolls internally */}
        <main className="flex-1 overflow-y-auto no-scrollbar pb-20">
          {children}
        </main>
        
        {/* Bottom Navigation: Fixed within the flex container */}
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 h-16 flex justify-around items-center z-50 shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
          <button onClick={() => navigate('/')} className={`flex flex-col items-center ${isActive('/')}`}>
            <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-medium">Home</span>
          </button>
          
          <button onClick={() => navigate('/wallet')} className={`flex flex-col items-center ${isActive('/wallet')}`}>
            <Wallet size={24} strokeWidth={isActive('/wallet') ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-medium">Wallet</span>
          </button>
          
          <button onClick={() => navigate('/profile')} className={`flex flex-col items-center ${isActive('/profile')}`}>
            <User size={24} strokeWidth={isActive('/profile') ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-medium">Account</span>
          </button>

          {isAdmin && (
             <button onClick={() => navigate('/admin')} className={`flex flex-col items-center ${isActive('/admin')}`}>
             <ShieldCheck size={24} strokeWidth={isActive('/admin') ? 2.5 : 2} />
             <span className="text-[10px] mt-1 font-medium">Admin</span>
           </button>
          )}
        </div>
      </div>
    </div>
  );
};
