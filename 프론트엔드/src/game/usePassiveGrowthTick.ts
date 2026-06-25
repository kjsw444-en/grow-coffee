import { useCallback, useEffect, type MutableRefObject } from 'react';
import { PASSIVE_DISPLAY_TICK_MS } from './constants';
import {
  accrueClientPassivePreview,
  canAccruePassiveGrowth,
  type BalanceRules,
} from './passiveGrowth';
import type { GameState } from './types';

export function usePassiveGrowthTick({
  stateRef,
  balanceRules,
  passiveActive,
  onPassiveUpdate,
  onTick,
}: {
  stateRef: MutableRefObject<GameState>;
  balanceRules: BalanceRules;
  passiveActive: boolean;
  onPassiveUpdate: (next: GameState) => void;
  onTick?: () => void;
}) {
  const runTick = useCallback(() => {
    const current = stateRef.current;

    if (
      !canAccruePassiveGrowth(
        current.growth,
        false,
        current.dailyPassiveGrowth,
        balanceRules.dailyPassiveGrowthCap,
        current.passiveCoffeesClaimed,
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
    if (!passiveActive) return;

    runTick();
    const id = window.setInterval(runTick, PASSIVE_DISPLAY_TICK_MS);
    return () => window.clearInterval(id);
  }, [passiveActive, runTick]);
}
