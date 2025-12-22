
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSystemSettings, getUserProfile } from '../services/userService';
import { auth } from '../firebase';
import { ActivityTask, UserProfile } from '../types';
import { ChevronLeft, Globe, ClipboardList, Gift, TrendingUp, CheckCircle } from 'lucide-react';

const LOGO_URL = "https://uploads.onecompiler.io/43yf4q9cp/447x6y7wu/1000133446.png";

export const Activity = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ActivityTask[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        const u = auth.currentUser;
        if (u) {
            const profile = await getUserProfile(u.uid);
            setUser(profile);
        }
        const s = await getSystemSettings();
        setTasks(s.activities || []);
        setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans text-white pb-10">
      <div className="bg-gradient-to-br from-[#1a0b2e] to-[#0a0a0a] p-6 pb-16 rounded-b-[3rem] shadow-2xl relative border-b border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[80px]"></div>
        <div className="flex justify-between items-center mb-10 px-2 relative z-10">
            <button onClick={() => navigate('/profile')} className="p-2 bg-white/5 rounded-full backdrop-blur-md border border-white/5 hover:bg-white/10 transition"><ChevronLeft size={20}/></button>
            <h1 className="text-xl font-black italic tracking-widest text-shadow-lg uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Activity</h1>
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full text-[10px] font-black border border-white/5">
                <span>EN</span><Globe size={12} />
            </div>
        </div>
        <div className="flex flex-col items-center gap-6 relative z-10">
            <div className="w-24 h-24 bg-black/40 backdrop-blur-xl rounded-[2rem] border border-white/10 p-4 shadow-[0_0_40px_rgba(220,38,38,0.2)]">
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
            </div>
            <div className="text-center">
                <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter text-white drop-shadow-md">Tasks & Rewards</h2>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Complete tasks to earn huge bonuses</p>
            </div>
        </div>
      </div>

      <div className="px-6 -mt-8 relative z-10 space-y-4">
        {loading ? (
            <div className="text-center py-20 text-gray-600 font-bold uppercase tracking-widest animate-pulse text-xs">Loading Tasks...</div>
        ) : tasks.length > 0 ? (
            tasks.map((task) => {
                const isCompleted = user?.completedActivities?.includes(task.id);
                return (
                    <div key={task.id} className={`bg-[#121212] p-6 rounded-[2rem] shadow-xl border relative overflow-hidden group transition-all ${isCompleted ? 'border-green-500/30' : 'border-white/5 hover:border-red-500/30'}`}>
                        <div className={`absolute top-0 right-0 p-4 transition duration-500 ${isCompleted ? 'text-green-500/10' : 'text-red-500/5 group-hover:text-red-500/10'}`}><TrendingUp size={100} /></div>
                        
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl border shadow-inner ${isCompleted ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                    {isCompleted ? <CheckCircle size={24} /> : <ClipboardList size={24} />}
                                </div>
                                <h3 className={`font-black text-lg uppercase tracking-tight ${isCompleted ? 'text-green-500' : 'text-white'}`}>{task.title}</h3>
                            </div>
                            {isCompleted && <span className="bg-green-500/20 text-green-500 text-[9px] font-black px-3 py-1 rounded-full uppercase border border-green-500/30">Completed</span>}
                        </div>
                        
                        <p className={`text-xs font-bold leading-relaxed mb-6 pl-1 relative z-10 ${isCompleted ? 'text-gray-600' : 'text-gray-400'}`}>
                            {task.description}
                        </p>
                        
                        <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner relative z-10">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Reward</span>
                                <span className={`text-2xl font-black ${isCompleted ? 'text-green-500' : 'text-red-500'}`}>₹{task.amount}</span>
                            </div>
                            <button className={`font-black px-6 py-3 rounded-xl shadow-lg active:scale-95 transition text-[10px] uppercase tracking-widest ${isCompleted ? 'bg-gray-800 text-gray-500 cursor-default border border-white/5' : 'bg-gradient-to-r from-red-600 to-red-800 text-white shadow-red-900/30 hover:shadow-red-900/50'}`}>
                                {isCompleted ? 'Claimed' : 'Details'}
                            </button>
                        </div>
                    </div>
                );
            })
        ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
                <Gift size={64} className="mb-4 text-gray-600" /><p className="font-black uppercase tracking-widest text-[10px] text-gray-600">No active tasks</p>
            </div>
        )}
      </div>
    </div>
  );
};
