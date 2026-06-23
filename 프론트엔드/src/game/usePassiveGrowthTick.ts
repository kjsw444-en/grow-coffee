import { useCallback, useEffect, type MutableRefObject } from 'react';
import { PASSIVE_DISPLAY_TICK_MS } from './constants';
import {
  accrueClientPassivePreview,
  canAccruePassiveGrowth,
  getPassiveCupStats,
  getPassiveUiStats,
  type BalanceRules,
} from './passiveGrowth';
import type { GameState } from './types';

export { getPassiveCupStats, getPassiveUiStats };

export function formatPassiveCupHint(
  dailyPassiveGrowth: number,
  passiveCoffeesClaimed: number,
  dailyCap: number,
  passiveReactivateDayKey = '',
) {
  const stats = getPassiveCupStats(
    dailyPassiveGrowth,
    passiveCoffeesClaimed,
    dailyCap,
    passiveReactivateDayKey,
  );

  if (stats.complete && stats.canReactivate) {
    return `방치 커피 ${stats.cupsReceived}/${stats.maxCups}잔 · 광고로 재활성 가능`;
  }

  if (stats.complete && stats.reactivateUsedToday) {
    return `방치 커피 ${stats.cupsReceived}/${stats.maxCups}잔 · 오늘 재활성 완료`;
  }

  if (stats.complete) {
    return `방치 커피 ${stats.cupsReceived}/${stats.maxCups}잔 · 오늘 수령 완료`;
  }

  if (stats.canClaim) {
    return `방치 커피 ${stats.cupsReceived}/${stats.maxCups}잔 · 받기 가능`;
  }

  if (stats.remainder > 0) {
    return `방치 커피 ${stats.cupsReceived}/${stats.maxCups}잔 · 다음 잔까지 ${stats.remainder.toFixed(1)}%`;
  }

  return `방치 커피 ${stats.cupsReceived}/${stats.maxCups}잔 · 하루 최대 ${stats.maxCups}잔`;
}

export function formatPassiveEtaHint(
  cupFillPercent: number,
  passiveGrowthPerSecond: number,
) {
  if (cupFillPercent >= 100 || passiveGrowthPerSecond <= 0) return null;

  const remaining = 100 - cupFillPercent;
  const seconds = Math.ceil(remaining / passiveGrowthPerSecond);
  if (seconds <= 0) return null;

  if (seconds < 60) {
    return `다음 방치 커피까지 약 ${seconds}초 (1분당 5%)`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `다음 방치 커피까지 약 ${minutes}분 (1분당 5%)`;
}

export function usePassiveGrowthTick({
  stateRef,
  balanceRules,
  isHolding,
  passiveActive,
  onPassiveUpdate,
  onTick,
}: {
  stateRef: MutableRefObject<GameState>;
  balanceRules: BalanceRules;
  isHolding: boolean;
  passiveActive: boolean;
  onPassiveUpdate: (next: GameState) => void;
  onTick?: () => void;
}) {
  const runTick = useCallback(() => {
    const current = stateRef.current;

    if (
      current.redeemed ||
      !canAccruePassiveGrowth(
        current.growth,
        current.redeemed,
        current.dailyPassiveGrowth,
        balanceRules.dailyPassiveGrowthCap,
      )
    ) {
      onTick?.();
      return;
    }

    const result = accrueClientPassivePreview(current, balanceRules);

    if (result.changed) {
      onPassiveUpdate(result.next);
    }

    onTick?.();
  }, [balanceRules, onPassiveUpdate, onTick, stateRef]);

  useEffect(() => {
    if (!passiveActive || isHolding) return;

    runTick();
    const id = window.setInterval(runTick, PASSIVE_DISPLAY_TICK_MS);
    return () => window.clearInterval(id);
  }, [isHolding, passiveActive, runTick]);
}
