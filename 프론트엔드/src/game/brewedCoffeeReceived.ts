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
