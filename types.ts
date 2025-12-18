export interface BannerItem {
  imageUrl: string;
  link?: string;
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  timestamp: number;
}

export interface LeaderboardEntry {
  name: string;
  userId: string;
  amount: number;
  gender: 'male' | 'female';
}

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
  lastDepositAmount?: number; // Added to track last deposit for placeholders
  referralCode: string;
  referredBy?: string;
  referralCount?: number;
  referralEarnings?: number;
  lastDailyClaim?: string;
  claimedLevelUpRewards?: number[]; 
  createdAt?: number;
  role: 'user' | 'admin';
  hasSeenWelcome?: boolean; // New user welcome check
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
  homeBanners: BannerItem[]; 
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
  maxDeposit: number;
  minWithdraw: number;
  maxWithdraw: number;
  notificationText?: string; // Legacy field
  welcomeMessage?: string; // First-time user message
  leaderboard?: LeaderboardEntry[]; // Top 10 fake users
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
  requiredDepositAmount?: number;
}

export enum GameType {
  AVIATOR = 'aviator',
  WINGO = 'wingo',
  ROULETTE = 'roulette',
  DRAGON_TIGER = 'dragontiger',
  SPIN = 'spin',
  MINES = 'mines'
}
