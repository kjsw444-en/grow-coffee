import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiRequestError,
  claimPassiveCoffeeGame,
  devBumpPassiveGame,
  drinkGame,
  fetchGameState,
  purchaseCoffeeVariant,
  reactivatePassiveCoffeeGame,
  resetGame,
  selectCoffeeVariant,
  sellCoffeeBatch,
  signOutPlayer,
  testBumpGame,
  watchAdGame,
  waterGame,
  type PlayerSession,
} from '../services/api';
import { shouldShowDrinkCycleInterstitial, showInterstitialAd } from '../services/interstitialAd';
import { watchRewardedAd } from '../services/rewardedAd';
import { initPlayerSession, isTossInApp, loginWithTossSession } from '../services/tossBridge';
import {
  type HoldMode,
  COFFEE_STAGE_MIN,
  DAILY_PASSIVE_GROWTH_CAP,
  DISPLAY_GROWTH_COMMIT_MS,
  GOAL_AMOUNT,
  GROWTH_DISPLAY_DECIMALS,
  randomWaterDurationSec,
  SELL_BATCH_REWARD,
  SELL_BATCH_SIZE,
} from './constants';
import {
  normalizeOwnedCoffeeVariants,
} from './coffeeVariants';
import { normalizeSelectedCoffeeVariant } from './hiddenCoffeeVariants';
import {
  commitWaterGrowth,
  isReadyToDrinkGrowth,
  previewHoldDisplayGrowth,
  resolveWaterSyncGrowth,
  sanitizeGrowthForWaters,
} from './growthHold';
import {
  sceneDialogueForAdReward,
  sceneDialogueForDrink,
  sceneDialogueForGrowthComplete,
  sceneDialogueForHoldCancel,
  sceneDialogueForHoldStart,
  sceneDialogueForPassiveClaim,
  sceneDialogueForPassiveReady,
  sceneDialogueForPassiveReactivate,
  sceneDialogueForSellBatch,
  sceneDialogueForShareReward,
  SCENE_DIALOGUE_IDLE_MS,
} from './sceneDialogue';
import { getRefillActionLabel, getStage } from './utils';
import {
  type BalanceRules,
  buildPassiveCoffeeClaim,
  buildPassiveReactivate,
  buildResetState,
  canAccruePassiveGrowth,
  DEFAULT_BALANCE_RULES,
  getPassiveGrowthAccrualCap,
  getPassiveUiStats,
  repairGrowthAccrualSyncedAt,
  roundGrowth,
  mergePassiveQuotaFromServer,
  normalizePassiveQuota,
  withNormalizedPassive,
} from './passiveGrowth';
import { initialState, type GameState } from './types';
import {
  canUseGrowHold,
  consumeWaterQuota,
  getGrowActionSlot,
  getWaterStatus,
  grantAdWaterCredit,
  mergeWaterQuotaFromServer,
  needsAdForWater,
  normalizeWaterQuota,
  withNormalizedQuota,
} from './waterQuota';
import { usePassiveGrowthTick } from './usePassiveGrowthTick';
import { canClaimShareRewardToday } from './shareRewardQuota';
import { runShareRewardFlow, shareRewardStatusMessage } from '../services/shareReward';

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
    growth: sanitizeGrowthForWaters(raw.growth ?? 0),
    money: readCount(raw, 'money', 'money'),
    totalCoffees: readCount(raw, 'totalCoffees', 'total_coffees'),
    totalWaters,
    spentCoffeeCups: readCount(raw, 'spentCoffeeCups', 'spent_coffee_cups'),
    waterDayKey: String(
      raw.waterDayKey ?? (raw as GameState & { water_day_key?: string }).water_day_key ?? '',
    ),
    watersToday: readCount(raw, 'watersToday', 'waters_today'),
    adWaterCredits: readCount(raw, 'adWaterCredits', 'ad_water_credits'),
    growthAccrualSyncedAt: repairGrowthAccrualSyncedAt(raw),
    passiveDayKey: String(
      raw.passiveDayKey ?? (raw as GameState & { passive_day_key?: string }).passive_day_key ?? '',
    ),
    dailyPassiveGrowth: readCount(raw, 'dailyPassiveGrowth', 'daily_passive_growth'),
    passiveCoffeesClaimed: readCount(raw, 'passiveCoffeesClaimed', 'passive_coffees_claimed'),
    shareRewardDayKey: String(
      raw.shareRewardDayKey ?? (raw as GameState & { share_reward_day_key?: string }).share_reward_day_key ?? '',
    ),
    passiveReactivateDayKey: String(
      raw.passiveReactivateDayKey ??
        (raw as GameState & { passive_reactivate_day_key?: string }).passive_reactivate_day_key ??
        '',
    ),
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

const HOLD_UI_COMMIT_MS = 80;
const DISPLAY_GROWTH_MIN_DELTA = 1 / 10 ** GROWTH_DISPLAY_DECIMALS;

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
  const [sharingReward, setSharingReward] = useState(false);
  const [sellingBatch, setSellingBatch] = useState(false);
  const [actionSyncing, setActionSyncing] = useState(false);
  const [isDrinkCommitting, setIsDrinkCommitting] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);
  const [claimingPassiveCoffee, setClaimingPassiveCoffee] = useState(false);
  const [passiveClaimFeedback, setPassiveClaimFeedback] = useState<{
    tone: 'error' | 'success';
    text: string;
  } | null>(null);
  const claimingPassiveRef = useRef(false);
  const passiveClaimSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reactivatingPassiveCoffee, setReactivatingPassiveCoffee] = useState(false);
  const [sceneDialogue, setSceneDialogue] = useState<string | null>(null);
  const [passiveClock, setPassiveClock] = useState(0);

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
  const stateEpochRef = useRef(0);
  const displayGrowthRef = useRef(0);
  const prevPassiveCanClaimRef = useRef(false);
  const holdStartGrowthRef = useRef<number | null>(null);
  const holdDisplayStartRef = useRef(0);
  const holdSyncCommittedRef = useRef(false);
  const holdPreflightRef = useRef(false);
  const sceneDialogueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayGrowthFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDisplayGrowthCommitAtRef = useRef(0);
  const lastCommittedDisplayRef = useRef(0);
  const testQueueRef = useRef(Promise.resolve());
  const balanceRulesRef = useRef(balanceRules);
  const drinkCycleCountRef = useRef(0);

  balanceRulesRef.current = balanceRules;
  stateRef.current = state;
  holdModeRef.current = holdMode;
  sessionRef.current = session;
  displayGrowthRef.current = displayGrowth;

  const commitDisplayGrowth = useCallback((next: number, force = false) => {
    const rounded = roundGrowth(Math.min(100, Math.max(0, next)));
    displayGrowthRef.current = rounded;

    const flush = () => {
      if (displayGrowthFlushTimerRef.current !== null) {
        clearTimeout(displayGrowthFlushTimerRef.current);
        displayGrowthFlushTimerRef.current = null;
      }
      const value = displayGrowthRef.current;
      lastDisplayGrowthCommitAtRef.current = performance.now();
      lastCommittedDisplayRef.current = value;
      setDisplayGrowth(value);
    };

    if (force || rounded >= 100 || rounded <= 0) {
      flush();
      return;
    }

    const delta = Math.abs(rounded - lastCommittedDisplayRef.current);
    const now = performance.now();
    if (delta < DISPLAY_GROWTH_MIN_DELTA) return;

    if (now - lastDisplayGrowthCommitAtRef.current >= DISPLAY_GROWTH_COMMIT_MS) {
      flush();
      return;
    }

    if (displayGrowthFlushTimerRef.current === null) {
      const wait = DISPLAY_GROWTH_COMMIT_MS - (now - lastDisplayGrowthCommitAtRef.current);
      displayGrowthFlushTimerRef.current = setTimeout(() => {
        displayGrowthFlushTimerRef.current = null;
        flush();
      }, wait);
    }
  }, []);

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

  const applyAuthoritativeState = useCallback(
    (raw: GameState, options?: { trustServer?: boolean; epoch?: number }) => {
      if (options?.epoch !== undefined && options.epoch !== stateEpochRef.current) {
        return stateRef.current;
      }
      const trustServer = options?.trustServer ?? false;
      const mergedQuota = trustServer
        ? normalizeWaterQuota(raw)
        : mergeWaterQuotaFromServer(stateRef.current, raw);
      const mergedPassive = trustServer
        ? {
            ...normalizePassiveQuota(raw),
            passiveReactivateDayKey: String(raw.passiveReactivateDayKey ?? ''),
          }
        : mergePassiveQuotaFromServer(stateRef.current, raw);
      const next = normalizeLoadedState({ ...raw, ...mergedQuota, ...mergedPassive });
      stateRef.current = next;
      setState(next);
      commitDisplayGrowth(next.growth, true);
      lastBootstrapAtRef.current = Date.now();
      return next;
    },
    [commitDisplayGrowth],
  );

  const bumpPassiveClock = useCallback(() => {
    setPassiveClock((value) => value + 1);
  }, []);

  const applyPassiveAccrual = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
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

  const releasePassiveClaimUi = useCallback(() => {
    if (passiveClaimSafetyTimerRef.current !== null) {
      clearTimeout(passiveClaimSafetyTimerRef.current);
      passiveClaimSafetyTimerRef.current = null;
    }
    claimingPassiveRef.current = false;
    syncingRef.current = false;
    setClaimingPassiveCoffee(false);
    setActionSyncing(false);
  }, []);

  const beginPassiveClaimUi = useCallback(() => {
    releasePassiveClaimUi();
    claimingPassiveRef.current = true;
    setClaimingPassiveCoffee(true);
    passiveClaimSafetyTimerRef.current = setTimeout(() => {
      if (!claimingPassiveRef.current) return;
      passiveClaimSafetyTimerRef.current = null;
      releasePassiveClaimUi();
      setPassiveClaimFeedback({
        tone: 'error',
        text: import.meta.env.DEV
          ? '요청이 멈췄어요. 백엔드 npm run dev 실행 후 Ctrl+Shift+R 새로고침해 주세요.'
          : '요청이 멈췄어요. 네트워크 확인 후 다시 시도해 주세요.',
      });
    }, 13000);
  }, [releasePassiveClaimUi]);

  const applyStateWithPreview = useCallback(
    (raw: GameState, holdStartGrowth?: number, epoch?: number) => {
      const growth =
        holdStartGrowth !== undefined
          ? resolveWaterSyncGrowth(holdStartGrowth, raw.growth)
          : raw.growth;
      return applyAuthoritativeState({ ...raw, growth }, { epoch });
    },
    [applyAuthoritativeState],
  );

  const applyWaterServerState = useCallback(
    (serverState: GameState, holdStartGrowth: number, epoch?: number) =>
      applyStateWithPreview(serverState, holdStartGrowth, epoch),
    [applyStateWithPreview],
  );

  const applySession = useCallback(
    (next: PlayerSession & { state?: GameState; balanceRules?: BalanceRules; connectionError?: string }) => {
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
      if (next.source === 'mock') {
        setConnectionWarning(
          next.connectionError
            ? `서버 연결 실패 · 오프라인으로 플레이 중 (${next.connectionError})`
            : '오프라인 모드 · 진행은 이 기기에만 저장돼요',
        );
        setError(null);
      } else {
        setConnectionWarning(null);
        setError(null);
      }
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

    commitDisplayGrowth(holdDisplayStartRef.current, true);
  }, [commitDisplayGrowth]);

  const syncAction = useCallback(
    async (mode: HoldMode) => {
      const currentSession = sessionRef.current;
      if (!currentSession?.userId || syncingRef.current) {
        holdSyncCommittedRef.current = false;
        resetHoldUi();
        return;
      }

      const epoch = stateEpochRef.current;
      const before = stateRef.current;
      const beforeGrowth = roundGrowth(before.growth);
      const lockedHoldStart = holdStartGrowthRef.current ?? beforeGrowth;
      syncingRef.current = true;
      setActionSyncing(true);
      setActionError(null);

      if (
        (mode === 'water' || mode === 'brew') &&
        !before.redeemed &&
        canUseGrowHold(before)
      ) {
        const optimistic = consumeWaterQuota(before);
        const nextGrowth = commitWaterGrowth(lockedHoldStart);

        if (nextGrowth > beforeGrowth) {
          const optimisticState = {
            ...optimistic,
            growth: nextGrowth,
            totalWaters: before.totalWaters + 1,
          };
          stateRef.current = optimisticState;
          commitDisplayGrowth(nextGrowth, true);
          setState(optimisticState);
          triggerTapBurst();
        }
      }

      try {
        const result = await waterGame();
        applyWaterServerState(result.state, lockedHoldStart, epoch);
        setLastEarned(result.lastEarned);
        const synced = resolveWaterSyncGrowth(lockedHoldStart, result.state.growth);
        if (needsAdForWater(stateRef.current)) {
          const refillLabel = getRefillActionLabel(stateRef.current.growth);
          showSceneDialogue(`물주기·내리기 1회 완료! 「${refillLabel}」를 눌러 주세요.`);
        } else {
          const stage = getStage(synced);
          showSceneDialogue(sceneDialogueForGrowthComplete(mode, stage.label, synced));
        }
      } catch (err) {
        if (isWaterCooldownError(err) && err.state) {
          applyWaterServerState(err.state, lockedHoldStart, epoch);
        } else if (
          (mode === 'water' || mode === 'brew') &&
          err instanceof ApiRequestError &&
          err.state
        ) {
          applyWaterServerState(err.state, lockedHoldStart, epoch);
          if (needsAdForWater(err.state)) {
            const refillLabel = getRefillActionLabel(err.state.growth);
            showSceneDialogue(`물주기·내리기 1회 완료! 「${refillLabel}」를 눌러 주세요.`);
          } else {
            const growth = roundGrowth(err.state.growth);
            const stage = getStage(growth);
            showSceneDialogue(sceneDialogueForGrowthComplete(mode, stage.label, growth));
          }
        } else {
          applyAuthoritativeState(before, { epoch });
          const revertGrowth =
            (mode === 'water' || mode === 'brew') && holdStartGrowthRef.current !== null
              ? holdStartGrowthRef.current
              : before.growth;
          commitDisplayGrowth(revertGrowth, true);
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
      commitDisplayGrowth,
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

    if (holdModeRef.current === 'water' || holdModeRef.current === 'brew') {
      const startGrowth = holdStartGrowthRef.current;
      if (startGrowth !== null) {
        commitDisplayGrowth(
          previewHoldDisplayGrowth(startGrowth, holdDisplayStartRef.current, progress),
          true,
        );
      }
    }

    const now = performance.now();
    const shouldCommitUi = now - lastHoldUiCommitRef.current >= HOLD_UI_COMMIT_MS || progress >= 100;
    if (shouldCommitUi) {
      lastHoldUiCommitRef.current = now;
      setHoldProgress((prev) => (Math.abs(prev - progress) < 0.01 ? prev : progress));
      setHoldElapsedSec((prev) => (prev === elapsedRounded ? prev : elapsedRounded));
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
  }, [clearHoldTimer, commitDisplayGrowth, syncAction]);

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
    if (!canUseGrowHold(stateRef.current)) {
      if (needsAdForWater(stateRef.current)) {
        const refillLabel = getRefillActionLabel(stateRef.current.growth);
        showSceneDialogue(`「${refillLabel}」를 눌러야 물주기·내리기를 다시 할 수 있어요.`);
      }
      return;
    }

    holdPreflightRef.current = true;
    try {
      const activeState = stateRef.current;

      const authoritativeGrowth = roundGrowth(activeState.growth);
      const displayStartGrowth = roundGrowth(displayGrowthRef.current);
      if (activeState.redeemed || holdStartRef.current !== null || syncingRef.current) return;
      if (isReadyToDrinkGrowth(activeState.growth)) return;
      if (!canUseGrowHold(activeState)) return;

      const mode: HoldMode =
        authoritativeGrowth >= COFFEE_STAGE_MIN ? 'brew' : 'water';

      const duration = randomWaterDurationSec();
      holdDurationRef.current = duration;
      holdStartRef.current = performance.now();
      holdProgressRef.current = 0;
      holdStartGrowthRef.current = authoritativeGrowth;
      holdDisplayStartRef.current = displayStartGrowth;
      commitDisplayGrowth(displayStartGrowth, true);

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
    clearHoldTimer,
    commitDisplayGrowth,
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

  const commitDrink = useCallback(async (before: GameState, epoch: number) => {
    try {
      const result = await drinkGame();
      applyAuthoritativeState({ ...result.state, growth: 0 }, { epoch });
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      setLastEarned(result.lastEarned);
      setActionError(null);
      showSceneDialogue(sceneDialogueForDrink());
      triggerTapBurst();

      drinkCycleCountRef.current += 1;
      if (shouldShowDrinkCycleInterstitial(drinkCycleCountRef.current)) {
        void showInterstitialAd();
      }
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state, { epoch });
      } else {
        applyAuthoritativeState(before, { epoch });
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
    if (before.redeemed) return;
    if (!isReadyToDrinkGrowth(before.growth) && !isReadyToDrinkGrowth(displayGrowthRef.current)) return;

    syncingRef.current = true;
    setIsDrinkCommitting(true);
    setActionSyncing(true);
    setActionError(null);
    resetHoldUi();

    const optimistic = { ...before, growth: 0 };
    stateRef.current = optimistic;
    setState(optimistic);
    commitDisplayGrowth(0, true);

    void commitDrink(before, stateEpochRef.current);
  }, [commitDisplayGrowth, commitDrink, loading, resetHoldUi, showSceneDialogue]);

  const runTestBump = useCallback(async () => {
    const prev = stateRef.current;
    if (prev.redeemed) {
      showSceneDialogue('이미 목표를 달성했어요.');
      return;
    }

    if (isReadyToDrinkGrowth(prev.growth)) {
      showSceneDialogue('성장 100%예요. 커피를 마신 뒤 다시 테스트해 주세요.');
      return;
    }

    const applyLocalDevBump = () => {
      const next = {
        ...prev,
        growth: commitWaterGrowth(prev.growth),
        totalWaters: prev.totalWaters + 1,
      };
      applyAuthoritativeState(next);
      commitDisplayGrowth(next.growth, true);
      setActionError(null);
      triggerTapBurst();
    };

    const currentSession = sessionRef.current;
    if (!currentSession?.userId) {
      if (import.meta.env.DEV) {
        applyLocalDevBump();
        return;
      }
      showSceneDialogue('백엔드 서버를 실행해 주세요.');
      return;
    }

    const holdStart = roundGrowth(prev.growth);
    const epoch = stateEpochRef.current;
    setActionError(null);

    try {
      const result = await testBumpGame();
      applyWaterServerState(result.state, holdStart, epoch);
      setActionError(null);
      triggerTapBurst();
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyWaterServerState(err.state, holdStart, epoch);
      }
      if (err instanceof ApiRequestError && err.status === 400) {
        showSceneDialogue(err.message || '테스트 물주기를 할 수 없어요.');
        return;
      }
      if (!(err instanceof ApiRequestError && err.status === 429)) {
        const message = err instanceof Error ? err.message : '테스트 물주기에 실패했습니다.';
        setActionError(message);
        showSceneDialogue(message);
      }
    }
  }, [
    applyAuthoritativeState,
    applyWaterServerState,
    commitDisplayGrowth,
    showSceneDialogue,
    triggerTapBurst,
  ]);

  const testBumpGrowth = useCallback(() => {
    if (loading || isHolding || holdStartRef.current !== null || syncingRef.current) return;

    testQueueRef.current = testQueueRef.current
      .then(() => runTestBump())
      .catch(() => undefined);
  }, [isHolding, loading, runTestBump]);

  const testBumpPassiveGrowth = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    if (loading || isHolding || syncingRef.current || claimingPassiveRef.current) return;

    const prev = stateRef.current;
    if (prev.redeemed) {
      showSceneDialogue('이미 목표를 달성했어요.');
      return;
    }

    const stats = getPassiveUiStats(prev, balanceRulesRef.current);
    if (stats.complete) {
      showSceneDialogue(
        stats.canReactivate
          ? '방치 커피 2/2 · 재활성 후 다시 충전할 수 있어요.'
          : '오늘 방치 커피는 모두 받았어요.',
      );
      return;
    }

    const currentSession = sessionRef.current;
    const epoch = stateEpochRef.current;

    if (currentSession?.userId) {
      try {
        const result = await devBumpPassiveGame();
        applyAuthoritativeState(result.state, { trustServer: true, epoch });
        bumpPassiveClock();
        setPassiveClaimFeedback(null);
        showSceneDialogue('테스트: 방치 커피 게이지 +100% (서버 반영)');
        return;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { trustServer: true, epoch });
          bumpPassiveClock();
        }
        const message = err instanceof Error ? err.message : '방치 커피 테스트 충전에 실패했습니다.';
        setPassiveClaimFeedback({
          tone: 'error',
          text: message,
        });
        showSceneDialogue(message);
        return;
      }
    }

    const next = {
      ...prev,
      dailyPassiveGrowth: Math.min(
        getPassiveGrowthAccrualCap(prev.passiveCoffeesClaimed, DAILY_PASSIVE_GROWTH_CAP),
        prev.dailyPassiveGrowth + 100,
      ),
      growthAccrualSyncedAt: new Date().toISOString(),
    };
    applyAuthoritativeState(next);
    bumpPassiveClock();
    showSceneDialogue('테스트: 방치 커피 게이지 +100%');
  }, [applyAuthoritativeState, bumpPassiveClock, loading, isHolding, showSceneDialogue]);

  const reset = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    stateEpochRef.current += 1;
    const epoch = stateEpochRef.current;

    setError(null);
    resetHoldUi();
    hideSceneDialogue();
    setLastEarned(null);
    prevPassiveCanClaimRef.current = false;
    drinkCycleCountRef.current = 0;
    syncingRef.current = true;
    setActionSyncing(true);

    const resetState = normalizeLoadedState(buildResetState());
    applyAuthoritativeState(resetState, { trustServer: true, epoch });
    bumpPassiveClock();

    try {
      const result = await resetGame();
      applyAuthoritativeState(normalizeLoadedState(result.state), { trustServer: true, epoch });
      bumpPassiveClock();
    } catch (err) {
      const message = err instanceof Error ? err.message : '초기화에 실패했습니다.';
      setError(message);
    } finally {
      syncingRef.current = false;
      setActionSyncing(false);
    }
  }, [applyAuthoritativeState, bumpPassiveClock, hideSceneDialogue, resetHoldUi]);

  const purchaseVariant = useCallback(
    async (slug: string) => {
      if (syncingRef.current) return;
      const epoch = stateEpochRef.current;
      syncingRef.current = true;
      setActionSyncing(true);
      setActionError(null);

      try {
        const result = await purchaseCoffeeVariant(slug);
        applyAuthoritativeState(result.state, { epoch });
        if (result.playerRank != null) {
          updatePlayerRank(result.playerRank);
        }
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { epoch });
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
      const epoch = stateEpochRef.current;
      syncingRef.current = true;
      setActionSyncing(true);
      setActionError(null);

      try {
        const result = await selectCoffeeVariant(slug);
        applyAuthoritativeState(result.state, { epoch });
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { epoch });
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
    if (watchingAd) return;

    const prev = stateRef.current;
    if (prev.redeemed || !needsAdForWater(prev)) return;

    if (!currentSession?.userId) {
      showSceneDialogue('백엔드 서버를 실행해 주세요.');
      return;
    }

    if (syncingRef.current) {
      showSceneDialogue('잠시만 기다려 주세요…');
      return;
    }
    if (
      isReadyToDrinkGrowth(prev.growth) ||
      isReadyToDrinkGrowth(displayGrowthRef.current)
    ) {
      showSceneDialogue('커피가 완성됐어요! 먼저 커피 마시기를 눌러 주세요.');
      return;
    }

    setWatchingAd(true);
    setActionError(null);
    const epoch = stateEpochRef.current;

    try {
      const watched = await watchRewardedAd();
      if (!watched) {
        showSceneDialogue('확인을 완료해야 물주기·내리기를 다시 할 수 있어요.');
        return;
      }

      const optimistic = grantAdWaterCredit(prev);
      stateRef.current = optimistic;
      setState(optimistic);

      const result = await watchAdGame();
      applyAuthoritativeState(result.state, { epoch });
      showSceneDialogue(sceneDialogueForAdReward());
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state, { epoch });
      } else {
        applyAuthoritativeState(prev, { epoch });
      }
      const message = err instanceof Error ? err.message : '물 채우기 처리에 실패했습니다.';
      setActionError(message);
      showSceneDialogue(message);
    } finally {
      setWatchingAd(false);
    }
  }, [applyAuthoritativeState, watchingAd, showSceneDialogue]);

  const claimShareReward = useCallback(
    async (onMessage?: (message: string) => void) => {
      const currentSession = sessionRef.current;
      if (sharingReward) {
        return '공유를 처리하는 중이에요…';
      }
      if (syncingRef.current) {
        return '다른 동작을 처리 중이에요. 잠시 후 다시 시도해 주세요.';
      }
      if (!currentSession?.userId) {
        return shareRewardStatusMessage({
          status: 'unsupported',
          message: '백엔드 서버를 실행해 주세요.',
        });
      }

      const before = stateRef.current;
      if (before.redeemed || !canClaimShareRewardToday(before)) {
        return '오늘 공유 리워드는 이미 받았어요. 내일 다시 시도해 주세요.';
      }

      setSharingReward(true);
      setActionError(null);
      const epoch = stateEpochRef.current;

      try {
        const outcome = await runShareRewardFlow({ onMessage });

        if ('state' in outcome && outcome.state) {
          applyAuthoritativeState(outcome.state, { epoch });
        }

        if (outcome.status === 'rewarded') {
          if (outcome.playerRank != null) {
            updatePlayerRank(outcome.playerRank);
          }
          showSceneDialogue(sceneDialogueForShareReward(outcome.amount));
        } else if (outcome.status === 'error') {
          setActionError(outcome.message);
        }

        return shareRewardStatusMessage(outcome);
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { epoch });
        }
        const message = err instanceof Error ? err.message : '공유 리워드 처리에 실패했습니다.';
        setActionError(message);
        return message;
      } finally {
        setSharingReward(false);
      }
    },
    [applyAuthoritativeState, sharingReward, showSceneDialogue, updatePlayerRank],
  );

  const claimPassiveCoffee = useCallback(async () => {
    if (claimingPassiveRef.current) {
      if (claimingPassiveCoffee) {
        setPassiveClaimFeedback({ tone: 'error', text: '잠시만 기다려 주세요…' });
        showSceneDialogue('잠시만 기다려 주세요…');
        return false;
      }
      claimingPassiveRef.current = false;
    }

    const epoch = stateEpochRef.current;
    const currentSession = sessionRef.current;
    const before = stateRef.current;

    if (before.redeemed) {
      setPassiveClaimFeedback({ tone: 'error', text: '이미 목표를 달성했어요.' });
      showSceneDialogue('이미 목표를 달성했어요.');
      return false;
    }

    const uiStats = getPassiveUiStats(before, balanceRulesRef.current);
    if (!uiStats.canClaim) {
      setPassiveClaimFeedback({ tone: 'error', text: '아직 방치 커피가 차지 않았어요.' });
      showSceneDialogue('아직 방치 커피가 차지 않았어요.');
      return false;
    }

    const preview = buildPassiveCoffeeClaim(before, balanceRulesRef.current);
    if (!preview.ok) {
      const text =
        preview.reason === 'not-ready'
          ? '아직 방치 커피가 차지 않았어요.'
          : '방치 커피를 받을 수 없어요.';
      setPassiveClaimFeedback({ tone: 'error', text });
      showSceneDialogue(text);
      return false;
    }

    if (!currentSession?.userId) {
      applyAuthoritativeState(preview.state, { trustServer: true, epoch });
      setLastEarned(preview.lastEarned);
      bumpPassiveClock();
      triggerTapBurst();
      setPassiveClaimFeedback({
        tone: 'success',
        text: '✓ 방치 커피 1잔 · 내린 커피 +1',
      });
      showSceneDialogue(sceneDialogueForPassiveClaim());
      return true;
    }

    beginPassiveClaimUi();
    setActionError(null);
    setPassiveClaimFeedback(null);

    const syncedBefore = stateRef.current;
    applyAuthoritativeState(preview.state, { trustServer: true, epoch });
    setLastEarned(preview.lastEarned);
    bumpPassiveClock();

    try {
      const result = await claimPassiveCoffeeGame();
      applyAuthoritativeState(result.state, { trustServer: true, epoch });
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      setLastEarned(result.lastEarned);
      bumpPassiveClock();
      triggerTapBurst();
      setPassiveClaimFeedback({
        tone: 'success',
        text: '✓ 방치 커피 1잔 · 내린 커피 +1',
      });
      showSceneDialogue(sceneDialogueForPassiveClaim());
      return true;
    } catch (err) {
      setLastEarned(null);
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state, { trustServer: true, epoch });
      } else {
        applyAuthoritativeState(syncedBefore, { trustServer: true, epoch });
      }
      bumpPassiveClock();
      const message = err instanceof Error ? err.message : '방치 커피 받기에 실패했습니다.';
      setPassiveClaimFeedback({ tone: 'error', text: message });
      setActionError(message);
      showSceneDialogue(message);
      return false;
    } finally {
      releasePassiveClaimUi();
    }
  }, [
    applyAuthoritativeState,
    beginPassiveClaimUi,
    bumpPassiveClock,
    claimingPassiveCoffee,
    releasePassiveClaimUi,
    showSceneDialogue,
    triggerTapBurst,
    updatePlayerRank,
  ]);

  const reactivatePassiveCoffee = useCallback(async () => {
    if (reactivatingPassiveCoffee || claimingPassiveCoffee || watchingAd) {
      return false;
    }

    if (syncingRef.current) {
      showSceneDialogue('잠시만 기다려 주세요…');
      return false;
    }

    const epoch = stateEpochRef.current;
    const currentSession = sessionRef.current;

    if (currentSession?.userId) {
      try {
        const fresh = await fetchGameState();
        applyAuthoritativeState(fresh, { trustServer: true, epoch });
        bumpPassiveClock();
      } catch {
        // 로컬 상태로 진행
      }
    }

    const before = stateRef.current;
    const preview = buildPassiveReactivate(before);

    if (!preview.ok) {
      if (preview.reason === 'not-complete') {
        showSceneDialogue('방치 커피 2잔을 모두 받은 뒤 재활성할 수 있어요.');
      } else if (preview.reason === 'already-reactivated') {
        showSceneDialogue('오늘 방치 커피 재활성은 이미 사용했어요.');
      } else {
        showSceneDialogue('방치 커피를 재활성할 수 없어요.');
      }
      return false;
    }

    setReactivatingPassiveCoffee(true);
    setActionError(null);

    try {
      const watched = await watchRewardedAd();
      if (!watched) {
        showSceneDialogue('광고 시청을 완료해야 재활성할 수 있어요.');
        return false;
      }

      if (!currentSession?.userId) {
        applyAuthoritativeState(preview.state, { trustServer: true, epoch });
        bumpPassiveClock();
        showSceneDialogue(sceneDialogueForPassiveReactivate());
        return true;
      }

      syncingRef.current = true;
      setActionSyncing(true);

      try {
        const result = await reactivatePassiveCoffeeGame();
        applyAuthoritativeState(result.state, { trustServer: true, epoch });
        bumpPassiveClock();
        showSceneDialogue(sceneDialogueForPassiveReactivate());
        return true;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { trustServer: true, epoch });
          bumpPassiveClock();
        } else {
          applyAuthoritativeState(before, { trustServer: true, epoch });
          bumpPassiveClock();
        }
        const message = err instanceof Error ? err.message : '방치 커피 재활성에 실패했습니다.';
        setActionError(message);
        showSceneDialogue(message);
        return false;
      } finally {
        syncingRef.current = false;
        setActionSyncing(false);
      }
    } finally {
      setReactivatingPassiveCoffee(false);
    }
  }, [
    applyAuthoritativeState,
    bumpPassiveClock,
    claimingPassiveCoffee,
    reactivatingPassiveCoffee,
    showSceneDialogue,
    watchingAd,
  ]);

  const sellBatch = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession?.userId) {
      const message = '백엔드 서버를 실행하고 게스트 로그인 후 다시 시도해 주세요.';
      setActionError(message);
      showSceneDialogue(message);
      return false;
    }

    if (syncingRef.current) {
      const message = '다른 동작을 처리 중이에요. 잠시 후 다시 시도해 주세요.';
      showSceneDialogue(message);
      return false;
    }

    const before = stateRef.current;
    if (before.redeemed) {
      showSceneDialogue('이미 목표를 달성했어요.');
      return false;
    }

    if (before.totalCoffees < SELL_BATCH_SIZE) {
      const message = `판매하려면 내린 커피 ${SELL_BATCH_SIZE}잔이 필요해요.`;
      setActionError(message);
      showSceneDialogue(message);
      return false;
    }

    syncingRef.current = true;
    setSellingBatch(true);
    setActionSyncing(true);
    setActionError(null);
    const epoch = stateEpochRef.current;

    const nextMoney = before.money + SELL_BATCH_REWARD;
    const optimistic = {
      ...before,
      totalCoffees: before.totalCoffees - SELL_BATCH_SIZE,
      money: nextMoney,
      redeemed: nextMoney >= GOAL_AMOUNT,
    };
    stateRef.current = optimistic;
    setState(optimistic);
    setLastEarned(SELL_BATCH_REWARD);

    try {
      const result = await sellCoffeeBatch();
      applyAuthoritativeState(result.state, { epoch });
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      setLastEarned(result.lastEarned);
      showSceneDialogue(sceneDialogueForSellBatch(result.lastEarned ?? SELL_BATCH_REWARD));
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state, { epoch });
      } else {
        stateRef.current = before;
        setState(before);
        setLastEarned(null);
      }
      const message = err instanceof Error ? err.message : '커피 판매에 실패했습니다.';
      setActionError(message);
      showSceneDialogue(message);
      return false;
    } finally {
      syncingRef.current = false;
      setSellingBatch(false);
      setActionSyncing(false);
    }
  }, [applyAuthoritativeState, showSceneDialogue, updatePlayerRank]);

  usePassiveGrowthTick({
    stateRef,
    balanceRules,
    passiveActive: canAccruePassiveGrowth(
      state.growth,
      state.redeemed,
      state.dailyPassiveGrowth,
      balanceRules.dailyPassiveGrowthCap,
      state.passiveCoffeesClaimed,
    ) && !claimingPassiveCoffee && !reactivatingPassiveCoffee,
    onPassiveUpdate: applyPassiveAccrual,
    onTick: bumpPassiveClock,
  });

  useEffect(() => {
    releasePassiveClaimUi();
    return () => {
      releasePassiveClaimUi();
    };
  }, [releasePassiveClaimUi]);

  useEffect(() => {
    const stats = getPassiveUiStats(state, balanceRules);

    if (stats.canClaim && !prevPassiveCanClaimRef.current && !state.redeemed) {
      showSceneDialogue(sceneDialogueForPassiveReady());
    }

    prevPassiveCanClaimRef.current = stats.canClaim;
  }, [balanceRules, passiveClock, showSceneDialogue, state]);

  useEffect(
    () => () => {
      clearHoldTimer();
      if (sceneDialogueTimerRef.current !== null) {
        clearTimeout(sceneDialogueTimerRef.current);
      }
      if (tapBurstTimerRef.current !== null) {
        clearTimeout(tapBurstTimerRef.current);
      }
      if (displayGrowthFlushTimerRef.current !== null) {
        clearTimeout(displayGrowthFlushTimerRef.current);
      }
    },
    [clearHoldTimer],
  );

  const progress = Math.min(100, (state.money / GOAL_AMOUNT) * 100);
  const drinkUiActive =
    ((isReadyToDrinkGrowth(state.growth) || isReadyToDrinkGrowth(displayGrowth)) ||
      isDrinkCommitting) &&
    !state.redeemed &&
    !isHolding;
  const readyToDrink =
    (isReadyToDrinkGrowth(state.growth) || isReadyToDrinkGrowth(displayGrowth)) &&
    !state.redeemed &&
    !actionSyncing &&
    !isHolding;
  const holdRemainingSec = Math.max(0, holdTargetSec - holdElapsedSec);
  const waterStatus = getWaterStatus(state);
  const needsAd = waterStatus.needsAd;
  const growActionSlot = getGrowActionSlot({
    readyToDrink,
    isDrinkCommitting,
    state,
  });
  const showWatchAdButton = growActionSlot === 'ad';
  const passiveActive =
    canAccruePassiveGrowth(
      state.growth,
      state.redeemed,
      state.dailyPassiveGrowth,
      balanceRules.dailyPassiveGrowthCap,
      state.passiveCoffeesClaimed,
    ) &&
    !claimingPassiveCoffee &&
    !reactivatingPassiveCoffee;

  return {
    session,
    state,
    displayGrowth,
    balanceRules,
    connectionWarning,
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
    testBumpPassiveGrowth,
    purchaseVariant,
    selectVariant,
    reset,
    watchAd,
    sellBatch,
    sellingBatch,
    canSellBatch: state.totalCoffees >= SELL_BATCH_SIZE && !state.redeemed,
    progress,
    readyToDrink,
    drinkUiActive,
    isDrinkCommitting,
    needsAd,
    showWatchAdButton,
    growActionSlot,
    canUseGrowHold: waterStatus.canUseGrowHold,
    waterStatus,
    watchingAd,
    sharingReward,
    shareRewardAvailable: canClaimShareRewardToday(state),
    claimShareReward,
    claimPassiveCoffee,
    claimingPassiveCoffee,
    passiveClaimFeedback,
    reactivatePassiveCoffee,
    reactivatingPassiveCoffee,
    actionSyncing,
    passiveActive,
    passiveClock,
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
