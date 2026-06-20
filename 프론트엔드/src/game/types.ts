export type GameState = {
  growth: number;
  money: number;
  totalCoffees: number;
  totalWaters: number;
  redeemed: boolean;
};

export const initialState: GameState = {
  growth: 0,
  money: 0,
  totalCoffees: 0,
  totalWaters: 0,
  redeemed: false,
};
