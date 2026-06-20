import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type HoldMode,
  GROWTH_PER_WATER,
  GOAL_AMOUNT,
  SELL_PRICE,
  STORAGE_KEY,
  randomWaterDurationSec,
} from './constants';
import { initialState, type GameState } from './types';

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<GameState> & { totalTaps?: number };
    return {
      ...initialState,
      ...parsed,
      totalWaters: parsed.totalWaters ?? parsed.totalTaps ?? 0,
    };
  } catch {
    return initialState;
  }
}

function saveState(state: GameState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useCoffeeGame() {
  const [state, setState] = useState<GameState>(loadState);
  const [lastEarned, setLastEarned] = useState<number | null>(null);
  const [tapBurst, setTapBurst] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdMode, setHoldMode] = useState<HoldMode>('water');
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdTargetSec, setHoldTargetSec] = useState(0);
  const [holdElapsedSec, setHoldElapsedSec] = useState(0);

  const holdStartRef = useRef<number | null>(null);
  const holdDurationRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdProgressRef = useRef(0);
  const holdModeRef = useRef<HoldMode>('water');
  const stateRef = useRef(state);

  stateRef.current = state;
  holdModeRef.current = holdMode;

  useEffect(() => {
    saveState(state);
  }, [state]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const resetHoldUi = useCallback(() => {
    clearHoldTimer();
    holdStartRef.current = null;
    holdProgressRef.current = 0;
    setIsHolding(false);
    setHoldMode('water');
    setHoldProgress(0);
    setHoldTargetSec(0);
    setHoldElapsedSec(0);
  }, [clearHoldTimer]);

  const completeDrink = useCallback(() => {
    clearHoldTimer();
    holdStartRef.current = null;
    holdProgressRef.current = 100;

    setTapBurst(true);
    window.setTimeout(() => setTapBurst(false), 200);

    setState((prev) => {
      if (prev.redeemed || prev.growth < 100) return prev;

      const nextMoney = prev.money + SELL_PRICE;
      setLastEarned(SELL_PRICE);
      return {
        ...prev,
        growth: 0,
        money: nextMoney,
        totalCoffees: prev.totalCoffees + 1,
        redeemed: nextMoney >= GOAL_AMOUNT,
      };
    });

    setIsHolding(false);
    setHoldMode('water');
    setHoldProgress(0);
    setHoldTargetSec(0);
    setHoldElapsedSec(0);
    holdProgressRef.current = 0;
  }, [clearHoldTimer]);

  const completeWater = useCallback(() => {
    clearHoldTimer();
    holdStartRef.current = null;
    holdProgressRef.current = 100;

    setTapBurst(true);
    window.setTimeout(() => setTapBurst(false), 200);

    setState((prev) => {
      if (prev.redeemed || prev.growth >= 100) return prev;
      setLastEarned(null);
      return {
        ...prev,
        growth: Math.min(100, prev.growth + GROWTH_PER_WATER),
        totalWaters: prev.totalWaters + 1,
      };
    });

    setIsHolding(false);
    setHoldMode('water');
    setHoldProgress(0);
    setHoldTargetSec(0);
    setHoldElapsedSec(0);
    holdProgressRef.current = 0;
  }, [clearHoldTimer]);

  const tickHold = useCallback(() => {
    const start = holdStartRef.current;
    const durationSec = holdDurationRef.current;
    if (start === null || durationSec <= 0) return;

    const elapsedMs = performance.now() - start;
    const durationMs = durationSec * 1000;
    const progress = Math.min(100, (elapsedMs / durationMs) * 100);
    const elapsedSec = elapsedMs / 1000;

    holdProgressRef.current = progress;
    setHoldProgress(progress);
    setHoldElapsedSec(Math.round(elapsedSec * 10) / 10);

    if (progress >= 100) {
      if (holdModeRef.current === 'drink') {
        completeDrink();
      } else {
        completeWater();
      }
    }
  }, [completeDrink, completeWater]);

  const startHold = useCallback(() => {
    const prev = stateRef.current;
    if (prev.redeemed || holdStartRef.current !== null) return;

    const mode: HoldMode = prev.growth >= 100 ? 'drink' : 'water';
    if (mode === 'water' && prev.growth >= 100) return;

    const duration = randomWaterDurationSec();
    holdDurationRef.current = duration;
    holdStartRef.current = performance.now();
    holdProgressRef.current = 0;

    setHoldMode(mode);
    setHoldTargetSec(duration);
    setIsHolding(true);
    setHoldProgress(0);
    setHoldElapsedSec(0);

    clearHoldTimer();
    tickHold();
    holdTimerRef.current = setInterval(tickHold, 50);
  }, [clearHoldTimer, tickHold]);

  const stopHold = useCallback(() => {
    if (holdStartRef.current === null) return;
    if (holdProgressRef.current >= 100) return;
    resetHoldUi();
  }, [resetHoldUi]);

  const reset = useCallback(() => {
    setLastEarned(null);
    resetHoldUi();
    setState(initialState);
    localStorage.removeItem(STORAGE_KEY);
  }, [resetHoldUi]);

  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  const progress = Math.min(100, (state.money / GOAL_AMOUNT) * 100);
  const readyToDrink = state.growth >= 100 && !state.redeemed;
  const holdRemainingSec = Math.max(0, holdTargetSec - holdElapsedSec);

  return {
    state,
    startHold,
    stopHold,
    reset,
    progress,
    readyToDrink,
    holdMode,
    lastEarned,
    tapBurst,
    isHolding,
    holdProgress,
    holdTargetSec,
    holdElapsedSec,
    holdRemainingSec,
    remaining: Math.max(0, GOAL_AMOUNT - state.money),
  };
}
