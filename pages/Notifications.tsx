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
            } else {
                navigate('/login');
            }
        });

        const notifRef = ref(db, 'notifications');
        const unsubNotif = onValue(notifRef, (snap) => {
            if (snap.exists()) {
                const data = Object.values(snap.val()) as Notification[];
                data.sort((a, b) => b.timestamp - a.timestamp);
                setNotifications(data);
            }
            setLoading(false);
        });

        return () => {
            unsubAuth();
            unsubNotif();
        };
    }, [navigate]);

    if (loading) return <div className="min-h-screen bg-[#0d0e10] flex items-center justify-center text-gold-500">Loading...</div>;

    return (
        <div className="min-h-screen bg-[#0d0e10] font-sans text-white pb-10">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#f52c2c] to-[#a31a1a] p-6 pb-12 rounded-b-[3rem] shadow-2xl border-b border-white/10 relative overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] opacity-10"><Bell size={150} /></div>
                <div className="flex items-center justify-between relative z-10">
                    <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 transition">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-black italic tracking-widest">CENTER</h1>
                    <div className="w-10"></div>
                </div>
                <div className="mt-8 relative z-10">
                    <h2 className="text-4xl font-black uppercase tracking-tighter italic text-shadow-lg">Notifications</h2>
                    <p className="text-sm opacity-70 font-bold uppercase tracking-widest mt-1">Official Updates & Gift Alerts</p>
                </div>
            </div>

            {/* List */}
            <div className="px-6 -mt-6 relative z-10 space-y-4">
                {notifications.length > 0 ? (
                    notifications.map((notif) => (
                        <div key={notif.id} className="bg-[#16171a] p-6 rounded-[2rem] border border-white/5 shadow-xl group hover:border-[#f52c2c]/30 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-[#f52c2c]/10 rounded-2xl text-[#f52c2c] group-hover:scale-110 transition-transform">
                                        <Bell size={24} fill="currentColor" className="opacity-80" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg uppercase tracking-tight text-white/90">{notif.title}</h3>
                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                            <Calendar size={12} />
                                            {new Date(notif.timestamp).toLocaleDateString()} {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative">
                                <div className="absolute left-0 top-0 w-1 h-full bg-gold-500/30 rounded-full"></div>
                                <p className="text-sm text-gray-400 font-medium leading-relaxed pl-4">
                                    {user ? processPlaceholders(notif.content, user) : notif.content}
                                </p>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-1.5 text-[#f52c2c] text-[10px] font-black uppercase tracking-widest opacity-60">
                                    <Info size={12} />
                                    Official
                                </div>
                                <div className="text-gold-500/40 text-[10px] font-black italic">KING CLUB</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <Bell size={64} className="mb-4" />
                        <p className="font-black uppercase tracking-widest text-sm">No Notifications Yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};
