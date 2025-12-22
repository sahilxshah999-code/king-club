
export interface BannerItem {
  imageUrl: string;
  link?: string;
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  targetUid?: string;
}

export interface LeaderboardEntry {
  name: string;
  userId: string;
  amount: number;
  gender: 'male' | 'female';
}

export interface ActivityTask {
  id: string;
  title: string;
  description: string;
  amount: number;
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  numericId?: string;
  email: string;
  displayName: string;
  balance: number;
  depositBalance?: number;
  winningBalance?: number;
  bonusBalance?: number;
  vipLevel: number;
  totalWagered: number;
  totalDeposited: number; 
  lastDepositAmount?: number;
  referralCode: string;
  referredBy?: string;
  referralCount?: number;
  referralEarnings?: number;
  lastDailyClaim?: string;
  claimedLevelUpRewards?: number[];
  completedActivities?: string[]; 
  lastSpinTime?: number;
  dailySpinCount?: number;
  createdAt?: number;
  role: 'user' | 'admin' | 'demo';
  hasSeenWelcome?: boolean;
}

export interface Transaction {
  id: string;
  uid: string;
  userNumericId?: string;
  type: 'deposit' | 'withdraw' | 'referral_bonus' | 'daily_reward' | 'game_win' | 'game_bet' | 'level_up_bonus' | 'gift_code' | 'deposit_bonus' | 'manual_transfer';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  method: string; 
  timestamp: number;
  details?: string; 
}

export interface SystemSettings {
  // Economy
  referralBonus: number; 
  referralDepositBonusPercent: number; 
  referralCommission: number; // New
  depositBonusPercent: number; 
  
  // Limits
  minDeposit: number;
  maxDeposit: number;
  minWithdraw: number;
  maxWithdraw: number;

  // Visuals & Content
  homeBanners: BannerItem[]; 
  notificationText?: string;
  welcomeMessage?: string;
  loginPopupTitle?: string;
  loginPopupMessage?: string;
  leaderboard?: LeaderboardEntry[];
  activities?: ActivityTask[];

  // Payment
  adminUpiId: string; 
  adminQrCodeUrl: string; 
  adminUsdtAddress: string; 
  adminUsdtQrCodeUrl: string; 

  // Game Settings
  spinPrizes: number[];
  
  // VIP
  vipThresholds: number[];
  vipDailyRewards: number[]; 
  vipLevelUpRewards: number[]; 

  // Links
  customerServiceUrl?: string;
  forgotPasswordUrl?: string;
  privacyPolicyUrl?: string;
}
