
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { db, auth } from '../firebase';
import { Notification, UserProfile } from '../types';
import { ChevronLeft, Bell, Calendar, Info } from 'lucide-react';
import { getUserProfile, processPlaceholders } from '../services/userService';

export const Notifications = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged(async (u) => {
            if (u) {
                const profile = await getUserProfile(u.uid);
                setUser(profile);

                const notifRef = ref(db, 'notifications');
                onValue(notifRef, (snap) => {
                    if (snap.exists()) {
                        const data = Object.values(snap.val()) as Notification[];
                        const filtered = data.filter(n => !n.targetUid || n.targetUid === u.uid);
                        filtered.sort((a, b) => b.timestamp - a.timestamp);
                        setNotifications(filtered);
                    }
                    setLoading(false);
                });
            } else navigate('/login');
        });
        return () => unsubAuth();
    }, [navigate]);

    if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-red-500 font-black animate-pulse text-xs uppercase tracking-widest">Loading...</div>;

    return (
        <div className="min-h-screen bg-[#0a0a0a] font-sans text-white pb-10">
            <div className="bg-gradient-to-br from-[#1a0b2e] to-[#0a0a0a] p-6 pb-12 rounded-b-[3rem] shadow-2xl border-b border-white/5 relative overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] opacity-5"><Bell size={150} /></div>
                <div className="flex items-center justify-between relative z-10">
                    <button onClick={() => navigate('/')} className="p-2 bg-white/5 rounded-full backdrop-blur-md hover:bg-white/10 transition border border-white/5">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-black italic tracking-widest text-gray-400">CENTER</h1>
                    <div className="w-10"></div>
                </div>
                <div className="mt-8 relative z-10 px-2">
                    <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white drop-shadow-md">Notifications</h2>
                    <p className="text-xs opacity-60 font-bold uppercase tracking-widest mt-1 text-gray-400">Official Updates & Alerts</p>
                </div>
            </div>

            <div className="px-6 -mt-6 relative z-10 space-y-4">
                {notifications.length > 0 ? (
                    notifications.map((notif) => (
                        <div key={notif.id} className={`bg-[#121212] p-6 rounded-[2rem] border shadow-xl group transition-all ${notif.targetUid ? 'border-blue-500/30' : 'border-white/5 hover:border-red-500/30'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 ${notif.targetUid ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
                                        <Bell size={24} fill="currentColor" className="opacity-80" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base uppercase tracking-tight text-white/90 mb-1">{notif.title}</h3>
                                        <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                            <Calendar size={10} />
                                            {new Date(notif.timestamp).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative pl-4 border-l-2 border-white/5 ml-1">
                                <p className="text-xs text-gray-400 font-medium leading-relaxed whitespace-pre-wrap">
                                    {user ? processPlaceholders(notif.content, user) : notif.content}
                                </p>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                                <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest opacity-60 ${notif.targetUid ? 'text-blue-400' : 'text-red-500'}`}>
                                    <Info size={10} />
                                    {notif.targetUid ? 'Personal Msg' : 'System Broadcast'}
                                </div>
                                <div className="text-white/20 text-[9px] font-black italic">KING CLUB</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <Bell size={64} className="mb-4 text-gray-600" />
                        <p className="font-black uppercase tracking-widest text-xs text-gray-600">No Notifications</p>
                    </div>
                )}
            </div>
        </div>
    );
};
