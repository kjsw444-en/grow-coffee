import type { CoffeeVariantSlug } from './coffeeVariants';
import type { SelectedCoffeeSlug } from './hiddenCoffeeVariants';

export type GameState = {
  growth: number;
  money: number;
  /** 내린 커피 — 커피나무·방치·공유·미니게임으로 증가, 내린 커피 마시기로만 차감 */
  totalCoffees: number;
  totalWaters: number;
  redeemed: boolean;
  waterDayKey: string;
  watersToday: number;
  adWaterCredits: number;
  growthAccrualSyncedAt: string;
  passiveDayKey: string;
  dailyPassiveGrowth: number;
  /** 오늘 방치 커피 받기로 수령한 잔 수 (0~2) */
  passiveCoffeesClaimed: number;
  selectedCoffeeVariant: SelectedCoffeeSlug;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  /** 마신 커피 잔고 — 캐릭터 상점 구매에 사용 (랭킹과 별개) */
  spentCoffeeCups: number;
  /** 마신 커피 누적 — sell-batch 시 spentCoffeeCups와 함께 증가 */
  lifetimeDrunkCoffees: number;
  /** 내린 커피 마시기 누적 소모 — 랭킹 기준 */
  lifetimeBrewedSpent: number;
  /** 마지막 공유 리워드 수령일 (KST en-CA) */
  shareRewardDayKey: string;
  /** 방치 커피 재활성(광고) 사용일 — 하루 1회 */
  passiveReactivateDayKey: string;
  /** 출석 — 「내린 커피 마시기」 일일 진행 (KST en-CA) */
  attendanceDayKey: string;
  /** 오늘 sell-batch로 소모한 잔 수 (출석 목표용) */
  attendanceCupsToday: number;
  /** 연속 출석 달성 일 수 (7일 보너스 후 0) */
  attendanceStreak: number;
  /** 마지막으로 일일 목표를 달성한 날 */
  attendanceLastGoalDayKey: string;
  /** 일일 출석 보상 수령일 (KST en-CA) */
  attendanceDailyClaimDayKey: string;
  /** 7일 연속 달성 보너스 수령 대기 */
  attendanceStreakBonusPending: boolean;
  /** 오늘 포인트 적립일 (KST en-CA) — money는 당일만 유효 */
  pointDayKey: string;
  /** 1일 1접속 룰렛 수령일 (KST en-CA) */
  dailyLoginRouletteDayKey: string;
  /** 오늘 접속 룰렛 당첨 잔 수 (다시 돌리기 보정용) */
  dailyLoginRouletteRewardCups: number;
  /** 접속 룰렛 다시 돌리기 사용일 (KST en-CA) — 하루 1회 */
  dailyLoginRouletteRespinDayKey: string;
};

export const initialState: GameState = {
  growth: 0,
  money: 0,
  totalCoffees: 0,
  totalWaters: 0,
  redeemed: false,
  waterDayKey: '',
  watersToday: 0,
  adWaterCredits: 0,
  growthAccrualSyncedAt: new Date().toISOString(),
  passiveDayKey: '',
  dailyPassiveGrowth: 0,
  passiveCoffeesClaimed: 0,
  selectedCoffeeVariant: 'parttime-latte',
  ownedCoffeeVariants: ['parttime-latte'],
  spentCoffeeCups: 0,
  lifetimeDrunkCoffees: 0,
  lifetimeBrewedSpent: 0,
  shareRewardDayKey: '',
  passiveReactivateDayKey: '',
  attendanceDayKey: '',
  attendanceCupsToday: 0,
  attendanceStreak: 0,
  attendanceLastGoalDayKey: '',
  attendanceDailyClaimDayKey: '',
  attendanceStreakBonusPending: false,
  pointDayKey: '',
  dailyLoginRouletteDayKey: '',
  dailyLoginRouletteRewardCups: 0,
  dailyLoginRouletteRespinDayKey: '',
};
