import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { getUserProfile, updateUserBalance, placeWingoBet, cleanupWingoData, getWingoNextResult } from '../../services/userService';
import { UserProfile } from '../../types';
import { History, ChevronLeft, AlertCircle } from 'lucide-react';
import { ref, onValue, runTransaction, get, limitToLast, query } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { WinLossPopup } from '../../components/WinLossPopup';

declare global {
  interface Window {
    activeBets: any[];
  }
}

// Types
type BetType = 'green' | 'violet' | 'red' | 'big' | 'small' | number;
interface GameResult {
    period: number;
    number: number;
    color: string;
    size: 'big' | 'small';
}

interface StagedBet {
    amount: number;
    selection: BetType;
    uid: string;
}

// Hardcoded to 1min only
const WINGO_INTERVAL = 60; 
const WINGO_TAB = '1min';

export const Wingo = () => {
    const navigate = useNavigate();
    
    // Time & Period State
    const [timeLeft, setTimeLeft] = useState(0);
    const [period, setPeriod] = useState(0);

    const [user, setUser] = useState<UserProfile | null>(null);
    const [history, setHistory] = useState<GameResult[]>([]);
    
    // Betting State
    const [betModalOpen, setBetModalOpen] = useState(false);
    const [selectedBet, setSelectedBet] = useState<BetType | null>(null);
    const [contractMoney, setContractMoney] = useState(1);
    const [multiplier, setMultiplier] = useState(1);
    
    // Animation
    const [isAnimating, setIsAnimating] = useState(false);
    const [gameResult, setGameResult] = useState<number | null>(null);
    
    // Win/Loss Popup
    const [popup, setPopup] = useState<{type: 'win' | 'loss', amount: number} | null>(null);

    // Refs
    const userRef = useRef(user);
    const periodRef = useRef(0);
    const processedPeriodRef = useRef<number | null>(null);

    useEffect(() => {
        const u = auth.currentUser;
        if(u) {
            const userRef = ref(db, `users/${u.uid}`);
            const unsub = onValue(userRef, (snap) => {
                if (snap.exists()) {
                    setUser(snap.val());
                }
            });
            return () => unsub();
        }
    }, []);

    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { periodRef.current = period; }, [period]);

    // --- Time Synchronization Logic ---
    const calculateTimeState = () => {
        const now = new Date();
        const interval = WINGO_INTERVAL;
        
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const currentMs = now.getTime();
        const diffSeconds = Math.floor((currentMs - startOfDay) / 1000);
        
        const periodIndex = Math.floor(diffSeconds / interval);
        const secondsRemaining = interval - (diffSeconds % interval);
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const idx = String(periodIndex + 1).padStart(4, '0');
        
        const periodId = Number(`${year}${month}${day}${idx}`);

        return { periodId, secondsRemaining };
    };

    useEffect(() => {
        const tick = () => {
            const { periodId, secondsRemaining } = calculateTimeState();
            
            setTimeLeft(secondsRemaining);
            
            if (periodId !== periodRef.current) {
                if (periodRef.current !== 0) {
                    handlePeriodComplete(periodRef.current);
                }
                setPeriod(periodId);
            }
        };

        tick();
        const timerId = setInterval(tick, 1000); 
        return () => clearInterval(timerId);
    }, []);

    useEffect(() => {
        // Query last 10 history items
        const historyRef = query(ref(db, `game_history/wingo/${WINGO_TAB}`), limitToLast(10));
        const unsub = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const arr = Object.values(data) as GameResult[];
                const validArr = arr.filter(item => item && item.period);
                validArr.sort((a, b) => b.period - a.period);
                setHistory(validArr);
            } else {
                setHistory([]);
            }
        });
        return () => unsub();
    }, []);

    const calculateTotalPayout = (candidateNum: number, bets: StagedBet[]) => {
        let totalPayout = 0;
        
        // Winning Conditions Logic
        // Green: 1,3,5,7,9 (5 is Green+Violet)
        // Red: 0,2,4,6,8 (0 is Red+Violet)
        // Violet: 0,5
        // Small: 0-4
        // Big: 5-9

        const isGreen = [1,3,5,7,9].includes(candidateNum);
        const isRed = [0,2,4,6,8].includes(candidateNum);
        const isViolet = candidateNum === 0 || candidateNum === 5;
        const isBig = candidateNum >= 5;
        const isSmall = candidateNum <= 4;

        for (const bet of bets) {
            let winMultiplier = 0;
            const sel = bet.selection;

            // Robust number check: handle both number type and string numbers (e.g. "5")
            // A bet is a number bet if it's not one of the special strings
            const isNumberBet = !isNaN(Number(sel)) && !['green', 'violet', 'red', 'big', 'small'].includes(String(sel));

            if (isNumberBet) {
                if (Number(sel) === candidateNum) winMultiplier = 9;
            } else if (sel === 'big' && isBig) {
                winMultiplier = 1.9;
            } else if (sel === 'small' && isSmall) {
                winMultiplier = 1.9;
            } else if (sel === 'green' && isGreen) {
                winMultiplier = 1.9;
            } else if (sel === 'red' && isRed) {
                winMultiplier = 1.9;
            } else if (sel === 'violet' && isViolet) {
                winMultiplier = 4;
            }

            totalPayout += bet.amount * winMultiplier;
        }
        return totalPayout;
    };

    const handlePeriodComplete = async (completedPeriod: number) => {
        if (processedPeriodRef.current === completedPeriod) return;
        processedPeriodRef.current = completedPeriod;

        const stageRef = ref(db, `wingo_stage_bets/${WINGO_TAB}/${completedPeriod}`);
        const resultRef = ref(db, `game_history/wingo/${WINGO_TAB}/${completedPeriod}`);

        try {
            await runTransaction(resultRef, (currentData) => {
                if (currentData !== null) return;
                return { status: "calculating" };
            });

            const checkSnap = await get(resultRef);
            const val = checkSnap.val();

            if (val && val.status === "calculating") {
                const betsSnap = await get(stageRef);
                const bets = betsSnap.exists() ? (Object.values(betsSnap.val()) as StagedBet[]) : [];
                
                const forcedResult = await getWingoNextResult();
                let winnerNum: number | null = null;
                
                if (forcedResult !== null && forcedResult >= 0 && forcedResult <= 9) {
                     winnerNum = forcedResult;
                } else if (bets.length === 0) {
                     winnerNum = Math.floor(Math.random() * 10);
                } else {
                     // AUTOMATED SELECTION: Choose number with lowest total payout
                     let minPayout = Infinity;
                     let candidates: number[] = [];
                     
                     // Check every possible result (0-9)
                     for (let i = 0; i <= 9; i++) {
                         const payout = calculateTotalPayout(i, bets);
                         if (payout < minPayout) {
                             minPayout = payout;
                             candidates = [i];
                         } else if (payout === minPayout) {
                             candidates.push(i);
                         }
                     }
                     // Pick random from best candidates
                     winnerNum = candidates[Math.floor(Math.random() * candidates.length)];
                }

                if (winnerNum !== null) {
                    const color = winnerNum === 0 ? 'red-violet' : winnerNum === 5 ? 'green-violet' : [1,3,7,9].includes(winnerNum) ? 'green' : 'red';
                    const size = winnerNum >= 5 ? 'big' : 'small';

                    const finalResult: GameResult = {
                        period: completedPeriod,
                        number: winnerNum,
                        color,
                        size
                    };
                    await runTransaction(resultRef, () => finalResult);
                }
                cleanupWingoData(WINGO_TAB, completedPeriod);
            }
            
            const finalSnap = await get(resultRef);
            if (finalSnap.exists() && finalSnap.val().number !== undefined) {
                 setIsAnimating(true);
                 const res = finalSnap.val() as GameResult;
                 setGameResult(res.number);
                 checkWins(res, completedPeriod);
            }

        } catch (e) {
            console.error("Round processing error", e);
        }

        setTimeout(() => {
            setIsAnimating(false);
            setGameResult(null);
        }, 4000);
    };

    const checkWins = (result: GameResult, periodNum: number) => {
        if (!window.activeBets) return;

        const currentPeriodBets = window.activeBets.filter((b: any) => b.period === periodNum);
        let totalWin = 0;
        let totalBetAmount = 0;

        const resNum = result.number;
        const isGreen = [1,3,5,7,9].includes(resNum);
        const isRed = [0,2,4,6,8].includes(resNum);
        const isViolet = resNum === 0 || resNum === 5;
        const isBig = resNum >= 5;
        const isSmall = resNum <= 4;

        currentPeriodBets.forEach((bet: any) => {
            totalBetAmount += bet.amount;
            let winAmount = 0;
            let multiplier = 0;
            const sel = bet.selection;

            // Robust check similar to payout calculation
            const isNumberBet = !isNaN(Number(sel)) && !['green', 'violet', 'red', 'big', 'small'].includes(String(sel));

            if (isNumberBet) {
                if (Number(sel) === resNum) multiplier = 9;
            } else if (sel === 'big' && isBig) {
                multiplier = 1.9;
            } else if (sel === 'small' && isSmall) {
                multiplier = 1.9;
            } else if (sel === 'green' && isGreen) {
                multiplier = 1.9;
            } else if (sel === 'red' && isRed) {
                multiplier = 1.9;
            } else if (sel === 'violet' && isViolet) {
                multiplier = 4;
            }

            if (multiplier > 0) {
                winAmount = bet.amount * multiplier;
                totalWin += winAmount;
            }
        });

        if (totalWin > 0) {
            if(userRef.current) {
                updateUserBalance(userRef.current.uid, userRef.current.balance + totalWin);
            }
            setPopup({ type: 'win', amount: totalWin });
        } else if (currentPeriodBets.length > 0) {
            setPopup({ type: 'loss', amount: totalBetAmount });
        }

        window.activeBets = window.activeBets.filter((b: any) => b.period !== periodNum);
    };

    const openBetModal = (selection: BetType) => {
        if (timeLeft <= 5) {
            alert("Betting is closed for this round!");
            return;
        }
        setSelectedBet(selection);
        setContractMoney(1);
        setMultiplier(1);
        setBetModalOpen(true);
    };

    const confirmBet = async () => {
        if (timeLeft <= 5) {
            alert("Betting is closed!");
            return;
        }
        if (!user || selectedBet === null) return;
        const totalBet = contractMoney * multiplier;
        
        if (user.balance < totalBet) {
            alert("Insufficient Balance");
            return;
        }
        
        const res = await placeWingoBet(user.uid, totalBet, selectedBet, period, WINGO_TAB);
        if (!res.success) {
            alert(res.error);
            return;
        }
        
        setBetModalOpen(false);

        const pendingBet = {
            selection: selectedBet,
            amount: totalBet,
            period: period 
        };
        
        window.activeBets = window.activeBets || [];
        window.activeBets.push(pendingBet);
    };

    const getBallClass = (num: number) => {
        const base = "w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg mb-2 transform active:scale-95 transition cursor-pointer border-2 border-white/20";
        if (num === 0) return `${base} bg-gradient-to-br from-red-500 via-purple-500 to-purple-700`;
        if (num === 5) return `${base} bg-gradient-to-br from-green-500 via-purple-500 to-purple-700`;
        if ([1, 3, 7, 9].includes(num)) return `${base} bg-green-500`;
        return `${base} bg-red-500`;
    };

    return (
        <div className="min-h-screen bg-[#f7f8ff] pb-20 font-sans">
            <div className="bg-[#d93025] text-white p-4 pb-10 rounded-b-3xl relative overflow-hidden shadow-lg">
                <div className="flex justify-between items-start mb-4">
                    <button onClick={() => navigate('/')}><ChevronLeft /></button>
                    <div>
                        <h1 className="text-2xl font-bold">Win Go</h1>
                        <div className="bg-black/20 backdrop-blur px-3 py-1 rounded-full text-sm mt-1 inline-flex items-center gap-2">
                             <span>₹ {(user?.balance || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         <div className="flex flex-col items-center">
                            <History size={20} />
                            <span className="text-[10px]">History</span>
                         </div>
                    </div>
                </div>
                
                <div className="bg-white/10 p-2 rounded-xl flex justify-center mb-4 border border-white/10">
                    <span className="text-white font-bold text-sm uppercase tracking-widest">1 Minute Speed Mode</span>
                </div>

                <div className="bg-white rounded-xl p-4 flex justify-between items-center text-black relative shadow-lg">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Period</span>
                        </div>
                        <div className="font-bold text-lg text-gray-900">{period}</div>
                    </div>

                    <div className="absolute left-1/2 top-4 bottom-4 w-px border-l border-dashed border-gray-300 transform -translate-x-1/2"></div>

                    <div className="text-right">
                        <div className="text-xs text-gray-500 font-bold mb-1">Time remaining</div>
                        <div className="flex gap-1 justify-end">
                            <div className="bg-[#f3f4f6] text-[#d93025] font-black text-xl w-8 h-10 flex items-center justify-center rounded">
                                {Math.floor(timeLeft / 60).toString().padStart(1, '0')}
                            </div>
                            <div className="flex items-center text-[#d93025] font-bold">:</div>
                            <div className="bg-[#f3f4f6] text-[#d93025] font-black text-xl w-8 h-10 flex items-center justify-center rounded">
                                {Math.floor((timeLeft % 60) / 10)}
                            </div>
                            <div className="bg-[#f3f4f6] text-[#d93025] font-black text-xl w-8 h-10 flex items-center justify-center rounded">
                                {(timeLeft % 60) % 10}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Betting Closed Overlay for last 5 seconds */}
                {timeLeft <= 5 && (
                    <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center rounded-b-3xl backdrop-blur-[2px]">
                         <div className="bg-red-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 animate-pulse shadow-lg">
                             <AlertCircle size={20} /> BETTING CLOSED
                         </div>
                    </div>
                )}
            </div>

            <div className="p-4 -mt-6 relative z-10">
                <div className="bg-white rounded-2xl shadow-xl p-5">
                    <div className="flex justify-between gap-4 mb-6">
                        <button onClick={() => openBetModal('green')} className="flex-1 bg-[#10b981] text-white py-3 rounded-tr-2xl rounded-bl-2xl font-bold shadow-lg shadow-green-200 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed">Green</button>
                        <button onClick={() => openBetModal('violet')} className="flex-1 bg-[#8b5cf6] text-white py-3 rounded-lg font-bold shadow-lg shadow-purple-200 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed">Violet</button>
                        <button onClick={() => openBetModal('red')} className="flex-1 bg-[#ef4444] text-white py-3 rounded-tl-2xl rounded-br-2xl font-bold shadow-lg shadow-red-200 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed">Red</button>
                    </div>

                    <div className="grid grid-cols-5 gap-y-4 justify-items-center mb-6 bg-[#f7f8ff] p-4 rounded-xl">
                        {[0,1,2,3,4,5,6,7,8,9].map(num => (
                            <div key={num} onClick={() => openBetModal(num)} className="flex flex-col items-center group">
                                <div className={getBallClass(num)}>
                                    {num}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4">
                         <button onClick={() => openBetModal('big')} className="flex-1 bg-[#fbbf24] text-white py-3 rounded-full font-bold shadow-lg active:scale-95 transition text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">Big</button>
                         <button onClick={() => openBetModal('small')} className="flex-1 bg-[#60a5fa] text-white py-3 rounded-full font-bold shadow-lg active:scale-95 transition text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">Small</button>
                    </div>
                </div>
            </div>

             {/* Recent History Table */}
             <div className="px-4 pb-4">
                 <div className="bg-white rounded-xl shadow-lg p-4">
                     <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
                        <History size={18} /> Round History (Last 10)
                     </h3>
                     <div className="overflow-hidden rounded-lg border border-gray-100">
                         <table className="w-full text-center text-xs">
                             <thead className="bg-gray-50 text-gray-500 font-bold">
                                 <tr>
                                     <th className="p-2">Period</th>
                                     <th className="p-2">Number</th>
                                     <th className="p-2">Big/Small</th>
                                       <th className="p-2">Color</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-100">
                                 {history.map((item) => (
                                     <tr key={item.period} className="hover:bg-gray-50">
                                         <td className="p-2 text-gray-600 font-mono">{item.period.toString().slice(-4)}</td>
                                         <td className={`p-2 font-bold text-lg ${[1,3,7,9].includes(item.number) ? 'text-green-500' : [2,4,6,8].includes(item.number) ? 'text-red-500' : 'text-purple-500'}`}>{item.number}</td>
                                         <td className="p-2 capitalize text-gray-600 font-bold">{item.size}</td>
                                         <td className="p-2 flex justify-center gap-1">
                                             {item.color.split('-').map(c => (
                                                 <div key={c} className={`w-3 h-3 rounded-full ${c === 'green' ? 'bg-green-500' : c === 'red' ? 'bg-red-500' : 'bg-purple-500'}`}></div>
                                             ))}
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 </div>
             </div>

            {/* Betting Modal */}
            {betModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl animate-slide-up">
                        <div className="text-center mb-6">
                            <h3 className="font-bold text-xl text-gray-800 uppercase tracking-widest">
                                Select {typeof selectedBet === 'string' ? selectedBet : `Number ${selectedBet}`}
                            </h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Balance Options</p>
                                <div className="flex gap-2">
                                    {[1, 10, 100, 1000].map(amt => (
                                        <button 
                                            key={amt}
                                            onClick={() => setContractMoney(amt)}
                                            className={`flex-1 py-2 rounded-lg font-bold text-sm border transition ${contractMoney === amt ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                        >
                                            {amt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Quantity</p>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setMultiplier(Math.max(1, multiplier - 1))} className="w-10 h-10 bg-gray-200 rounded-lg text-xl font-bold">-</button>
                                    <div className="flex-1 bg-gray-100 rounded-lg h-10 flex items-center justify-center font-bold text-lg border border-gray-200">
                                        {multiplier}
                                    </div>
                                    <button onClick={() => setMultiplier(multiplier + 1)} className="w-10 h-10 bg-gray-200 rounded-lg text-xl font-bold">+</button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                     {[1, 5, 10, 20, 50, 100].map(mul => (
                                         <button key={mul} onClick={() => setMultiplier(mul)} className={`px-2 py-1 rounded text-xs font-bold ${multiplier === mul ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>X{mul}</button>
                                     ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <div>
                                    <p className="text-xs text-gray-500">Total Bet</p>
                                    <p className="text-2xl font-black text-[#d93025]">₹{contractMoney * multiplier}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setBetModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100">Cancel</button>
                                    <button onClick={confirmBet} className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#d93025] to-red-600 shadow-lg shadow-red-500/30">Confirm</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isAnimating && (
                <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center animate-fade-in">
                    <div className="text-white text-center">
                         <div className="text-6xl animate-bounce mb-4">🎲</div>
                         <h2 className="text-2xl font-bold animate-pulse">Drawing Result...</h2>
                         {gameResult !== null && (
                             <div className="text-9xl font-black mt-8 text-[#d93025] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                                {gameResult}
                             </div>
                         )}
                    </div>
                </div>
            )}

            {popup && (
                <WinLossPopup 
                    type={popup.type} 
                    amount={popup.amount} 
                    onClose={() => setPopup(null)} 
                />
            )}
        </div>
    );
};
                
