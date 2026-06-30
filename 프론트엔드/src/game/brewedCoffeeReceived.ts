import { getTodayKey } from './attendance';

export function addDailyBrewedReceived(
  state: {
    dailyBrewedReceivedDayKey?: string;
    dailyBrewedReceived?: number;
  },
  amount: number,
  date = new Date(),
) {
  const cups = Math.max(0, Math.floor(Number(amount) || 0));
  if (cups <= 0) {
    return {};
  }

  const today = getTodayKey(date);
  const currentDaily =
    String(state.dailyBrewedReceivedDayKey ?? '') === today
      ? Math.max(0, Math.floor(Number(state.dailyBrewedReceived ?? 0)))
      : 0;

  return {
    dailyBrewedReceivedDayKey: today,
    dailyBrewedReceived: currentDaily + cups,
  };
}

/** 내린 커피(totalCoffees) 증가 + 일일 랭킹 누적 */
export function grantBrewedCoffeeFields(
  state: {
    totalCoffees?: number;
    dailyBrewedReceivedDayKey?: string;
    dailyBrewedReceived?: number;
  },
  cups: number,
  date = new Date(),
) {
  const amount = Math.max(0, Math.floor(Number(cups) || 0));

  return {
    totalCoffees: Math.max(0, Number(state.totalCoffees ?? 0)) + amount,
    ...addDailyBrewedReceived(state, amount, date),
  };
}

/** 서버 응답이 로컬 진행보다 낮을 때 내린 커피가 초기화되지 않도록 보존 */
export function mergePreservedTotalCoffees(
  serverValue: number | undefined,
  localValue: number,
  delta = 0,
) {
  const server = Math.max(0, Math.floor(Number(serverValue) || 0));
  const local = Math.max(0, Math.floor(Number(localValue) || 0));
  const safeDelta = Math.floor(Number(delta) || 0);
  return Math.max(server, local + safeDelta);
}

/** 마신 커피(spentCoffeeCups) — 서버·로컬 병합 */
export function mergePreservedSpentCoffeeCups(
  serverValue: number | undefined,
  localValue: number,
  delta = 0,
) {
  const server = Math.max(0, Math.floor(Number(serverValue) || 0));
  const local = Math.max(0, Math.floor(Number(localValue) || 0));
  const safeDelta = Math.floor(Number(delta) || 0);
  return Math.max(server, local + safeDelta);
}
