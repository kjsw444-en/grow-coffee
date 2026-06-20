export const GOAL_AMOUNT = 4700
export const GROWTH_PER_WATER = 25
export const SELL_PRICE = 47
export const HOLD_MIN_SEC = 4
export const ACTION_COOLDOWN_MS = HOLD_MIN_SEC * 1000

export const initialGameState = {
  growth: 0,
  money: 0,
  totalCoffees: 0,
  totalWaters: 0,
  redeemed: false,
}
