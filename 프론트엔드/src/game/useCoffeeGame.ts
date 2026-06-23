import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiRequestError,
  devSetTotalCoffees,
  drinkGame,
  fetchGameBootstrap,
  isBackendConfigured,
  purchaseCoffeeVariant,
  resetGame,
  selectCoffeeVariant,
  signOutPlayer,
  testBumpGame,
  watchAdGame,
  waterGame,
  type PlayerSession,
} from '../services/api';
import { watchRewardedAd } from '../services/rewardedAd';
import { initPlayerSession, isTossInApp, loginWithTossSession } from '../services/tossBridge';
import {
  type HoldMode,
  COFFEE_STAGE_MIN,
  GOAL_AMOUNT,
  randomWaterDurationSec,
} from './constants';
import {
  normalizeOwnedCoffeeVariants,
  normalizeSelectedCoffeeVariant,
} from './coffeeVariants';
import {
  commitWaterGrowth,
  isReadyToDrinkGrowth,
  previewHoldGrowth,
  resolveWaterSyncGrowth,
  sanitizeGrowthForWaters,
} from './growthHold';
import {
  sceneDialogueForAdReward,
  sceneDialogueForDrink,
  sceneDialogueForGrowthComplete,
  sceneDialogueForHoldCancel,
  sceneDialogueForHoldStart,
  SCENE_DIALOGUE_IDLE_MS,
} from './sceneDialogue';
import { getStage } from './utils';
import {
  type BalanceRules,
  canAccruePassiveGrowth,
  DEFAULT_BALANCE_RULES,
  roundGrowth,
  withNormalizedPassive,
} from './passiveGrowth';
import { initialState, type GameState } from './types';
import {
  canWaterToday,
  consumeWaterQuota,
  getWaterStatus,
  needsAdForWater,
  withNormalizedQuota,
} from './waterQuota';

function readCount(raw: GameState, camel: keyof GameState, snake: string) {
  const record = raw as GameState & Record<string, unknown>;
  const value = record[camel] ?? record[snake];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLoadedState(raw: GameState) {
  const totalWaters = readCount(raw, 'totalWaters', 'total_waters');
  const ownedCoffeeVariants = normalizeOwnedCoffeeVariants(
    raw.ownedCoffeeVariants ?? (raw as GameState & { owned_coffee_variants?: unknown }).owned_coffee_variants,
  );
  const normalized: GameState = {
    ...raw,
    growth: sanitizeGrowthForWaters(raw.growth ?? 0, totalWaters),
    money: readCount(raw, 'money', 'money'),
    totalCoffees: readCount(raw, 'totalCoffees', 'total_coffees'),
    totalWaters,
    spentCoffeeCups: readCount(raw, 'spentCoffeeCups', 'spent_coffee_cups'),
    waterDayKey: String(
      raw.waterDayKey ?? (raw as GameState & { water_day_key?: string }).water_day_key ?? '',
    ),
    watersToday: readCount(raw, 'watersToday', 'waters_today'),
    adWaterCredits: readCount(raw, 'adWaterCredits', 'ad_water_credits'),
    ownedCoffeeVariants,
    selectedCoffeeVariant: normalizeSelectedCoffeeVariant(
      raw.selectedCoffeeVariant ??
        (raw as GameState & { selected_coffee_variant?: unknown }).selected_coffee_variant,
      ownedCoffeeVariants,
    ),
  };
  return withNormalizedPassive(withNormalizedQuota(normalized));
}

function isWaterCooldownError(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError && err.status === 429;
}

const BOOTSTRAP_STALE_MS = 60_000;
const HOLD_UI_COMMIT_MS = 100;

export function useCoffeeGame() {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [state, setState] = useState<GameState>(initialState);
  const [displayGrowth, setDisplayGrowth] = useState(0);
  const [balanceRules, setBalanceRules] = useState<BalanceRules>(DEFAULT_BALANCE_RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastEarned, setLastEarned] = useState<number | null>(null);
  const [tapBurst, setTapBurst] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdMode, setHoldMode] = useState<HoldMode>('water');
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdTargetSec, setHoldTargetSec] = useState(0);
  const [holdElapsedSec, setHoldElapsedSec] = useState(0);
  const [watchingAd, setWatchingAd] = useState(false);
  const [actionSyncing, setActionSyncing] = useState(false);
  const [isDrinkCommitting, setIsDrinkCommitting] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [sceneDialogue, setSceneDialogue] = useState<string | null>(null);

  const holdStartRef = useRef<number | null>(null);
  const holdDurationRef = useRef(0);
  const holdRafRef = useRef<number | null>(null);
  const holdTickRef = useRef<() => void>(() => undefined);
  const lastHoldUiCommitRef = useRef(0);
  const lastBootstrapAtRef = useRef(0);
  const tapBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdProgressRef = useRef(0);
  const holdModeRef = useRef<HoldMode>('water');
  const stateRef = useRef(state);
  const sessionRef = useRef<PlayerSession | null>(null);
  const syncingRef = useRef(false);
  const displayGrowthRef = useRef(0);
  const holdStartGrowthRef = useRef<number | null>(null);
  const holdSyncCommittedRef = useRef(false);
  const holdPreflightRef = useRef(false);
  const sceneDialogueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const testQueueRef = useRef(Promise.resolve());

  stateRef.current = state;
  holdModeRef.current = holdMode;
  sessionRef.current = session;
  displayGrowthRef.current = displayGrowth;

  const showSceneDialogue = useCallback((message: string, autoHide = true) => {
    if (sceneDialogueTimerRef.current !== null) {
      clearTimeout(sceneDialogueTimerRef.current);
      sceneDialogueTimerRef.current = null;
    }

    setSceneDialogue(message);

    if (!autoHide) return;

    sceneDialogueTimerRef.current = setTimeout(() => {
      setSceneDialogue(null);
      sceneDialogueTimerRef.current = null;
    }, SCENE_DIALOGUE_IDLE_MS);
  }, []);

  const hideSceneDialogue = useCallback(() => {
    if (sceneDialogueTimerRef.current !== null) {
      clearTimeout(sceneDialogueTimerRef.current);
      sceneDialogueTimerRef.current = null;
    }
    setSceneDialogue(null);
  }, []);

  const applyAuthoritativeState = useCallback((raw: GameState) => {
    const next = normalizeLoadedState(raw);
    stateRef.current = next;
    setState(next);
    setDisplayGrowth(next.growth);
    displayGrowthRef.current = next.growth;
    lastBootstrapAtRef.current = Date.now();
    return next;
  }, []);

  const triggerTapBurst = useCallback(() => {
    if (tapBurstTimerRef.current !== null) {
      clearTimeout(tapBurstTimerRef.current);
    }
    setTapBurst(true);
    tapBurstTimerRef.current = setTimeout(() => {
      setTapBurst(false);
      tapBurstTimerRef.current = null;
    }, 200);
  }, []);

  const applyStateWithPreview = useCallback(
    (raw: GameState, holdStartGrowth?: number) => {
      const growth =
        holdStartGrowth !== undefined
          ? resolveWaterSyncGrowth(holdStartGrowth, raw.growth)
          : raw.growth;
      return applyAuthoritativeState({ ...raw, growth });
    },
    [applyAuthoritativeState],
  );

  const applySession = useCallback(
    (next: PlayerSession & { state?: GameState; balanceRules?: BalanceRules }) => {
      setSession({
        userId: next.userId,
        displayName: next.displayName,
        source: next.source,
        playerRank: next.playerRank ?? null,
      });
      if (next.balanceRules) {
        setBalanceRules(next.balanceRules);
      }
      if (next.state) {
        applyAuthoritativeState(next.state);
      }
      setError(next.source === 'mock' ? '백엔드 서버를 실행해 주세요.' : null);
    },
    [applyAuthoritativeState],
  );

  const updatePlayerRank = useCallback((playerRank: number | null) => {
    setSession((prev) => (prev ? { ...prev, playerRank } : prev));
  }, []);

  useEffect(() => {
    let cancelled = false;

    initPlayerSession()
      .then((next) => {
        if (cancelled) return;
        applySession(next);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || '서버 연결에 실패했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  useEffect(() => {
    if (!import.meta.env.DEV || loading || !session?.userId || !isBackendConfigured()) return;

    let cancelled = false;

    void devSetTotalCoffees(1000)
      .then((result) => {
        if (!cancelled) applyAuthoritativeState(result.state);
      })
      .catch(() => {
        // dev helper — ignore when backend is unavailable
      });

    return () => {
      cancelled = true;
    };
  }, [applyAuthoritativeState, loading, session?.userId]);

  const loginWithToss = useCallback(async () => {
    if (!isTossInApp()) {
      setAuthMessage('토스 앱에서만 토스 로그인을 사용할 수 있어요.');
      return;
    }

    setLoggingIn(true);
    setAuthMessage('토스 로그인 중이에요...');

    try {
      const next = await loginWithTossSession(sessionRef.current?.displayName || '커피 농부');
      applySession(next);
      setAuthMessage('토스 로그인이 완료됐어요.');
    } catch (error) {
      const err = error as Error;
      setAuthMessage(err.message || '토스 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoggingIn(false);
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    signOutPlayer();
    setSession(null);
    setAuthMessage('로그아웃했어요.');
    setLoading(true);

    try {
      const next = await initPlayerSession();
      applySession(next);
    } catch (err) {
      const error = err as Error;
      setError(error.message || '세션을 다시 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const clearHoldTimer = useCallback(() => {
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
  }, []);

  const resetHoldUi = useCallback(() => {
    clearHoldTimer();
    holdStartRef.current = null;
    holdProgressRef.current = 0;
    holdStartGrowthRef.current = null;
    holdSyncCommittedRef.current = false;
    setIsHolding(false);
    setHoldMode('water');
    setHoldProgress(0);
    setHoldTargetSec(0);
    setHoldElapsedSec(0);
  }, [clearHoldTimer]);

  const revertHoldGrowth = useCallback(() => {
    if (holdModeRef.current === 'drink' || holdStartGrowthRef.current === null) return;

    const revertDisplay = holdStartGrowthRef.current;
    displayGrowthRef.current = revertDisplay;
    setDisplayGrowth(revertDisplay);
  }, []);

  const applyWaterServerState = useCallback(
    (serverState: GameState, holdStartGrowth: number) =>
      applyStateWithPreview(serverState, holdStartGrowth),
    [applyStateWithPreview],
  );

  const syncAction = useCallback(
    async (mode: HoldMode) => {
      const currentSession = sessionRef.current;
      if (!currentSession?.userId || syncingRef.current) {
        holdSyncCommittedRef.current = false;
        resetHoldUi();
        return;
      }

      const before = stateRef.current;
      const beforeGrowth = roundGrowth(before.growth);
      const lockedHoldStart = holdStartGrowthRef.current ?? beforeGrowth;
      syncingRef.current = true;
      setActionSyncing(true);
      setActionError(null);

      if ((mode === 'water' || mode === 'brew') && !before.redeemed) {
        const optimistic = consumeWaterQuota(before);
        const nextWaters = before.totalWaters + 1;
        const nextGrowth = sanitizeGrowthForWaters(
          commitWaterGrowth(lockedHoldStart),
          nextWaters,
        );

        if (nextGrowth > beforeGrowth) {
          displayGrowthRef.current = nextGrowth;
          setDisplayGrowth(nextGrowth);
          setState({
            ...optimistic,
            growth: nextGrowth,
            totalWaters: before.totalWaters + 1,
          });
          triggerTapBurst();
        }
      }

      try {
        const result = await waterGame();
        applyWaterServerState(result.state, lockedHoldStart);
        setLastEarned(result.lastEarned);
        const synced = resolveWaterSyncGrowth(lockedHoldStart, result.state.growth);
        const stage = getStage(synced);
        showSceneDialogue(sceneDialogueForGrowthComplete(mode, stage.label, synced));
      } catch (err) {
        if (isWaterCooldownError(err) && err.state) {
          applyWaterServerState(err.state, lockedHoldStart);
        } else if (
          (mode === 'water' || mode === 'brew') &&
          err instanceof ApiRequestError &&
          err.state
        ) {
          const synced = applyWaterServerState(err.state, lockedHoldStart);
          const growth = roundGrowth(synced.growth);
          const stage = getStage(growth);
          showSceneDialogue(sceneDialogueForGrowthComplete(mode, stage.label, growth));
        } else {
          applyAuthoritativeState(before);
          const revertGrowth =
            (mode === 'water' || mode === 'brew') && holdStartGrowthRef.current !== null
              ? holdStartGrowthRef.current
              : before.growth;
          displayGrowthRef.current = revertGrowth;
          setDisplayGrowth(revertGrowth);
        }

        if (!isWaterCooldownError(err)) {
          const message = err instanceof Error ? err.message : '동작 처리에 실패했습니다.';
          setActionError(message);
          showSceneDialogue(message);
        }
      } finally {
        syncingRef.current = false;
        setActionSyncing(false);
        resetHoldUi();
      }
    },
    [
      applyAuthoritativeState,
      applyWaterServerState,
      resetHoldUi,
      showSceneDialogue,
      triggerTapBurst,
    ],
  );

  const tickHold = useCallback(() => {
    const start = holdStartRef.current;
    const durationSec = holdDurationRef.current;
    if (start === null || durationSec <= 0) return;

    const elapsedMs = performance.now() - start;
    const durationMs = durationSec * 1000;
    const progress = Math.min(100, (elapsedMs / durationMs) * 100);
    const elapsedSec = elapsedMs / 1000;
    const elapsedRounded = Math.round(elapsedSec * 10) / 10;

    holdProgressRef.current = progress;

    const now = performance.now();
    const shouldCommitUi = now - lastHoldUiCommitRef.current >= HOLD_UI_COMMIT_MS || progress >= 100;
    if (shouldCommitUi) {
      lastHoldUiCommitRef.current = now;
      setHoldProgress((prev) => (Math.abs(prev - progress) < 0.01 ? prev : progress));
      setHoldElapsedSec((prev) => (prev === elapsedRounded ? prev : elapsedRounded));
    }

    if (holdModeRef.current === 'water' || holdModeRef.current === 'brew') {
      const startGrowth = holdStartGrowthRef.current;
      if (startGrowth !== null) {
        const nextGrowth = previewHoldGrowth(startGrowth, progress);
        if (nextGrowth !== displayGrowthRef.current) {
          displayGrowthRef.current = nextGrowth;
          setDisplayGrowth(nextGrowth);
        }
      }
    }

    if (progress >= 100) {
      if (holdSyncCommittedRef.current) return;
      holdSyncCommittedRef.current = true;
      clearHoldTimer();
      holdStartRef.current = null;
      setIsHolding(false);
      setHoldProgress(100);
      void syncAction(holdModeRef.current);
      return;
    }

    holdRafRef.current = requestAnimationFrame(() => holdTickRef.current());
  }, [clearHoldTimer, syncAction]);

  holdTickRef.current = tickHold;

  const startHold = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (
      !currentSession?.userId ||
      loading ||
      syncingRef.current ||
      holdPreflightRef.current
    ) {
      return;
    }
    if (stateRef.current.redeemed || holdStartRef.current !== null) return;
    if (isReadyToDrinkGrowth(stateRef.current.growth)) return;
    if (!canWaterToday(stateRef.current)) return;

    holdPreflightRef.current = true;
    try {
      let activeState = stateRef.current;

      if (isBackendConfigured()) {
        const bootstrapStale = Date.now() - lastBootstrapAtRef.current > BOOTSTRAP_STALE_MS;
        if (bootstrapStale) {
          try {
            const bootstrap = await fetchGameBootstrap();
            activeState = applyAuthoritativeState(bootstrap.state);
          } catch {
            // 로컬 상태로 진행
          }
        }
      }

      const authoritativeGrowth = roundGrowth(activeState.growth);
      if (activeState.redeemed || holdStartRef.current !== null || syncingRef.current) return;
      if (isReadyToDrinkGrowth(activeState.growth)) return;
      if (!canWaterToday(activeState)) return;

      const mode: HoldMode =
        authoritativeGrowth >= COFFEE_STAGE_MIN ? 'brew' : 'water';

      const duration = randomWaterDurationSec();
      holdDurationRef.current = duration;
      holdStartRef.current = performance.now();
      holdProgressRef.current = 0;
      holdStartGrowthRef.current = authoritativeGrowth;
      displayGrowthRef.current = authoritativeGrowth;
      setDisplayGrowth(authoritativeGrowth);

      setHoldMode(mode);
      showSceneDialogue(sceneDialogueForHoldStart(mode), false);
      setHoldTargetSec(duration);
      setIsHolding(true);
      setHoldProgress(0);
      setHoldElapsedSec(0);

      lastHoldUiCommitRef.current = 0;
      clearHoldTimer();
      tickHold();
    } finally {
      holdPreflightRef.current = false;
    }
  }, [
    applyAuthoritativeState,
    clearHoldTimer,
    loading,
    showSceneDialogue,
    tickHold,
  ]);

  const stopHold = useCallback(() => {
    if (holdStartRef.current === null) return;
    if (holdProgressRef.current >= 100) return;
    revertHoldGrowth();
    showSceneDialogue(sceneDialogueForHoldCancel());
    resetHoldUi();
  }, [resetHoldUi, revertHoldGrowth, showSceneDialogue]);

  const commitDrink = useCallback(async (before: GameState) => {
    try {
      const result = await drinkGame();
      applyAuthoritativeState({ ...result.state, growth: 0 });
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      setLastEarned(result.lastEarned);
      setActionError(null);
      showSceneDialogue(sceneDialogueForDrink());
      triggerTapBurst();
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state);
      } else {
        applyAuthoritativeState(before);
      }
      const message = err instanceof Error ? err.message : '커피 마시기에 실패했습니다.';
      setActionError(message);
      showSceneDialogue(message);
    } finally {
      syncingRef.current = false;
      setIsDrinkCommitting(false);
      setActionSyncing(false);
    }
  }, [applyAuthoritativeState, showSceneDialogue, triggerTapBurst, updatePlayerRank]);

  const completeDrink = useCallback(() => {
    if (syncingRef.current) return;

    const currentSession = sessionRef.current;
    if (!currentSession?.userId) {
      showSceneDialogue('백엔드 서버를 실행해 주세요.');
      return;
    }
    if (loading) return;

    const before = stateRef.current;
    if (before.redeemed || !isReadyToDrinkGrowth(before.growth)) return;

    syncingRef.current = true;
    setIsDrinkCommitting(true);
    setActionSyncing(true);
    setActionError(null);
    resetHoldUi();

    const optimistic = { ...before, growth: 0 };
    stateRef.current = optimistic;
    setState(optimistic);
    setDisplayGrowth(0);
    displayGrowthRef.current = 0;

    void commitDrink(before);
  }, [commitDrink, loading, resetHoldUi, showSceneDialogue]);

  const runTestBump = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession?.userId) {
      showSceneDialogue('백엔드 서버를 실행해 주세요.');
      return;
    }

    const prev = stateRef.current;
    if (prev.redeemed || isReadyToDrinkGrowth(prev.growth)) return;

    const holdStart = roundGrowth(prev.growth);
    setActionError(null);

    try {
      const result = await testBumpGame();
      applyWaterServerState(result.state, holdStart);
      setActionError(null);
      triggerTapBurst();
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyWaterServerState(err.state, holdStart);
      }
      if (!(err instanceof ApiRequestError && err.status === 429)) {
        const message = err instanceof Error ? err.message : '테스트 물주기에 실패했습니다.';
        setActionError(message);
        showSceneDialogue(message);
      }
    }
  }, [applyWaterServerState, showSceneDialogue, triggerTapBurst]);

  const testBumpGrowth = useCallback(() => {
    if (loading || holdStartRef.current !== null) return;

    testQueueRef.current = testQueueRef.current
      .then(() => runTestBump())
      .catch(() => undefined);
  }, [loading, runTestBump]);

  const reset = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    setError(null);
    resetHoldUi();
    hideSceneDialogue();
    setLastEarned(null);

    try {
      const result = await resetGame();
      applyAuthoritativeState(result.state);
    } catch (err) {
      const message = err instanceof Error ? err.message : '초기화에 실패했습니다.';
      setError(message);
    }
  }, [applyAuthoritativeState, hideSceneDialogue, resetHoldUi]);

  const purchaseVariant = useCallback(
    async (slug: string) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setActionSyncing(true);
      setActionError(null);

      try {
        const result = await purchaseCoffeeVariant(slug);
        applyAuthoritativeState(result.state);
        if (result.playerRank != null) {
          updatePlayerRank(result.playerRank);
        }
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state);
        }
        const message = err instanceof Error ? err.message : '캐릭터 구매에 실패했습니다.';
        setActionError(message);
      } finally {
        syncingRef.current = false;
        setActionSyncing(false);
      }
    },
    [applyAuthoritativeState, updatePlayerRank],
  );

  const selectVariant = useCallback(
    async (slug: string) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setActionSyncing(true);
      setActionError(null);

      try {
        const result = await selectCoffeeVariant(slug);
        applyAuthoritativeState(result.state);
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state);
        }
        const message = err instanceof Error ? err.message : '캐릭터 선택에 실패했습니다.';
        setActionError(message);
      } finally {
        syncingRef.current = false;
        setActionSyncing(false);
      }
    },
    [applyAuthoritativeState],
  );

  const watchAd = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession?.userId || watchingAd || syncingRef.current) return;

    const prev = stateRef.current;
    if (prev.redeemed || isReadyToDrinkGrowth(prev.growth) || !needsAdForWater(prev)) return;

    setWatchingAd(true);
    setActionError(null);

    try {
      const watched = await watchRewardedAd();
      if (!watched) return;

      const result = await watchAdGame();
      applyAuthoritativeState(result.state);
      showSceneDialogue(sceneDialogueForAdReward());
    } catch (err) {
      const message = err instanceof Error ? err.message : '광고 보상 처리에 실패했습니다.';
      setActionError(message);
      showSceneDialogue(message);
    } finally {
      setWatchingAd(false);
    }
  }, [applyAuthoritativeState, watchingAd, showSceneDialogue]);

  useEffect(
    () => () => {
      clearHoldTimer();
      if (sceneDialogueTimerRef.current !== null) {
        clearTimeout(sceneDialogueTimerRef.current);
      }
      if (tapBurstTimerRef.current !== null) {
        clearTimeout(tapBurstTimerRef.current);
      }
    },
    [clearHoldTimer],
  );

  const progress = Math.min(100, (state.money / GOAL_AMOUNT) * 100);
  const drinkUiActive =
    (isReadyToDrinkGrowth(state.growth) || isDrinkCommitting) &&
    !state.redeemed &&
    !isHolding;
  const readyToDrink =
    isReadyToDrinkGrowth(state.growth) &&
    !state.redeemed &&
    !actionSyncing &&
    !isHolding;
  const holdRemainingSec = Math.max(0, holdTargetSec - holdElapsedSec);
  const waterStatus = getWaterStatus(state);
  const needsAd = waterStatus.needsAd && !readyToDrink;
  const showWatchAdButton =
    needsAd || (!waterStatus.canWater && !readyToDrink && !isReadyToDrinkGrowth(state.growth));
  const passiveActive = canAccruePassiveGrowth(state.growth, state.redeemed);

  return {
    session,
    state,
    displayGrowth,
    balanceRules,
    loading,
    error,
    actionError,
    loggingIn,
    authMessage,
    loginWithToss,
    logout,
    isTossInApp: isTossInApp(),
    startHold,
    stopHold,
    completeDrink,
    testBumpGrowth,
    purchaseVariant,
    selectVariant,
    reset,
    watchAd,
    progress,
    readyToDrink,
    drinkUiActive,
    isDrinkCommitting,
    needsAd,
    showWatchAdButton,
    canWater: waterStatus.canWater,
    waterStatus,
    watchingAd,
    actionSyncing,
    passiveActive,
    holdMode,
    lastEarned,
    tapBurst,
    isHolding,
    holdProgress,
    holdTargetSec,
    holdElapsedSec,
    holdRemainingSec,
    remaining: Math.max(0, GOAL_AMOUNT - state.money),
    sceneDialogue,
    showSceneDialogue,
    updatePlayerRank,
  };
}
