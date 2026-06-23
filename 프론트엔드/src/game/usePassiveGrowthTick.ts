import { useEffect, type MutableRefObject } from 'react';
import { PASSIVE_DISPLAY_TICK_MS } from './constants';
import {
  computePassiveDisplayGrowth,
  type BalanceRules,
} from './passiveGrowth';
import type { GameState } from './types';

export function formatPassiveCupHint(dailyPassiveGrowth: number, dailyCap: number) {
  const maxCups = Math.max(1, Math.floor(dailyCap / 100));
  const cupsEarned = Math.min(maxCups, Math.floor(dailyPassiveGrowth / 100));
  return `방치 커피 ${cupsEarned}/${maxCups}잔`;
}

export function formatPassiveEtaHint(
  displayGrowth: number,
  passiveGrowthPerSecond: number,
) {
  if (displayGrowth >= 100 || passiveGrowthPerSecond <= 0) return null;

  const remaining = 100 - displayGrowth;
  const seconds = Math.ceil(remaining / passiveGrowthPerSecond);
  if (seconds <= 0) return null;

  if (seconds < 60) {
    return `다음 커피까지 약 ${seconds}초`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `다음 커피까지 약 ${minutes}분`;
}

export function usePassiveGrowthTick({
  state,
  stateRef,
  displayGrowthRef,
  balanceRules,
  isHolding,
  passiveActive,
  setDisplayGrowth,
}: {
  state: GameState;
  stateRef: MutableRefObject<GameState>;
  displayGrowthRef: MutableRefObject<number>;
  balanceRules: BalanceRules;
  isHolding: boolean;
  passiveActive: boolean;
  setDisplayGrowth: (value: number) => void;
}) {
  useEffect(() => {
    if (!passiveActive || isHolding) return;

    const tick = () => {
      const next = computePassiveDisplayGrowth(stateRef.current, balanceRules);
      if (next !== displayGrowthRef.current) {
        displayGrowthRef.current = next;
        setDisplayGrowth(next);
      }
    };

    tick();
    const id = window.setInterval(tick, PASSIVE_DISPLAY_TICK_MS);
    return () => window.clearInterval(id);
  }, [
    balanceRules,
    displayGrowthRef,
    isHolding,
    passiveActive,
    setDisplayGrowth,
    state.dailyPassiveGrowth,
    state.growth,
    state.growthAccrualSyncedAt,
    state.redeemed,
    stateRef,
  ]);
}
