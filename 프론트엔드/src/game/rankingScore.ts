/** 랭킹 점수 — 「내린 커피 마시기」로 소모한 누적 잔 수 */
export function getRankingBrewedSpend(state: {
  lifetimeBrewedSpent?: number;
  lifetimeDrunkCoffees?: number;
}) {
  const brewed = Math.max(0, Math.floor(Number(state.lifetimeBrewedSpent ?? 0)));
  if (brewed > 0) return brewed;
  return Math.max(0, Math.floor(Number(state.lifetimeDrunkCoffees ?? 0)));
}
