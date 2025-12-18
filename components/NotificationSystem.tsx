import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onValue, ref } from 'firebase/database';
import { Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, SystemSettings, Notification } from '../types';

export const NotificationSystem = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnread, setHasUnread] = useState(true);

    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged(async (u) => {
            if (u) {
                const profileRef = ref(db, `users/${u.uid}`);
                onValue(profileRef, (snap) => {
                    if (snap.exists()) setUser(snap.val());
                });
            } else {
                setUser(null);
            }
        });

        const notifRef = ref(db, 'notifications');
        onValue(notifRef, (snap) => {
            if (snap.exists()) {
                const data = Object.values(snap.val()) as Notification[];
                setNotifications(data);
                setHasUnread(data.length > 0);
            }
        });

        return () => unsubAuth();
    }, []);

    // Only visible on Home Page
    if (!user || location.pathname !== '/') return null;

    return (
        <div className="fixed bottom-[17rem] right-4 z-[9999]">
            <button 
                onClick={() => { setHasUnread(false); navigate('/notifications'); }}
                className={`relative p-3 rounded-full bg-white shadow-xl border-2 transition active:scale-95 border-gray-100 text-gray-600 hover:border-[#d93025] hover:text-[#d93025]`}
            >
                <Bell size={24} className={hasUnread ? 'animate-swing' : ''} />
                {hasUnread && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
            </button>
        </div>
    );
};
