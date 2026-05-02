export type GamificationViewerRole = "dom" | "sub";

export type AchievementConditionType =
  | "points"
  | "level"
  | "streak"
  | "tasks_completed"
  | "perfect_rating_count";

export type AchievementBadgeType = "positive" | "negative";

export type RewardClaimStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type GamificationSubject = {
  userId: string;
  name: string;
};

export type UserStats = {
  userId: string;
  totalPoints: number;
  availablePoints: number;
  level: number;
  tasksCompleted: number;
  tasksFailed: number;
  perfectRatingCount: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedOn: string | null;
  disciplinePoints: number;
};

export type XpTransaction = {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string | null;
  pointsDelta: number;
  availableDelta: number;
  disciplineDelta: number;
  reason: string;
  createdAt: string;
};

export type Reward = {
  id: string;
  title: string;
  description: string | null;
  costPoints: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RewardClaim = {
  id: string;
  rewardId: string;
  userId: string;
  rewardTitle: string;
  rewardDescription: string | null;
  costPoints: number;
  status: RewardClaimStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type Achievement = {
  id: string;
  slug: string;
  title: string;
  description: string;
  conditionType: AchievementConditionType;
  conditionValue: number;
  iconName: string;
  sortOrder: number;
  createdBy: string | null;
  badgeType: AchievementBadgeType;
  xpReward: number;
  xpPenalty: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AchievementItem = Achievement & {
  userAchievementId: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  assignedBy: string | null;
  assignReason: string | null;
  removedAt: string | null;
  removedBy: string | null;
  removeReason: string | null;
  progressValue: number;
  progressTarget: number;
  progressPercent: number;
  progressText: string;
};

export type GamificationDashboardData = {
  role: GamificationViewerRole;
  subject: GamificationSubject;
  stats: UserStats;
  recentTransactions: XpTransaction[];
  achievementsUnlocked: number;
  achievementsTotal: number;
};

export type RewardsData = {
  role: GamificationViewerRole;
  subject: GamificationSubject;
  stats: UserStats;
  rewards: Reward[];
  claims: RewardClaim[];
};

export type AchievementsData = {
  role: GamificationViewerRole;
  subject: GamificationSubject;
  stats: UserStats;
  achievements: AchievementItem[];
  catalog: Achievement[];
  activeAchievements: AchievementItem[];
  lostAchievements: AchievementItem[];
  disciplineTransactions: XpTransaction[];
  unlockedCount: number;
  activePositiveCount: number;
  activeNegativeCount: number;
  lostCount: number;
};
