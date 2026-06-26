export type PassiveCoffeeStat = {
  earned: number;
  max: number;
  remainder: number;
  cupFillPercent: number;
  complete: boolean;
  canClaim: boolean;
  canReactivate: boolean;
  reactivateUsedToday: boolean;
  timeRemainingLabel?: string | null;
};