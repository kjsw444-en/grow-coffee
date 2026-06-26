import { getTodayKey } from './attendance';

/** 일일 랭킹 점수 — KST 오늘 받은 내린 커피 잔 수 */
export function getDailyRankingBrewedSpend(state: {
  dailyBrewedReceivedDayKey?: string;
  dailyBrewedReceived?: number;
}) {
  if (String(state.dailyBrewedReceivedDayKey ?? '') !== getTodayKey()) return 0;
  return Math.max(0, Math.floor(Number(state.dailyBrewedReceived ?? 0)));
}

/** 랭킹 점수 — 일일 랭킹과 동일 기준(오늘 받은 내린 커피) */
export function getRankingBrewedSpend(state: {
  dailyBrewedReceivedDayKey?: string;
  dailyBrewedReceived?: number;
}) {
  return getDailyRankingBrewedSpend(state);
}
