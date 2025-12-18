import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSystemSettings } from '../services/userService';
import { LeaderboardEntry } from '../types';
import { ChevronLeft, Crown, Award, Diamond } from 'lucide-react';

const MALE_AVATAR = "https://cdn-icons-png.flaticon.com/512/924/924915.png";
const FEMALE_AVATAR = "https://cdn-icons-png.flaticon.com/512/1154/1154448.png";

export const Leaderboard = () => {
    const navigate = useNavigate();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSystemSettings().then(s => {
            if (s.leaderboard) {
                setEntries(s.leaderboard);
            } else {
                // Fallback demo data
                setEntries(Array.from({ length: 10 }, (_, i) => ({
                    name: `Player ${i + 1}`,
                    userId: (100000 + i).toString(),
                    amount: 50000 - (i * 4000),
                    gender: i % 2 === 0 ? 'male' : 'female'
                })));
            }
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="min-h-screen bg-[#0d0e10] flex items-center justify-center text-gold-500">Loading Leaderboard...</div>;

    const top3 = entries.slice(0, 3);
    const list = entries.slice(3);

    // Podium order: 2, 1, 3
    const podiumOrder = [1, 0, 2]; 

    return (
        <div className="min-h-screen bg-[#0d0e10] font-sans text-white pb-20 relative overflow-x-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/20 via-purple-900/10 to-transparent pointer-events-none"></div>

            {/* Header */}
            <div className="p-4 flex items-center justify-between relative z-10">
                <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-full backdrop-blur-md">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-black tracking-widest italic uppercase text-shadow-lg">Leaderboard</h1>
                <div className="w-10"></div>
            </div>

            {/* Podium Section */}
            <div className="flex justify-center items-end gap-2 px-4 mt-8 mb-10 h-72">
                {podiumOrder.map(idx => {
                    const entry = entries[idx];
                    if (!entry) return null;
                    const isFirst = idx === 0;
                    const isSecond = idx === 1;
                    const isThird = idx === 2;
                    
                    return (
                        <div key={idx} className={`flex flex-col items-center flex-1 transition-all ${isFirst ? 'scale-110 z-20 -mb-2' : 'scale-90 z-10'}`}>
                            {/* Rank Badge */}
                            <div className={`relative mb-3`}>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${isFirst ? 'border-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : isSecond ? 'border-gray-300 bg-gray-300/20' : 'border-orange-500 bg-orange-500/20'}`}>
                                    <span className="font-black text-xl italic">{idx + 1}</span>
                                </div>
                                {/* Wreath (Simplified SVG) */}
                                <div className="absolute -inset-2 opacity-50 pointer-events-none">
                                    <Crown className={`w-full h-full ${isFirst ? 'text-yellow-400' : isSecond ? 'text-gray-300' : 'text-orange-500'}`} />
                                </div>
                            </div>

                            {/* Avatar Container */}
                            <div className={`w-20 h-20 rounded-2xl overflow-hidden border-4 ${isFirst ? 'border-yellow-400' : 'border-white/20'} shadow-2xl bg-[#1b1c1d] p-1`}>
                                <img 
                                    src={entry.gender === 'male' ? MALE_AVATAR : FEMALE_AVATAR} 
                                    className="w-full h-full object-cover rounded-xl" 
                                    alt="avatar" 
                                />
                            </div>

                            <div className="text-center mt-3">
                                <p className="text-[10px] font-black uppercase tracking-tight truncate w-24 opacity-80">{entry.name}</p>
                                <p className="text-sm font-black text-white flex items-center justify-center gap-1">
                                    <Diamond size={10} className="text-blue-400" />
                                    {entry.amount.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* List Section */}
            <div className="px-6 relative z-10">
                <div className="bg-[#16171a] rounded-[2.5rem] border border-white/5 shadow-2xl p-6 space-y-4">
                    <div className="flex justify-center mb-6">
                        <div className="w-12 h-1 bg-green-500 rounded-full animate-pulse"></div>
                    </div>

                    {list.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 p-1 border border-white/10">
                                    <img src={entry.gender === 'male' ? MALE_AVATAR : FEMALE_AVATAR} className="w-full h-full object-cover rounded-lg" alt="ava" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-white group-hover:text-gold-400 transition-colors">{entry.name}</h3>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold">
                                        <Diamond size={8} className="text-blue-400" />
                                        <span>{entry.amount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full border-2 border-yellow-500/20 flex items-center justify-center">
                                    <span className="text-[10px] font-black text-yellow-500 italic">{i + 4}th</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-center mt-8 text-[10px] text-gray-700 font-black uppercase tracking-[0.3em]">
                Updated every week
            </div>
        </div>
    );
};
