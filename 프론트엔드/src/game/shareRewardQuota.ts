import type { GameState } from './types';
import { getTodayKey } from './waterQuota';

export function hasClaimedShareRewardToday(
  state: Pick<GameState, 'shareRewardDayKey'>,
) {
  return (state.shareRewardDayKey || '') === getTodayKey();
}

export function canClaimShareRewardToday(state: Pick<GameState, 'shareRewardDayKey' | 'redeemed'>) {
  return !state.redeemed && !hasClaimedShareRewardToday(state);
}
