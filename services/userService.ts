import { ref, get, set, update, push, child, runTransaction, query, limitToLast, remove } from 'firebase/database';
import { db } from '../firebase';
import { UserProfile, Transaction, SystemSettings, PromoCode } from '../types';

// --- HELPER FUNCTIONS FOR BALANCE MANAGEMENT ---

const initUserBalances = (user: UserProfile) => {
    // Migration for existing users: Treat legacy balance as Winning Balance to allow withdrawal
    if (user.depositBalance === undefined) user.depositBalance = 0;
    if (user.bonusBalance === undefined) user.bonusBalance = 0;
    if (user.winningBalance === undefined) {
        user.winningBalance = user.balance || 0;
    }
    // Recalculate total just in case
    user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
};

const deductBetAmount = (user: UserProfile, amount: number) => {
    initUserBalances(user);
    
    let remaining = amount;
    
    // Priority 1: Bonus
    if (user.bonusBalance! > 0) {
        const take = Math.min(user.bonusBalance!, remaining);
        user.bonusBalance! -= take;
        remaining -= take;
    }
    
    // Priority 2: Deposit
    if (remaining > 0 && user.depositBalance! > 0) {
        const take = Math.min(user.depositBalance!, remaining);
        user.depositBalance! -= take;
        remaining -= take;
    }
    
    // Priority 3: Winning
    if (remaining > 0) {
        user.winningBalance! -= remaining;
    }

    // Update total
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

// -----------------------------------------------

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
      homeBanners: ["https://i.imgur.com/Q2f7XyM.png"],
      adminUpiId: "admin@upi",
      adminQrCodeUrl: "", 
      adminUsdtAddress: "",
      adminUsdtQrCodeUrl: "",
      spinPrizes: [500, 250, 100, 75, 50, 25, 10, 5],
      vipThresholds: [0, 1000, 10000, 50000, 200000, 500000, 1000000, 5000000, 10000000, 50000000],
      vipDailyRewards: [0, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
      vipLevelUpRewards: [0, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
      customerServiceUrl: "",
      forgotPasswordUrl: "",
      privacyPolicyUrl: "",
      minDeposit: 100,
      minWithdraw: 100
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
    // Client-side filtering to avoid index errors
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];
    
    const users = Object.values(snapshot.val()) as UserProfile[];
    return users.filter(user => user.referredBy === referrerUid);
};

// Admin Management Functions
export const getAdmins = async (): Promise<UserProfile[]> => {
    // Client-side filtering to avoid index errors
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];

    const users = Object.values(snapshot.val()) as UserProfile[];
    return users.filter(user => user.role === 'admin');
};

export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
    // Client-side filtering to avoid index errors
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return null;
    
    const users = Object.values(snapshot.val()) as UserProfile[];
    // Case insensitive matching
    return users.find(user => user.email.toLowerCase() === email.toLowerCase().trim()) || null;
};

export const findUserByNumericId = async (numericId: string): Promise<UserProfile | null> => {
    // Client-side filtering to avoid index errors
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
  
  const isAdmin = email === 'admin@eco.com' || 
                  email === 'sahil2401@starclub.com' || 
                  email === 'sahil24012009@gmail.com';

  const newUser: UserProfile = {
    uid,
    numericId,
    email,
    displayName: name,
    balance: 0,
    depositBalance: 0,
    winningBalance: 0,
    bonusBalance: 0,
    vipLevel: 1,
    totalWagered: 0,
    totalDeposited: 0,
    referralCode,
    referralCount: 0,
    referralEarnings: 0,
    claimedLevelUpRewards: [],
    createdAt: Date.now(),
    role: isAdmin ? 'admin' : 'user'
  };

  if (referralCodeInput) {
    const normalizedCode = referralCodeInput.toUpperCase();
    const referrerUid = await getUidFromReferralCode(normalizedCode);

    if (referrerUid) {
        newUser.referredBy = referrerUid;
        
        const settings = await getSystemSettings();
        const bonus = settings.referralBonus;
        
        if (bonus > 0) {
            const referrerRef = ref(db, `users/${referrerUid}`);
            await runTransaction(referrerRef, (referrer: UserProfile | null) => {
                if (!referrer) return null;
                // Referral Bonus goes to Bonus Balance
                addBonusAmount(referrer, bonus);
                referrer.referralCount = (referrer.referralCount || 0) + 1;
                referrer.referralEarnings = (referrer.referralEarnings || 0) + bonus;
                return referrer;
            });

            const newTxKey = push(child(ref(db), 'transactions')).key;
            await set(ref(db, `transactions/${newTxKey}`), {
                id: newTxKey,
                uid: referrerUid,
                type: 'referral_bonus',
                amount: bonus,
                status: 'completed',
                method: 'System',
                timestamp: Date.now(),
                details: `Referred user: ${name} (Sign-up Bonus)`
            });
        } else {
            const referrerRef = ref(db, `users/${referrerUid}`);
            await runTransaction(referrerRef, (referrer: UserProfile | null) => {
                if (!referrer) return null;
                referrer.referralCount = (referrer.referralCount || 0) + 1;
                return referrer;
            });
        }
    }
  }

  await set(ref(db, `users/${uid}`), newUser);
  await set(ref(db, `referral_codes/${referralCode}`), uid);
  
  return newUser;
};

export const createTransaction = async (tx: Omit<Transaction, 'id' | 'status' | 'timestamp'>) => {
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
      const rewardAmount = (settings.vipDailyRewards && settings.vipDailyRewards[levelIndex]) 
                           ? settings.vipDailyRewards[levelIndex] 
                           : 0;
      
      if (rewardAmount === 0) return;

      // Daily Reward -> Bonus Balance
      addBonusAmount(user, rewardAmount);
      user.lastDailyClaim = today;
      return user;
  });

  if (result.committed) {
      const user = result.snapshot.val();
      const levelIndex = (user.vipLevel || 1) - 1;
      const rewardAmount = settings.vipDailyRewards[levelIndex] || 0;
      return rewardAmount;
  } else {
      const snapshot = await get(userRef);
      const user = snapshot.val() as UserProfile;
      if (!user) throw new Error("User not found");

      const today = new Date().toISOString().split('T')[0];
      if (user.lastDailyClaim === today) throw new Error("Already claimed today");
      throw new Error("Claim failed");
  }
};

export const claimLevelUpReward = async (uid: string, levelToClaim: number) => {
    const userRef = ref(db, `users/${uid}`);
    const settings = await getSystemSettings();

    const result = await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        if (user.vipLevel < levelToClaim) return;
        const claimedList = user.claimedLevelUpRewards || [];
        if (claimedList.includes(levelToClaim)) return; 

        const levelIndex = levelToClaim - 1;
        const rewardAmount = (settings.vipLevelUpRewards && settings.vipLevelUpRewards[levelIndex]) 
                             ? settings.vipLevelUpRewards[levelIndex] 
                             : 0;
        
        if (rewardAmount <= 0) return;

        // Level Up Reward -> Bonus Balance
        addBonusAmount(user, rewardAmount);
        user.claimedLevelUpRewards = [...claimedList, levelToClaim];
        return user;
    });

    if (result.committed) {
        const levelIndex = levelToClaim - 1;
        const rewardAmount = settings.vipLevelUpRewards[levelIndex] || 0;
        
        const newTxKey = push(child(ref(db), 'transactions')).key;
        await set(ref(db, `transactions/${newTxKey}`), {
            id: newTxKey,
            uid: uid,
            type: 'level_up_bonus',
            amount: rewardAmount,
            status: 'completed',
            method: 'System',
            timestamp: Date.now(),
            details: `VIP ${levelToClaim} Level Up Reward`
        });

        return rewardAmount;
    } else {
         const snapshot = await get(userRef);
         const user = snapshot.val();
         if(user && user.claimedLevelUpRewards?.includes(levelToClaim)) throw new Error("Reward already claimed");
         throw new Error("Transaction failed");
    }
};

export const approveWithdrawal = async (uid: string, amount: number) => {
    const userRef = ref(db, `users/${uid}`);
    await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        initUserBalances(user);
        
        let remaining = amount;
        
        // 1. Deduct from Winning Balance FIRST
        if (user.winningBalance && user.winningBalance > 0) {
            const take = Math.min(user.winningBalance, remaining);
            user.winningBalance -= take;
            remaining -= take;
        }
        
        // 2. Deduct from Deposit Balance SECOND
        if (remaining > 0 && user.depositBalance && user.depositBalance > 0) {
            const take = Math.min(user.depositBalance, remaining);
            user.depositBalance -= take;
            remaining -= take;
        }
        
        // 3. Deduct from Bonus Balance LAST
        if (remaining > 0 && user.bonusBalance && user.bonusBalance > 0) {
             const take = Math.min(user.bonusBalance, remaining);
             user.bonusBalance -= take;
             remaining -= take;
        }

        user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
        return user;
    });
};

export const updateUserBalance = async (uid: string, newBalance: number) => {
    // WARNING: This function sets total balance directly.
    const userRef = ref(db, `users/${uid}`);
    await runTransaction(userRef, (user: UserProfile | null) => {
        if(!user) return null;
        initUserBalances(user);
        const diff = newBalance - user.balance;
        if (diff > 0) user.winningBalance = (user.winningBalance || 0) + diff;
        else {
            deductBetAmount(user, Math.abs(diff));
        }
        user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
        return user;
    });
};

export const approveDeposit = async (uid: string, amount: number) => {
    const userRef = ref(db, `users/${uid}`);
    const settings = await getSystemSettings();
    
    let referredBy: string | null = null;
    let depositorName = 'User';
    let selfBonusAmount = 0;

    await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        
        // Credit Deposit Balance
        addDepositAmount(user, amount);
        user.totalDeposited = (user.totalDeposited || 0) + amount;
        
        // Self Bonus -> Bonus Balance
        if (settings.depositBonusPercent && settings.depositBonusPercent > 0) {
            selfBonusAmount = (amount * settings.depositBonusPercent) / 100;
            if (selfBonusAmount > 0) {
                addBonusAmount(user, selfBonusAmount);
            }
        }

        referredBy = user.referredBy || null;
        depositorName = user.displayName;
        return user;
    });

    if (selfBonusAmount > 0) {
        const bonusTxKey = push(child(ref(db), 'transactions')).key;
        await set(ref(db, `transactions/${bonusTxKey}`), {
            id: bonusTxKey,
            uid: uid,
            type: 'deposit_bonus',
            amount: selfBonusAmount,
            status: 'completed',
            method: 'System',
            timestamp: Date.now(),
            details: `Extra ${settings.depositBonusPercent}% bonus on deposit`
        });
    }

    if (referredBy) {
        const commissionPercent = settings.referralDepositBonusPercent || 0;
        if (commissionPercent > 0) {
            const commissionAmount = (amount * commissionPercent) / 100;
            if (commissionAmount > 0) {
                const referrerRef = ref(db, `users/${referredBy}`);
                await runTransaction(referrerRef, (refUser: UserProfile | null) => {
                    if (!refUser) return null;
                    // Commission -> Bonus Balance
                    addBonusAmount(refUser, commissionAmount);
                    refUser.referralEarnings = (refUser.referralEarnings || 0) + commissionAmount;
                    return refUser;
                });

                const newTxKey = push(child(ref(db), 'transactions')).key;
                await set(ref(db, `transactions/${newTxKey}`), {
                    id: newTxKey,
                    uid: referredBy,
                    type: 'referral_bonus',
                    amount: commissionAmount,
                    status: 'completed',
                    method: 'System',
                    timestamp: Date.now(),
                    details: `Commission (${commissionPercent}%) from ${depositorName}'s deposit`
                });
            }
        }
    }
};

export const placeBet = async (uid: string, amount: number): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
  const userRef = ref(db, `users/${uid}`);
  const settings = await getSystemSettings();

  try {
    const result = await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        if (user.balance < amount) throw new Error("Insufficient balance");

        // Deduct using priority logic
        deductBetAmount(user, amount);
        
        user.totalWagered = (user.totalWagered || 0) + amount;

        let newLevel = 1;
        if (settings.vipThresholds) {
            for (let i = settings.vipThresholds.length - 1; i >= 0; i--) {
                if (user.totalWagered >= settings.vipThresholds[i]) {
                    newLevel = i + 1;
                    break;
                }
            }
        }
        
        if (newLevel > 10) newLevel = 10;
        if (newLevel > user.vipLevel) {
            user.vipLevel = newLevel;
        }

        return user;
    });

    if (result.committed) {
        return { success: true, newBalance: result.snapshot.val().balance };
    } else {
        return { success: false, error: "Transaction failed" };
import { ref, get, set, update, push, child, runTransaction, query, limitToLast, remove } from 'firebase/database';
import { db } from '../firebase';
import { UserProfile, Transaction, SystemSettings, PromoCode } from '../types';

// --- HELPER FUNCTIONS FOR BALANCE MANAGEMENT ---

const initUserBalances = (user: UserProfile) => {
    // Migration for existing users: Treat legacy balance as Winning Balance to allow withdrawal
    if (user.depositBalance === undefined) user.depositBalance = 0;
    if (user.bonusBalance === undefined) user.bonusBalance = 0;
    if (user.winningBalance === undefined) {
        user.winningBalance = user.balance || 0;
    }
    // Recalculate total just in case
    user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
};

const deductBetAmount = (user: UserProfile, amount: number) => {
    initUserBalances(user);
    
    let remaining = amount;
    
    // Priority 1: Bonus
    if (user.bonusBalance! > 0) {
        const take = Math.min(user.bonusBalance!, remaining);
        user.bonusBalance! -= take;
        remaining -= take;
    }
    
    // Priority 2: Deposit
    if (remaining > 0 && user.depositBalance! > 0) {
        const take = Math.min(user.depositBalance!, remaining);
        user.depositBalance! -= take;
        remaining -= take;
    }
    
    // Priority 3: Winning
    if (remaining > 0) {
        user.winningBalance! -= remaining;
    }

    // Update total
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

// -----------------------------------------------

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
      homeBanners: ["https://i.imgur.com/Q2f7XyM.png"],
      adminUpiId: "admin@upi",
      adminQrCodeUrl: "", 
      adminUsdtAddress: "",
      adminUsdtQrCodeUrl: "",
      spinPrizes: [500, 250, 100, 75, 50, 25, 10, 5],
      vipThresholds: [0, 1000, 10000, 50000, 200000, 500000, 1000000, 5000000, 10000000, 50000000],
      vipDailyRewards: [0, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
      vipLevelUpRewards: [0, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
      customerServiceUrl: "",
      forgotPasswordUrl: "",
      privacyPolicyUrl: "",
      minDeposit: 100,
      minWithdraw: 100
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
    // Client-side filtering to avoid index errors
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];
    
    const users = Object.values(snapshot.val()) as UserProfile[];
    return users.filter(user => user.referredBy === referrerUid);
};

// Admin Management Functions
export const getAdmins = async (): Promise<UserProfile[]> => {
    // Client-side filtering to avoid index errors
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];

    const users = Object.values(snapshot.val()) as UserProfile[];
    return users.filter(user => user.role === 'admin');
};

export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
    // Client-side filtering to avoid index errors
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return null;
    
    const users = Object.values(snapshot.val()) as UserProfile[];
    // Case insensitive matching
    return users.find(user => user.email.toLowerCase() === email.toLowerCase().trim()) || null;
};

export const findUserByNumericId = async (numericId: string): Promise<UserProfile | null> => {
    // Client-side filtering to avoid index errors
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
  
  const isAdmin = email === 'admin@eco.com' || 
                  email === 'sahil2401@starclub.com' || 
                  email === 'sahil24012009@gmail.com';

  const newUser: UserProfile = {
    uid,
    numericId,
    email,
    displayName: name,
    balance: 0,
    depositBalance: 0,
    winningBalance: 0,
    bonusBalance: 0,
    vipLevel: 1,
    totalWagered: 0,
    totalDeposited: 0,
    referralCode,
    referralCount: 0,
    referralEarnings: 0,
    claimedLevelUpRewards: [],
    createdAt: Date.now(),
    role: isAdmin ? 'admin' : 'user'
  };

  if (referralCodeInput) {
    const normalizedCode = referralCodeInput.toUpperCase();
    const referrerUid = await getUidFromReferralCode(normalizedCode);

    if (referrerUid) {
        newUser.referredBy = referrerUid;
        
        const settings = await getSystemSettings();
        const bonus = settings.referralBonus;
        
        if (bonus > 0) {
            const referrerRef = ref(db, `users/${referrerUid}`);
            await runTransaction(referrerRef, (referrer: UserProfile | null) => {
                if (!referrer) return null;
                // Referral Bonus goes to Bonus Balance
                addBonusAmount(referrer, bonus);
                referrer.referralCount = (referrer.referralCount || 0) + 1;
                referrer.referralEarnings = (referrer.referralEarnings || 0) + bonus;
                return referrer;
            });

            const newTxKey = push(child(ref(db), 'transactions')).key;
            await set(ref(db, `transactions/${newTxKey}`), {
                id: newTxKey,
                uid: referrerUid,
                type: 'referral_bonus',
                amount: bonus,
                status: 'completed',
                method: 'System',
                timestamp: Date.now(),
                details: `Referred user: ${name} (Sign-up Bonus)`
            });
        } else {
            const referrerRef = ref(db, `users/${referrerUid}`);
            await runTransaction(referrerRef, (referrer: UserProfile | null) => {
                if (!referrer) return null;
                referrer.referralCount = (referrer.referralCount || 0) + 1;
                return referrer;
            });
        }
    }
  }

  await set(ref(db, `users/${uid}`), newUser);
  await set(ref(db, `referral_codes/${referralCode}`), uid);
  
  return newUser;
};

export const createTransaction = async (tx: Omit<Transaction, 'id' | 'status' | 'timestamp'>) => {
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
      const rewardAmount = (settings.vipDailyRewards && settings.vipDailyRewards[levelIndex]) 
                           ? settings.vipDailyRewards[levelIndex] 
                           : 0;
      
      if (rewardAmount === 0) return;

      // Daily Reward -> Bonus Balance
      addBonusAmount(user, rewardAmount);
      user.lastDailyClaim = today;
      return user;
  });

  if (result.committed) {
      const user = result.snapshot.val();
      const levelIndex = (user.vipLevel || 1) - 1;
      const rewardAmount = settings.vipDailyRewards[levelIndex] || 0;
      return rewardAmount;
  } else {
      const snapshot = await get(userRef);
      const user = snapshot.val() as UserProfile;
      if (!user) throw new Error("User not found");

      const today = new Date().toISOString().split('T')[0];
      if (user.lastDailyClaim === today) throw new Error("Already claimed today");
      throw new Error("Claim failed");
  }
};

export const claimLevelUpReward = async (uid: string, levelToClaim: number) => {
    const userRef = ref(db, `users/${uid}`);
    const settings = await getSystemSettings();

    const result = await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        if (user.vipLevel < levelToClaim) return;
        const claimedList = user.claimedLevelUpRewards || [];
        if (claimedList.includes(levelToClaim)) return; 

        const levelIndex = levelToClaim - 1;
        const rewardAmount = (settings.vipLevelUpRewards && settings.vipLevelUpRewards[levelIndex]) 
                             ? settings.vipLevelUpRewards[levelIndex] 
                             : 0;
        
        if (rewardAmount <= 0) return;

        // Level Up Reward -> Bonus Balance
        addBonusAmount(user, rewardAmount);
        user.claimedLevelUpRewards = [...claimedList, levelToClaim];
        return user;
    });

    if (result.committed) {
        const levelIndex = levelToClaim - 1;
        const rewardAmount = settings.vipLevelUpRewards[levelIndex] || 0;
        
        const newTxKey = push(child(ref(db), 'transactions')).key;
        await set(ref(db, `transactions/${newTxKey}`), {
            id: newTxKey,
            uid: uid,
            type: 'level_up_bonus',
            amount: rewardAmount,
            status: 'completed',
            method: 'System',
            timestamp: Date.now(),
            details: `VIP ${levelToClaim} Level Up Reward`
        });

        return rewardAmount;
    } else {
         const snapshot = await get(userRef);
         const user = snapshot.val();
         if(user && user.claimedLevelUpRewards?.includes(levelToClaim)) throw new Error("Reward already claimed");
         throw new Error("Transaction failed");
    }
};

export const approveWithdrawal = async (uid: string, amount: number) => {
    const userRef = ref(db, `users/${uid}`);
    await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        initUserBalances(user);
        
        let remaining = amount;
        
        // 1. Deduct from Winning Balance FIRST
        if (user.winningBalance && user.winningBalance > 0) {
            const take = Math.min(user.winningBalance, remaining);
            user.winningBalance -= take;
            remaining -= take;
        }
        
        // 2. Deduct from Deposit Balance SECOND
        if (remaining > 0 && user.depositBalance && user.depositBalance > 0) {
            const take = Math.min(user.depositBalance, remaining);
            user.depositBalance -= take;
            remaining -= take;
        }
        
        // 3. Deduct from Bonus Balance LAST
        if (remaining > 0 && user.bonusBalance && user.bonusBalance > 0) {
             const take = Math.min(user.bonusBalance, remaining);
             user.bonusBalance -= take;
             remaining -= take;
        }

        user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
        return user;
    });
};

export const updateUserBalance = async (uid: string, newBalance: number) => {
    // WARNING: This function sets total balance directly.
    const userRef = ref(db, `users/${uid}`);
    await runTransaction(userRef, (user: UserProfile | null) => {
        if(!user) return null;
        initUserBalances(user);
        const diff = newBalance - user.balance;
        if (diff > 0) user.winningBalance = (user.winningBalance || 0) + diff;
        else {
            deductBetAmount(user, Math.abs(diff));
        }
        user.balance = (user.depositBalance || 0) + (user.winningBalance || 0) + (user.bonusBalance || 0);
        return user;
    });
};

export const approveDeposit = async (uid: string, amount: number) => {
    const userRef = ref(db, `users/${uid}`);
    const settings = await getSystemSettings();
    
    let referredBy: string | null = null;
    let depositorName = 'User';
    let selfBonusAmount = 0;

    await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        
        // Credit Deposit Balance
        addDepositAmount(user, amount);
        user.totalDeposited = (user.totalDeposited || 0) + amount;
        
        // Self Bonus -> Bonus Balance
        if (settings.depositBonusPercent && settings.depositBonusPercent > 0) {
            selfBonusAmount = (amount * settings.depositBonusPercent) / 100;
            if (selfBonusAmount > 0) {
                addBonusAmount(user, selfBonusAmount);
            }
        }

        referredBy = user.referredBy || null;
        depositorName = user.displayName;
        return user;
    });

    if (selfBonusAmount > 0) {
        const bonusTxKey = push(child(ref(db), 'transactions')).key;
        await set(ref(db, `transactions/${bonusTxKey}`), {
            id: bonusTxKey,
            uid: uid,
            type: 'deposit_bonus',
            amount: selfBonusAmount,
            status: 'completed',
            method: 'System',
            timestamp: Date.now(),
            details: `Extra ${settings.depositBonusPercent}% bonus on deposit`
        });
    }

    if (referredBy) {
        const commissionPercent = settings.referralDepositBonusPercent || 0;
        if (commissionPercent > 0) {
            const commissionAmount = (amount * commissionPercent) / 100;
            if (commissionAmount > 0) {
                const referrerRef = ref(db, `users/${referredBy}`);
                await runTransaction(referrerRef, (refUser: UserProfile | null) => {
                    if (!refUser) return null;
                    // Commission -> Bonus Balance
                    addBonusAmount(refUser, commissionAmount);
                    refUser.referralEarnings = (refUser.referralEarnings || 0) + commissionAmount;
                    return refUser;
                });

                const newTxKey = push(child(ref(db), 'transactions')).key;
                await set(ref(db, `transactions/${newTxKey}`), {
                    id: newTxKey,
                    uid: referredBy,
                    type: 'referral_bonus',
                    amount: commissionAmount,
                    status: 'completed',
                    method: 'System',
                    timestamp: Date.now(),
                    details: `Commission (${commissionPercent}%) from ${depositorName}'s deposit`
                });
            }
        }
    }
};

export const placeBet = async (uid: string, amount: number): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
  const userRef = ref(db, `users/${uid}`);
  const settings = await getSystemSettings();

  try {
    const result = await runTransaction(userRef, (user: UserProfile | null) => {
        if (!user) return null;
        if (user.balance < amount) throw new Error("Insufficient balance");

        // Deduct using priority logic
        deductBetAmount(user, amount);
        
        user.totalWagered = (user.totalWagered || 0) + amount;

        let newLevel = 1;
        if (settings.vipThresholds) {
            for (let i = settings.vipThresholds.length - 1; i >= 0; i--) {
                if (user.totalWagered >= settings.vipThresholds[i]) {
                    newLevel = i + 1;
                    break;
                }
            }
        }
        
        if (newLevel > 10) newLevel = 10;
        if (newLevel > user.vipLevel) {
            user.vipLevel = newLevel;
        }

        return user;
    });

    if (result.committed) {
        return { success: true, newBalance: result.snapshot.val().balance };
    } else {
        return { success: false, error: "Transaction failed" };
        let resultMessage = "";
        let resultAmount = 0;

        const result = await runTransaction(promoRef, (promo: PromoCode | null) => {
            if (!promo) return null; 

            if (Date.now() > promo.expiryDate) return; 
            if (promo.currentUses >= promo.maxUses) return; 
            
            if (promo.claimedBy && promo.claimedBy[uid]) return; 

            promo.currentUses = (promo.currentUses || 0) + 1;
            if (!promo.claimedBy) promo.claimedBy = {};
            promo.claimedBy[uid] = true;

            return promo;
        });

        if (result.committed) {
             const promo = result.snapshot.val() as PromoCode;
             resultAmount = promo.amount;
             
             let userName = user.displayName;
             await runTransaction(userRef, (u: UserProfile | null) => {
                 if(!u) return null;
                 // Promo Code -> Bonus Balance
                 addBonusAmount(u, promo.amount);
                 return u;
             });

             const newTxKey = push(child(ref(db), 'transactions')).key;
             await set(ref(db, `transactions/${newTxKey}`), {
                id: newTxKey,
                uid: uid,
                type: 'gift_code',
                amount: promo.amount,
                status: 'completed',
                method: 'System',
                timestamp: Date.now(),
                details: `Gift Code: ${codeKey}`
            });

            resultMessage = promo.message.replace('#username', userName);

            return { success: true, message: resultMessage, amount: resultAmount };
        } else {
             const snap = await get(promoRef);
             if(!snap.exists()) return { success: false, error: "Code is Invalid" };
             
             const promo = snap.val() as PromoCode;
             
             if (Date.now() > promo.expiryDate) throw new Error("Code Expired");
             if (promo.currentUses >= promo.maxUses) throw new Error("Code limit reached");
             if (promo.claimedBy && promo.claimedBy[uid]) throw new Error("Already claimed");
             
             return { success: false, error: "Code redemption failed" };
        }

    } catch(e: any) {
        return { success: false, error: e.message };
    }
};
