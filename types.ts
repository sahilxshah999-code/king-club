
export interface UserProfile {
  uid: string;
  numericId?: string; // 6 digit ID
  email: string;
  displayName: string;
  
  // Balance Breakdown
  balance: number; // Total available to play (Sum of below)
  depositBalance?: number; // Cannot withdraw
  winningBalance?: number; // Can withdraw
  bonusBalance?: number;   // Cannot withdraw
  
  vipLevel: number;
  totalWagered: number;
  totalDeposited: number; 
  referralCode: string;
  referredBy?: string;
  referralCount?: number;
  referralEarnings?: number;
  lastDailyClaim?: string;
  claimedLevelUpRewards?: number[]; 
  createdAt?: number;
  role: 'user' | 'admin';
}

export interface Transaction {
  id: string;
  uid: string;
  type: 'deposit' | 'withdraw' | 'referral_bonus' | 'daily_reward' | 'game_win' | 'game_bet' | 'level_up_bonus' | 'gift_code' | 'deposit_bonus';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  method: string; 
  timestamp: number;
  details?: string; 
}

export interface SystemSettings {
  referralBonus: number; 
  referralDepositBonusPercent: number; 
  depositBonusPercent: number; 
  homeBanners: string[]; 
  adminUpiId: string; 
  adminQrCodeUrl: string; 
  adminUsdtAddress: string; 
  adminUsdtQrCodeUrl: string; 
  spinPrizes: number[];
  vipThresholds: number[];
  vipDailyRewards: number[]; 
  vipLevelUpRewards: number[]; 
  customerServiceUrl?: string;
  forgotPasswordUrl?: string;
  privacyPolicyUrl?: string;
  minDeposit: number;
  minWithdraw: number;
}

export interface PromoCode {
  code: string;
  amount: number;
  maxUses: number;
  currentUses: number;
  expiryDate: number;
  message: string;
  claimedBy?: Record<string, boolean>;
  createdAt: number;
  requiresDeposit?: boolean;
}

export enum GameType {
  AVIATOR = 'aviator',
  WINGO = 'wingo',
  ROULETTE = 'roulette',
  DRAGON_TIGER = 'dragontiger',
  SPIN = 'spin',
  MINES = 'mines'
}
