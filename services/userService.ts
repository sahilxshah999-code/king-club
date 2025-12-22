import { ref, get, set, update, push, runTransaction, query, orderByChild, equalTo, remove, limitToLast } from 'firebase/database';
import { db } from '../firebase';
import { UserProfile, Transaction, SystemSettings, Notification, ActivityTask } from '../types';

export const generateNumericId = () => Math.floor(100000 + Math.random() * 900000).toString();

export const addBonusAmount = (user: UserProfile, amount: number) => {
    user.bonusBalance = (user.bonusBalance || 0) + amount;
    user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
};

// Helper to update balance directly via transaction
export const updateUserBalance = async (uid: string, balance: number) => {
    await update(ref(db, `users/${uid}`), { balance });
};

export const getUidFromReferralCode = async (code: string): Promise<string | null> => {
    if (!code) return null;
    const q = query(ref(db, 'users'), orderByChild('referralCode'), equalTo(code.toUpperCase()));
    const snap = await get(q);
    if (!snap.exists()) return null;
    return Object.keys(snap.val())[0];
};

export const createUserProfile = async (uid: string, email: string, name: string, referCode?: string) => {
    const numericId = generateNumericId();
    const ownReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    let finalReferredBy: string | undefined = undefined;
    
    // Process Referral
    if (referCode) {
        const referrerUid = await getUidFromReferralCode(referCode);
        if (referrerUid) {
            finalReferredBy = referCode.toUpperCase();
            
            // 1. Give Fixed Referral Bonus to Referrer
            const settings = await getSystemSettings();
            // Use 0 as default if undefined
            const bonus = Number(settings.referralBonus) || 0;
            
            if (bonus > 0) {
                await runTransaction(ref(db, `users/${referrerUid}`), (referrer: UserProfile | null) => {
                    if (!referrer) return null;
                    referrer.referralCount = (referrer.referralCount || 0) + 1;
                    referrer.referralEarnings = (referrer.referralEarnings || 0) + bonus;
                    addBonusAmount(referrer, bonus);
                    return referrer;
                });
                
                await createTransaction({
                    uid: referrerUid,
                    type: 'referral_bonus',
                    amount: bonus,
                    status: 'completed',
                    details: `Invite Bonus: ${name} (${numericId})`,
                    method: 'SYSTEM'
                });
            }
        }
    }

    const newUser: UserProfile = {
        uid, email, displayName: name, numericId, role: 'user',
        balance: 0, depositBalance: 0, winningBalance: 0, bonusBalance: 0,
        vipLevel: 0, totalWagered: 0, totalDeposited: 0, referralCode: ownReferralCode,
        referredBy: finalReferredBy, createdAt: Date.now(),
        hasSeenWelcome: false, completedActivities: [], claimedLevelUpRewards: [],
        referralCount: 0, referralEarnings: 0
    };
    
    await set(ref(db, `users/${uid}`), newUser);
    return newUser;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const snap = await get(ref(db, `users/${uid}`));
    return snap.exists() ? snap.val() : null;
};

export const findUserByNumericId = async (id: string): Promise<UserProfile | null> => {
    const q = query(ref(db, 'users'), orderByChild('numericId'), equalTo(id));
    const snap = await get(q);
    if (!snap.exists()) return null;
    return Object.values(snap.val())[0] as UserProfile;
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
    const snap = await get(ref(db, 'system_settings'));
    return snap.exists() ? snap.val() : {} as any;
};

export const updateSystemSettings = async (settings: SystemSettings) => {
    await set(ref(db, 'system_settings'), settings);
};

export const createTransaction = async (tx: Partial<Transaction>) => {
    const newTxRef = push(ref(db, 'transactions'));
    const transaction = { id: newTxRef.key, timestamp: Date.now(), status: 'pending', ...tx };
    await set(newTxRef, transaction);
    return transaction;
};

export const publishNotification = async (title: string, content: string, targetUid?: string) => {
    const newRef = push(ref(db, 'notifications'));
    await set(newRef, { id: newRef.key, title, content, targetUid, timestamp: Date.now() });
};

export const manualTransfer = async (targetNumericId: string, amount: number, message: string) => {
    const user = await findUserByNumericId(targetNumericId);
    if (!user) throw new Error("User ID not found");
    
    const finalMessage = processPlaceholders(message, user);

    await runTransaction(ref(db, `users/${user.uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        addBonusAmount(u, amount);
        return u;
    });
    await createTransaction({ uid: user.uid, userNumericId: targetNumericId, type: 'manual_transfer', amount, status: 'completed', details: finalMessage });
    await publishNotification("Reward Received", finalMessage, user.uid);
};

export const settleActivityForUser = async (targetNumericId: string, activityId: string, amount: number, message: string) => {
    const user = await findUserByNumericId(targetNumericId);
    if (!user) throw new Error("User ID not found");
    await runTransaction(ref(db, `users/${user.uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        addBonusAmount(u, amount);
        const completed = u.completedActivities || [];
        if (!completed.includes(activityId)) u.completedActivities = [...completed, activityId];
        return u;
    });
    await createTransaction({ uid: user.uid, userNumericId: targetNumericId, type: 'manual_transfer', amount, status: 'completed', details: `Activity: ${message}` });
    await publishNotification("Activity Completed!", `You received ₹${amount} for task completion.`, user.uid);
};

export const redeemGiftCode = async (uid: string, code: string) => {
    const codeRef = ref(db, `promo_codes/${code.toUpperCase()}`);
    const codeSnap = await get(codeRef);
    
    if (!codeSnap.exists()) throw new Error("Invalid Code");
    
    const promo = codeSnap.val();
    if (Date.now() > promo.expiresAt) throw new Error("Code Expired");
    
    const usedBy = promo.usedBy || [];
    if (usedBy.includes(uid)) throw new Error("Already Redeemed");
    if (usedBy.length >= promo.maxUsers) throw new Error("Code limit reached");

    const userSnap = await get(ref(db, `users/${uid}`));
    const user = userSnap.val() as UserProfile;

    if (promo.minDepReq && (user.totalDeposited || 0) < promo.minDepAmount) {
        throw new Error(`Deposit at least ₹${promo.minDepAmount} to use this code`);
    }

    // Apply Reward
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        addBonusAmount(u, promo.amount);
        return u;
    });

    // Update Promo Usage
    await runTransaction(codeRef, (p: any) => {
        if (!p) return null;
        if (!p.usedBy) p.usedBy = [];
        p.usedBy.push(uid);
        return p;
    });

    // Process Message with NEW state (simulate new balance)
    const tempUser = { ...user, bonusBalance: (user.bonusBalance || 0) + promo.amount, balance: user.balance + promo.amount };
    const finalMessage = processPlaceholders(promo.message || `Redeemed: ${code}`, tempUser);

    await createTransaction({ 
        uid, type: 'gift_code', amount: promo.amount, status: 'completed', 
        details: finalMessage, method: 'SYSTEM' 
    });

    return { amount: promo.amount, message: finalMessage };
};

export const claimLevelUpBonus = async (uid: string, levelIndex: number) => {
    const settings = await getSystemSettings();
    const reward = settings.vipLevelUpRewards?.[levelIndex] || 0;
    
    if (reward <= 0) throw new Error("No reward for this level");

    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        if (u.vipLevel < levelIndex) return; 
        const claimed = u.claimedLevelUpRewards || [];
        if (claimed.includes(levelIndex)) return; 

        addBonusAmount(u, reward);
        u.claimedLevelUpRewards = [...claimed, levelIndex];
        return u;
    });
    
    await createTransaction({
        uid, type: 'level_up_bonus', amount: reward, status: 'completed',
        details: `VIP Level ${levelIndex} Bonus`, method: 'SYSTEM'
    });

    return reward;
};

export const markWelcomeAsSeen = async (uid: string) => {
    await update(ref(db, `users/${uid}`), { hasSeenWelcome: true });
};

export const processPlaceholders = (text: string, user: UserProfile) => {
    if(!text) return '';
    return text
        .replace(/#username/g, user.displayName || 'User')
        .replace(/#userid/g, user.numericId || '')
        .replace(/#userclaim/g, user.lastDailyClaim || 'Never')
        .replace(/#totaldeposit/g, (user.totalDeposited || 0).toFixed(2))
        .replace(/#lastdeposit/g, (user.lastDepositAmount || 0).toFixed(2))
        .replace(/#balance/g, (user.balance || 0).toFixed(2))
        .replace(/#winbalance/g, (user.winningBalance || 0).toFixed(2))
        .replace(/#referearn/g, (user.referralEarnings || 0).toFixed(2))
        .replace(/#refercount/g, (user.referralCount || 0).toString())
        .replace(/#referby/g, user.referredBy || 'None')
        .replace(/#email/g, user.email || '')
        .replace(/#bonus/g, (user.bonusBalance || 0).toFixed(2))
        .replace(/#bet/g, (user.totalWagered || 0).toFixed(2))
        .replace(/#vip/g, (user.vipLevel || 0).toString())
        
        // Backward compatibility
        .replace(/{name}/g, user.displayName || 'User')
        .replace(/{id}/g, user.numericId || '')
        .replace(/{balance}/g, (user.balance || 0).toFixed(2));
};

export const claimDailyReward = async (uid: string) => {
    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) throw new Error("User not found");
    const user = snap.val() as UserProfile;
    const today = new Date().toDateString();
    if (user.lastDailyClaim === today) throw new Error("Already claimed today");
    
    const settings = await getSystemSettings();
    const reward = (settings.vipDailyRewards && settings.vipDailyRewards[user.vipLevel]) || 5;
    
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        u.lastDailyClaim = today;
        addBonusAmount(u, reward);
        return u;
    });
    return reward;
};

// ... [Games logic skipped for brevity, standard placeBet etc] ...
export const placeBet = async (uid: string, amount: number) => {
    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) return { success: false, error: "User not found" };
    const user = snap.val();
    if (user.balance < amount) return { success: false, error: "Insufficient balance" };
    await update(ref(db, `users/${uid}`), { 
        balance: user.balance - amount,
        totalWagered: (user.totalWagered || 0) + amount 
    });
    return { success: true };
};

// ... [Include all previous game functions here: processSpin, playRoulette, etc. unchanged] ...
export const processSpin = async (uid: string, amount: number) => {
    const res = await placeBet(uid, amount);
    if (!res.success) return res;
    const settings = await getSystemSettings();
    const prizes = settings.spinPrizes || [10, 0, 50, 0, 100, 0, 500, 0];
    const index = Math.floor(Math.random() * prizes.length);
    const prizeValue = prizes[index];
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        if (prizeValue > 0) u.winningBalance = (u.winningBalance || 0) + prizeValue;
        u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
        return u;
    });
    const updatedUser = await getUserProfile(uid);
    return { success: true, prizeIndex: index, prizeValue, newBalance: updatedUser?.balance };
};

export const playRoulette = async (uid: string, bets: any[]) => {
    const totalBet = bets.reduce((a, b) => a + b.amount, 0);
    const res = await placeBet(uid, totalBet);
    if (!res.success) return res;
    const resultNum = Math.floor(Math.random() * 37);
    let totalWin = 0;
    const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const isRed = RED_NUMBERS.includes(resultNum);
    bets.forEach(bet => {
        if (bet.type === 'number' && Number(bet.value) === resultNum) totalWin += bet.amount * 35;
        else if (bet.type === 'color' && bet.value === 'red' && isRed) totalWin += bet.amount * 2;
        else if (bet.type === 'color' && bet.value === 'black' && !isRed && resultNum !== 0) totalWin += bet.amount * 2;
        else if (bet.type === 'parity' && bet.value === 'even' && resultNum % 2 === 0 && resultNum !== 0) totalWin += bet.amount * 2;
        else if (bet.type === 'parity' && bet.value === 'odd' && resultNum % 2 !== 0) totalWin += bet.amount * 2;
    });
    if (totalWin > 0) {
        await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
            if (!u) return null;
            u.winningBalance = (u.winningBalance || 0) + totalWin;
            u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
            return u;
        });
    }
    const updatedUser = await getUserProfile(uid);
    return { success: true, resultNumber: resultNum, totalWin, newBalance: updatedUser?.balance };
};

export const playDragonTiger = async (uid: string, zone: string, amount: number) => {
    const res = await placeBet(uid, amount);
    if (!res.success) return res;
    const dragonCard = Math.floor(Math.random() * 13) + 1;
    const tigerCard = Math.floor(Math.random() * 13) + 1;
    let winAmount = 0;
    if (dragonCard > tigerCard && zone === 'dragon') winAmount = amount * 2;
    else if (tigerCard > dragonCard && zone === 'tiger') winAmount = amount * 2;
    else if (dragonCard === tigerCard && zone === 'tie') winAmount = amount * 8;
    if (winAmount > 0) {
        await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
            if (!u) return null;
            u.winningBalance = (u.winningBalance || 0) + winAmount;
            u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
            return u;
        });
    }
    const updatedUser = await getUserProfile(uid);
    return { success: true, dragonCard, tigerCard, winAmount, newBalance: updatedUser?.balance };
};

export const startMinesGame = async (uid: string, betAmount: number, minesCount: number) => {
    const res = await placeBet(uid, betAmount);
    if (!res.success) return res;
    const mines = new Set<number>();
    while(mines.size < minesCount) mines.add(Math.floor(Math.random() * 25));
    await set(ref(db, `active_games/mines/${uid}`), {
        status: 'ACTIVE', betAmount, minesCount, mines: Array.from(mines), revealed: [], timestamp: Date.now()
    });
    return { success: true };
};

export const revealMinesTile = async (uid: string, index: number) => {
    const snap = await get(ref(db, `active_games/mines/${uid}`));
    if (!snap.exists()) return { success: false, error: "Game not found" };
    const game = snap.val();
    if (game.mines.includes(index)) {
        await update(ref(db, `active_games/mines/${uid}`), { status: 'LOST' });
        const fullGrid = Array(25).fill(0);
        game.mines.forEach((m: number) => fullGrid[m] = 1);
        return { success: true, type: 'mine', fullGrid };
    }
    const revealed = [...(game.revealed || []), index];
    await update(ref(db, `active_games/mines/${uid}`), { revealed });
    let mult = 1.0;
    for(let i=0; i<revealed.length; i++) {
        mult = mult * ((25 - i) / (25 - game.minesCount - i));
    }
    mult = mult * 0.95; 
    return { success: true, type: 'gem', multiplier: mult, payout: game.betAmount * mult };
};

export const cashOutMines = async (uid: string) => {
    const snap = await get(ref(db, `active_games/mines/${uid}`));
    if (!snap.exists()) return { success: false, error: "Game not found" };
    const game = snap.val();
    let mult = 1.0;
    for(let i=0; i<game.revealed.length; i++) {
        mult = mult * ((25 - i) / (25 - game.minesCount - i));
    }
    mult = mult * 0.95;
    const amount = game.betAmount * mult;
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        u.winningBalance = (u.winningBalance || 0) + amount;
        u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
        return u;
    });
    await remove(ref(db, `active_games/mines/${uid}`));
    return { success: true, amount };
};

export const placeWingoBet = async (uid: string, amount: number, selection: any, period: number, tab: string) => {
    const res = await placeBet(uid, amount);
    if (!res.success) return res;
    const stageRef = push(ref(db, `wingo_stage_bets/${tab}/${period}`));
    await set(stageRef, { uid, amount, selection, timestamp: Date.now() });
    return { success: true };
};

export const cleanupWingoData = async (tab: string, period: number) => {
    await remove(ref(db, `wingo_stage_bets/${tab}/${period}`));
};


export const getWingoNextResult = async () => {
    const snap = await get(ref(db, 'admin_settings/wingo_next_result'));
    return snap.exists() ? snap.val() : null;
};

export const settleUserWingoRound = async (uid: string, period: number, resultNum: number) => {
    const historyRef = push(ref(db, `users/${uid}/wingo_history`));
    await set(historyRef, { period, resultNum, timestamp: Date.now() });
};

export const startChickenRoadGame = async (uid: string, betAmount: number, difficulty: string) => {
    const res = await placeBet(uid, betAmount);
    if (!res.success) return res;
    await set(ref(db, `active_games/chickenroad/${uid}`), {
        status: 'ACTIVE', betAmount, difficulty, stage: 0, timestamp: Date.now()
    });
    return { success: true };
};

export const advanceChickenRoad = async (uid: string) => {
    const snap = await get(ref(db, `active_games/chickenroad/${uid}`));
    const game = snap.val();
    const prob = game.difficulty === 'EASY' ? 0.9 : game.difficulty === 'MEDIUM' ? 0.8 : 0.6;
    if (Math.random() > prob) {
        await update(ref(db, `active_games/chickenroad/${uid}`), { status: 'LOST' });
        return { success: true, hit: true };
    }
    const newStage = game.stage + 1;
    await update(ref(db, `active_games/chickenroad/${uid}`), { stage: newStage });
    return { success: true, hit: false, newStage };
};

export const cashOutChickenRoad = async (uid: string, mult: number) => {
    const snap = await get(ref(db, `active_games/chickenroad/${uid}`));
    const game = snap.val();
    const amount = game.betAmount * mult;
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        u.winningBalance = (u.winningBalance || 0) + amount;
        u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
        return u;
    });
    await remove(ref(db, `active_games/chickenroad/${uid}`));
    return { success: true, amount };
};

export const playPlinko = async (uid: string, betAmount: number, balls: number, risk: string, rows: number) => {
    const total = betAmount * balls;
    const res = await placeBet(uid, total);
    if (!res.success) return res;
    const results = Array.from({length: balls}, () => {
        const path = Array.from({length: rows}, () => Math.random() > 0.5 ? 1 : 0);
        const bucketIndex = path.reduce((a, b) => a + b, 0);
        return { path, bucketIndex, multiplier: 1.0 }; 
    });
    const totalPayout = results.length * betAmount * 1.0; 
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        u.winningBalance = (u.winningBalance || 0) + totalPayout;
        u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
        return u;
    });
    const updatedUser = await getUserProfile(uid);
    return { success: true, results, totalPayout, newBalance: updatedUser?.balance };
};

export const startDragonTowerGame = async (uid: string, betAmount: number, difficulty: string) => {
    const res = await placeBet(uid, betAmount);
    if (!res.success) return res;
    await set(ref(db, `active_games/dragontower/${uid}`), {
        status: 'ACTIVE', betAmount, difficulty, level: 0, timestamp: Date.now()
    });
    return { success: true };
};

export const revealDragonTowerTile = async (uid: string, colIndex: number) => {
    const snap = await get(ref(db, `active_games/dragontower/${uid}`));
    const game = snap.val();
    const prob = game.difficulty === 'EASY' ? 0.75 : game.difficulty === 'MEDIUM' ? 0.5 : 0.25;
    if (Math.random() > prob) {
        await update(ref(db, `active_games/dragontower/${uid}`), { status: 'LOST' });
        const mines = [0,0,0,0];
        mines[Math.floor(Math.random()*4)] = 1;
        return { success: true, isLoss: true, mines };
    }
    const nextLevel = game.level + 1;
    await update(ref(db, `active_games/dragontower/${uid}`), { level: nextLevel });
    return { success: true, isLoss: false, level: nextLevel };
};

export const cashOutDragonTower = async (uid: string) => {
    const snap = await get(ref(db, `active_games/dragontower/${uid}`));
    const game = snap.val();
    const amount = game.betAmount * 2.0; 
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        u.winningBalance = (u.winningBalance || 0) + amount;
        u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
        return u;
    });
    await remove(ref(db, `active_games/dragontower/${uid}`));
    return { success: true, amount };
};

export const playCoinFlip = async (uid: string, side: string, amount: number) => {
    const res = await placeBet(uid, amount);
    if (!res.success) return res;
    const resultSide = Math.random() > 0.45 ? 'HEAD' : 'TAIL'; 
    const isWin = side === resultSide;
    const winAmount = isWin ? amount * 1.9 : 0;
    if (winAmount > 0) {
        await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
            if (!u) return null;
            u.winningBalance = (u.winningBalance || 0) + winAmount;
            u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
            return u;
        });
    }
    return { success: true, isWin, resultSide, winAmount };
};

export const playKeno = async (uid: string, amount: number, selected: number[], risk: string) => {
    const res = await placeBet(uid, amount);
    if (!res.success) return res;
    const drawnNumbers: number[] = [];
    while(drawnNumbers.length < 10) {
        const n = Math.floor(Math.random() * 40) + 1;
        if(!drawnNumbers.includes(n)) drawnNumbers.push(n);
    }
    const hits = selected.filter(n => drawnNumbers.includes(n)).length;
    const winAmount = hits > 0 ? amount * 1.5 : 0; 
    if (winAmount > 0) {
        await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
            if (!u) return null;
            u.winningBalance = (u.winningBalance || 0) + winAmount;
            u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
            return u;
        });
    }
    return { success: true, drawnNumbers, winAmount };
};

export const playDice = async (uid: string, amount: number, rollOver: number, mult: number) => {
    const res = await placeBet(uid, amount);
    if (!res.success) return res;
    const resultNum = Math.random() * 100;
    const isWin = resultNum > rollOver;
    const winAmount = isWin ? amount * mult : 0;
    if (winAmount > 0) {
        await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
            if (!u) return null;
            u.winningBalance = (u.winningBalance || 0) + winAmount;
            u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
            return u;
        });
    }
    return { success: true, isWin, resultNum, winAmount };
};

export const getReferrals = async (uid: string): Promise<UserProfile[]> => {
    const user = await getUserProfile(uid);
    if (!user) return [];
    const q = query(ref(db, 'users'), orderByChild('referredBy'), equalTo(user.referralCode));
    const snap = await get(q);
    if (!snap.exists()) return [];
    return Object.values(snap.val());
};

export const setWingoNextResult = async (num: number | null) => {
    await set(ref(db, 'admin_settings/wingo_next_result'), num);
};

export const approveDeposit = async (uid: string, amount: number) => {
    const settings = await getSystemSettings();
    const userSnap = await get(ref(db, `users/${uid}`));
    const user = userSnap.val() as UserProfile;

    // 1. Update User Balance & Deposit Total
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        u.depositBalance = (u.depositBalance || 0) + amount;
        u.totalDeposited = (u.totalDeposited || 0) + amount;
        u.lastDepositAmount = amount;
        u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
        return u;
    });

    // 2. Deposit Bonus (To User)
    const depBonus = Number(settings.depositBonusPercent) || 0;
    if (depBonus > 0) {
        const bonusAmt = amount * (depBonus / 100);
        await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
            if (!u) return null;
            addBonusAmount(u, bonusAmt);
            return u;
        });
        await createTransaction({
            uid,
            type: 'deposit_bonus',
            amount: bonusAmt,
            status: 'completed',
            details: `Deposit Bonus (${depBonus}%)`,
            method: 'SYSTEM'
        });
    }

    
    // 3. Referral Commission (To Referrer - % of Deposit)
    // Fallback: Check both referralCommission and referralDepositBonusPercent to be safe
    const refCommPercent = Number(settings.referralCommission) || Number(settings.referralDepositBonusPercent) || 0;
    
    if (user.referredBy && refCommPercent > 0) {
        const referrerUid = await getUidFromReferralCode(user.referredBy);
        if (referrerUid) {
            const commission = amount * (refCommPercent / 100);
            await runTransaction(ref(db, `users/${referrerUid}`), (u: UserProfile | null) => {
                if (!u) return null;
                u.referralEarnings = (u.referralEarnings || 0) + commission;
                addBonusAmount(u, commission); 
                return u;
            });
            await createTransaction({
                uid: referrerUid,
                type: 'referral_bonus',
                amount: commission,
                status: 'completed',
                details: `Commission (${refCommPercent}%) from ${user.displayName}`,
                method: 'SYSTEM'
            });
        }
    }

    // 4. Check VIP Upgrades
    const thresholds = settings.vipThresholds || [];
    let newVipLevel = 0;
    const updatedUserSnap = await get(ref(db, `users/${uid}`));
    const updatedUser = updatedUserSnap.val() as UserProfile;
    
    thresholds.forEach((th, idx) => {
        if ((updatedUser.totalDeposited || 0) >= th) newVipLevel = idx;
    });

    if (newVipLevel > updatedUser.vipLevel) {
        await update(ref(db, `users/${uid}`), { vipLevel: newVipLevel });
    }
};

export const approveWithdrawal = async (uid: string, amount: number) => {
    await runTransaction(ref(db, `users/${uid}`), (u: UserProfile | null) => {
        if (!u) return null;
        u.winningBalance = (u.winningBalance || 0) - amount;
        u.balance = (u.depositBalance || 0) + (u.winningBalance || 0) + (u.bonusBalance || 0);
        return u;
    });
};

export const rejectWithdrawal = async (uid: string, amount: number) => {};

export const createPromoCode = async (code: string, amount: number, maxUsers: number, expiryTimestamp: number, message: string, minDepReq: boolean, minDepAmount: number) => {
    await set(ref(db, `promo_codes/${code}`), {
        code, amount, maxUsers, 
        expiresAt: expiryTimestamp, 
        message, minDepReq, minDepAmount,
        usedBy: []
    });
};

export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
    const q = query(ref(db, 'users'), orderByChild('email'), equalTo(email));
    const snap = await get(q);
    if (!snap.exists()) return null;
    return Object.values(snap.val())[0] as UserProfile;
};

export const updateUserRole = async (uid: string, role: 'admin' | 'demo' | 'user') => {
    await update(ref(db, `users/${uid}`), { role });
};

export const fetchAllUsers = async (): Promise<UserProfile[]> => {
    const snap = await get(ref(db, 'users'));
    if (!snap.exists()) return [];
    return Object.values(snap.val());
};

export const initDemoData = async () => {
    const snap = await get(ref(db, 'system_settings'));
    if (!snap.exists()) {
        await set(ref(db, 'system_settings'), {
            referralBonus: 10,
            referralCommission: 5,
            depositBonusPercent: 10,
            minDeposit: 100,
            maxDeposit: 50000,
            minWithdraw: 500,
            maxWithdraw: 10000,
            adminUpiId: "upi@okaxis",
            adminQrCodeUrl: "",
            adminUsdtAddress: "",
            adminUsdtQrCodeUrl: "",
            homeBanners: [],
            spinPrizes: [10, 0, 50, 0, 100, 0, 500, 0],
            vipThresholds: [0, 1000, 5000, 10000, 50000],
            vipLevelUpRewards: [0, 10, 50, 100, 500],
            vipDailyRewards: [0, 1, 5, 10, 50],
            activities: [],
            loginPopupTitle: "Welcome Back!",
            loginPopupMessage: "Enjoy your favorite games."
        });
    }
};
