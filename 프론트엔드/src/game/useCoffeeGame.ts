import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiRequestError,
  claimBrewedCoffeeFinishBonusGame,
  claimPassiveCoffeeGame,
  claimMinigameReward as claimMinigameRewardApi,
  claimDailyLoginRouletteGame,
  devResetDailyLoginRouletteGame,
  devResetDailyRitualGame,
  respinDailyLoginRouletteGame,
  claimAttendanceDailyReward as claimAttendanceDailyRewardApi,
  claimAttendanceStreakBonus as claimAttendanceStreakBonusApi,
  devBumpPassiveGame,
  devSetTotalCoffees,
  devSetSpentCoffeeCups,
  releaseTestAddDrunkCoffees,
  releaseTestAddBrewedCoffees as releaseTestAddBrewedCoffeesApi,
  releaseTestSyncSpentCoffeeCups,
  drinkGame,
  ensureGuestSession,
  fetchGameState,
  getServerUnavailableMessage,
  isBackendConfigured,
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
import type { MissionKey } from '../services/dailyGamePlayQuota';
import { resetDailyGameSave } from '../services/dailyGameStorage';
import { claimBrewedCoffeePromotion } from '../services/brewedCoffeePromotion';
import { showInterstitialAd } from '../services/interstitialAd';
import { scheduleReviewPrompt, previewReviewPrompt, resetReviewPromptStore, REVIEW_TRIGGER_LABELS, isReviewPreviewEnabled, type ReviewTrigger } from '../services/reviewPrompt';
import { watchRewardedAd } from '../services/rewardedAd';
import { initPlayerSession, isTossInApp, loginWithTossSession } from '../services/tossBridge';
import { DEFAULT_DISPLAY_NAME } from './mockData';
import {
  BREWED_COFFEE_DRINK_OPTIONS,
  BREWED_COFFEE_FINISH_BONUS_AMOUNT,
  BREWED_COFFEE_FINISH_BONUS_THRESHOLD,
  getBrewedCoffeePointReward,
} from './brewedCoffeeDrink';
import { grantBrewedCoffeeFields, mergePreservedSpentCoffeeCups, mergePreservedTotalCoffees } from './brewedCoffeeReceived';
import { COFFEE_VARIANT_PURCHASE_COST } from './coffeeVariants';
import {
  type HoldMode,
  COFFEE_STAGE_MIN,
  DAILY_PASSIVE_GROWTH_CAP,
  DISPLAY_GROWTH_COMMIT_MS,
  GOAL_AMOUNT,
  GROWTH_DISPLAY_DECIMALS,
  GROWTH_PER_WATER,
  randomWaterDurationSec,
} from './constants';
import {
  normalizeOwnedCoffeeVariants,
} from './coffeeVariants';
import { normalizeSelectedCoffeeVariant, getFirstNewlyUnlockedHidden } from './hiddenCoffeeVariants';
import {
  getDailyPointRoom,
  hasReachedDailyPointCap,
  settleDailyPoint,
} from './dailyPoint';
import { RELEASE_TEST_ADD_DRUNK_COFFEES, RELEASE_TEST_ADD_BREWED_COFFEES } from './featureFlags';
import {
  commitWaterGrowth,
  isReadyToDrinkGrowth,
  previewHoldDisplayGrowth,
  reconcileLegacyServerGrowth,
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
  sceneDialogueForSellBatchWithPromotion,
  sceneDialogueForSellBatchPromotionFailed,
  sceneDialogueForDailyPointCap,
  sceneDialogueForHiddenCharacterUnlock,
  sceneDialogueForBrewedSpent200,
  sceneDialogueForShopPurchase2,
  sceneDialogueForReviewPreviewComplete,
  sceneDialogueForAttendanceGoal,
  sceneDialogueForAttendanceDailyClaim,
  sceneDialogueForAttendanceStreakClaim,
  sceneDialogueForReviewPriming,
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
import {
  applyClaimAttendanceDailyReward,
  applyClaimAttendanceStreakBonus,
  mergeAttendanceFromServer,
  normalizeAttendance,
  getTodayKey,
} from './attendance';
import {
  canSpinDailyLoginRouletteToday,
  canRespinDailyLoginRouletteToday,
} from './dailyLoginRoulette';

export type DailyLoginRouletteOutcome = {
  rewardCups: number | null;
  errorMessage?: string;
};
import { markDailyLoginRouletteClaimedLocal, resetDailyLoginRouletteStorage } from '../services/dailyLoginRouletteStorage';
import { hasSeenDailyRouletteSceneDialogueToday, resetCatRouletteGuideForToday } from '../services/catGuideStorage';
import {
  buildDrinkClickLogSnapshot,
  logDrinkClickPhase,
} from './drinkClickLog';
import {
  buildRewardResetLogSnapshot,
  getDailyFortuneRewardResetStatePatch,
  getRouletteRewardResetStatePatch,
} from '../services/rewardReset';
import {
  getShopPurchaseCount,
  hasCrossedBrewedSpentReviewThreshold,
  hasCrossedShopPurchaseReviewThreshold,
} from './reviewMilestones';

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
    growth: reconcileLegacyServerGrowth(
      sanitizeGrowthForWaters(raw.growth ?? 0),
      totalWaters,
    ),
    money: readCount(raw, 'money', 'money'),
    totalCoffees: readCount(raw, 'totalCoffees', 'total_coffees'),
    totalWaters,
    spentCoffeeCups: readCount(raw, 'spentCoffeeCups', 'spent_coffee_cups'),
    lifetimeDrunkCoffees: readCount(raw, 'lifetimeDrunkCoffees', 'lifetime_drunk_coffees'),
    lifetimeBrewedSpent: Math.max(
      readCount(raw, 'lifetimeBrewedSpent', 'lifetime_brewed_spent'),
      readCount(raw, 'lifetimeDrunkCoffees', 'lifetime_drunk_coffees'),
    ),
    dailyBrewedSpentDayKey: String(
      raw.dailyBrewedSpentDayKey ??
        (raw as GameState & { daily_brewed_spent_day_key?: string }).daily_brewed_spent_day_key ??
        '',
    ),
    dailyBrewedSpent: readCount(raw, 'dailyBrewedSpent', 'daily_brewed_spent'),
    dailyBrewedReceivedDayKey: String(
      raw.dailyBrewedReceivedDayKey ??
        (raw as GameState & { daily_brewed_received_day_key?: string }).daily_brewed_received_day_key ??
        '',
    ),
    dailyBrewedReceived: readCount(raw, 'dailyBrewedReceived', 'daily_brewed_received'),
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
    attendanceDayKey: String(
      raw.attendanceDayKey ??
        (raw as GameState & { attendance_day_key?: string }).attendance_day_key ??
        '',
    ),
    attendanceCupsToday: readCount(raw, 'attendanceCupsToday', 'attendance_cups_today'),
    attendanceStreak: readCount(raw, 'attendanceStreak', 'attendance_streak'),
    attendanceLastGoalDayKey: String(
      raw.attendanceLastGoalDayKey ??
        (raw as GameState & { attendance_last_goal_day_key?: string }).attendance_last_goal_day_key ??
        '',
    ),
    attendanceDailyClaimDayKey: String(
      raw.attendanceDailyClaimDayKey ??
        (raw as GameState & { attendance_daily_claim_day_key?: string }).attendance_daily_claim_day_key ??
        '',
    ),
    attendanceStreakBonusPending:
      raw.attendanceStreakBonusPending === true ||
      (raw as GameState & { attendance_streak_bonus_pending?: boolean | number | string })
        .attendance_streak_bonus_pending === true ||
      (raw as GameState & { attendance_streak_bonus_pending?: boolean | number | string })
        .attendance_streak_bonus_pending === 1 ||
      (raw as GameState & { attendance_streak_bonus_pending?: boolean | number | string })
        .attendance_streak_bonus_pending === '1',
    ownedCoffeeVariants,
    selectedCoffeeVariant: normalizeSelectedCoffeeVariant(
      raw.selectedCoffeeVariant ??
        (raw as GameState & { selected_coffee_variant?: unknown }).selected_coffee_variant,
      ownedCoffeeVariants,
    ),
    pointDayKey: String(
      raw.pointDayKey ?? (raw as GameState & { point_day_key?: string }).point_day_key ?? '',
    ),
    dailyLoginRouletteDayKey: String(
      raw.dailyLoginRouletteDayKey ??
        (raw as GameState & { daily_login_roulette_day_key?: string }).daily_login_roulette_day_key ??
        '',
    ),
    dailyLoginRouletteRewardCups: Math.max(
      0,
      Number(
        raw.dailyLoginRouletteRewardCups ??
          (raw as GameState & { daily_login_roulette_reward_cups?: number }).daily_login_roulette_reward_cups ??
          0,
      ),
    ),
    dailyLoginRouletteRespinDayKey: String(
      raw.dailyLoginRouletteRespinDayKey ??
        (raw as GameState & { daily_login_roulette_respin_day_key?: string }).daily_login_roulette_respin_day_key ??
        '',
    ),
    ritualDayKey: String(
      raw.ritualDayKey ?? (raw as GameState & { ritual_day_key?: string }).ritual_day_key ?? '',
    ),
    ritualFortuneId: String(
      raw.ritualFortuneId ?? (raw as GameState & { ritual_fortune_id?: string }).ritual_fortune_id ?? '',
    ),
    ritualFortuneRevealed:
      raw.ritualFortuneRevealed === true ||
      (raw as GameState & { ritual_fortune_revealed?: boolean | number | string }).ritual_fortune_revealed === true ||
      (raw as GameState & { ritual_fortune_revealed?: boolean | number | string }).ritual_fortune_revealed === 1,
    ritualFortuneProgress: readCount(raw, 'ritualFortuneProgress', 'ritual_fortune_progress'),
    ritualFortuneClaimed:
      raw.ritualFortuneClaimed === true ||
      (raw as GameState & { ritual_fortune_claimed?: boolean | number | string }).ritual_fortune_claimed === true ||
      (raw as GameState & { ritual_fortune_claimed?: boolean | number | string }).ritual_fortune_claimed === 1,
    ritualGiftOpened:
      raw.ritualGiftOpened === true ||
      (raw as GameState & { ritual_gift_opened?: boolean | number | string }).ritual_gift_opened === true ||
      (raw as GameState & { ritual_gift_opened?: boolean | number | string }).ritual_gift_opened === 1,
    ritualGiftId: String(
      raw.ritualGiftId ?? (raw as GameState & { ritual_gift_id?: string }).ritual_gift_id ?? '',
    ),
    ritualMission1Id: String(
      raw.ritualMission1Id ?? (raw as GameState & { ritual_mission_1_id?: string }).ritual_mission_1_id ?? '',
    ),
    ritualMission2Id: String(
      raw.ritualMission2Id ?? (raw as GameState & { ritual_mission_2_id?: string }).ritual_mission_2_id ?? '',
    ),
    ritualMission3Id: String(
      raw.ritualMission3Id ?? (raw as GameState & { ritual_mission_3_id?: string }).ritual_mission_3_id ?? '',
    ),
    ritualMission1Done:
      raw.ritualMission1Done === true ||
      (raw as GameState & { ritual_mission_1_done?: boolean | number | string }).ritual_mission_1_done === true,
    ritualMission2Done:
      raw.ritualMission2Done === true ||
      (raw as GameState & { ritual_mission_2_done?: boolean | number | string }).ritual_mission_2_done === true,
    ritualMission3Done:
      raw.ritualMission3Done === true ||
      (raw as GameState & { ritual_mission_3_done?: boolean | number | string }).ritual_mission_3_done === true,
    ritualMissionClaimed:
      raw.ritualMissionClaimed === true ||
      (raw as GameState & { ritual_mission_claimed?: boolean | number | string }).ritual_mission_claimed === true,
    ritualMissionHarvestCount: readCount(raw, 'ritualMissionHarvestCount', 'ritual_mission_harvest_count'),
    ritualMissionMinigameDone:
      raw.ritualMissionMinigameDone === true ||
      (raw as GameState & { ritual_mission_minigame_done?: boolean | number | string }).ritual_mission_minigame_done === true,
    ritualMissionRouletteDone:
      raw.ritualMissionRouletteDone === true ||
      (raw as GameState & { ritual_mission_roulette_done?: boolean | number | string }).ritual_mission_roulette_done === true,
    ritualFertilizerCharges: readCount(raw, 'ritualFertilizerCharges', 'ritual_fertilizer_charges'),
    ritualBonusRouletteSpins: readCount(raw, 'ritualBonusRouletteSpins', 'ritual_bonus_roulette_spins'),
  };
  return settleDailyPoint(
    withNormalizedPassive(
      withNormalizedQuota({
        ...normalized,
        ...normalizeAttendance(normalized),
      }),
    ),
  );
}

function isWaterCooldownError(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError && err.status === 429;
}

const HOLD_UI_COMMIT_MS = 32;
const DISPLAY_GROWTH_MIN_DELTA = 1 / 10 ** GROWTH_DISPLAY_DECIMALS;
const HARVEST_REWARD_ROLL_MS = 1000;
const HARVEST_REWARD_RESULT_MS = 1200;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export type SellBatchOutcome =
  | { ok: true; popupMessage: string }
  | { ok: false };

export function useCoffeeGame(options: { tutorialBypassQuota?: boolean } = {}) {
  const { tutorialBypassQuota = false } = options;
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [state, setState] = useState<GameState>(initialState);
  const [displayGrowth, setDisplayGrowth] = useState(0);
  const [balanceRules, setBalanceRules] = useState<BalanceRules>(DEFAULT_BALANCE_RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastEarned, setLastEarned] = useState<number | null>(null);
  const [harvestReward, setHarvestReward] = useState<{ cups: number | null; key: number } | null>(null);
  const [tapBurst, setTapBurst] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdMode, setHoldMode] = useState<HoldMode>('water');
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdTargetSec, setHoldTargetSec] = useState(0);
  const [holdElapsedSec, setHoldElapsedSec] = useState(0);
  const [watchingAd, setWatchingAd] = useState(false);
  const [sharingReward, setSharingReward] = useState(false);
  const [sellingBatch, setSellingBatch] = useState(false);
  const [claimingFinishBonus, setClaimingFinishBonus] = useState(false);
  const [claimingAttendanceDaily, setClaimingAttendanceDaily] = useState(false);
  const [claimingAttendanceStreak, setClaimingAttendanceStreak] = useState(false);
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
  const [reviewPreviewStatus, setReviewPreviewStatus] = useState<string | null>(null);

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
  const harvestRewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const harvestRewardKeyRef = useRef(0);
  const lastDisplayGrowthCommitAtRef = useRef(0);
  const lastCommittedDisplayRef = useRef(0);
  const testQueueRef = useRef(Promise.resolve());
  const balanceRulesRef = useRef(balanceRules);

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

  const startHarvestRewardRoll = useCallback(() => {
    harvestRewardKeyRef.current += 1;
    setHarvestReward({ cups: null, key: harvestRewardKeyRef.current });

    if (harvestRewardTimerRef.current !== null) {
      clearTimeout(harvestRewardTimerRef.current);
      harvestRewardTimerRef.current = null;
    }
  }, []);

  const showHarvestReward = useCallback((cups: number) => {
    const safeCups = Math.max(1, Math.floor(Number(cups) || 1));
    let key = harvestRewardKeyRef.current;
    if (key <= 0) {
      harvestRewardKeyRef.current += 1;
      key = harvestRewardKeyRef.current;
    }
    harvestRewardKeyRef.current = key;
    setHarvestReward({ cups: safeCups, key });

    if (harvestRewardTimerRef.current !== null) {
      clearTimeout(harvestRewardTimerRef.current);
    }
    harvestRewardTimerRef.current = setTimeout(() => {
      harvestRewardTimerRef.current = null;
      setHarvestReward(null);
    }, HARVEST_REWARD_RESULT_MS);
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
      const mergedAttendance = trustServer
        ? normalizeAttendance(raw)
        : mergeAttendanceFromServer(stateRef.current, raw);
      const next = normalizeLoadedState({
        ...raw,
        ...mergedQuota,
        ...mergedPassive,
        ...mergedAttendance,
      });
      stateRef.current = next;
      setState(next);
      commitDisplayGrowth(next.growth, true);
      lastBootstrapAtRef.current = Date.now();
      return next;
    },
    [commitDisplayGrowth],
  );

  const applyPassiveAccrual = useCallback((next: GameState) => {
    stateRef.current = next;
    setState((prev) => {
      if (
        prev.dailyPassiveGrowth === next.dailyPassiveGrowth &&
        prev.growthAccrualSyncedAt === next.growthAccrualSyncedAt &&
        prev.passiveDayKey === next.passiveDayKey
      ) {
        return prev;
      }

      return {
        ...prev,
        dailyPassiveGrowth: next.dailyPassiveGrowth,
        growthAccrualSyncedAt: next.growthAccrualSyncedAt,
        passiveDayKey: next.passiveDayKey,
      };
    });
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
      let growth = raw.growth;
      if (holdStartGrowth !== undefined) {
        const beforeCharges = stateRef.current.ritualFertilizerCharges ?? 0;
        const afterCharges = raw.ritualFertilizerCharges ?? 0;
        const usedFertilizer = afterCharges < beforeCharges;
        growth = resolveWaterSyncGrowth(holdStartGrowth, raw.growth, {
          maxDelta: usedFertilizer
            ? roundGrowth(GROWTH_PER_WATER * 1.3)
            : GROWTH_PER_WATER,
        });
      }
      return applyAuthoritativeState(
        {
          ...raw,
          growth,
          totalCoffees: Math.max(Number(raw.totalCoffees ?? 0), stateRef.current.totalCoffees),
        },
        { epoch },
      );
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
        const localTotalCoffees = stateRef.current.totalCoffees;
        const localSpentCoffeeCups = stateRef.current.spentCoffeeCups;
        applyAuthoritativeState({
          ...next.state,
          totalCoffees: mergePreservedTotalCoffees(next.state.totalCoffees, localTotalCoffees),
          spentCoffeeCups: mergePreservedSpentCoffeeCups(
            next.state.spentCoffeeCups,
            localSpentCoffeeCups,
            0,
          ),
        });
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
      if (!currentSession?.userId) {
        holdSyncCommittedRef.current = false;
        resetHoldUi();
        return;
      }

      const epoch = stateEpochRef.current;
      const before = stateRef.current;
      const beforeGrowth = roundGrowth(before.growth);
      const lockedHoldStart = holdStartGrowthRef.current ?? beforeGrowth;
      const isWaterLike = mode === 'water' || mode === 'brew';

      const applyOptimisticWaterHold = () => {
        if (!isWaterLike || (!canUseGrowHold(before) && !tutorialBypassQuota)) {
          return null;
        }

        const nextGrowth = commitWaterGrowth(lockedHoldStart);
        if (nextGrowth <= beforeGrowth) {
          return null;
        }

        const quotaState = canUseGrowHold(before) ? consumeWaterQuota(before) : before;
        return {
          ...quotaState,
          growth: nextGrowth,
          totalWaters: before.totalWaters + 1,
        };
      };

      const finishWaterDialogue = (growth: number) => {
        if (needsAdForWater(stateRef.current)) {
          const refillLabel = getRefillActionLabel(stateRef.current.growth);
          showSceneDialogue(`물주기·내리기 1회 완료! 「${refillLabel}」를 눌러 주세요.`);
          return;
        }

        const stage = getStage(growth);
        showSceneDialogue(sceneDialogueForGrowthComplete(mode, stage.label, growth));
      };

      const optimisticState = applyOptimisticWaterHold();
      if (optimisticState) {
        stateRef.current = optimisticState;
        commitDisplayGrowth(optimisticState.growth, true);
        setState(optimisticState);
        triggerTapBurst();
        resetHoldUi();

        void (async () => {
          try {
            const result = await waterGame();
            if (epoch !== stateEpochRef.current) return;
            applyWaterServerState(result.state, lockedHoldStart, epoch);
            setLastEarned(result.lastEarned);
            finishWaterDialogue(resolveWaterSyncGrowth(lockedHoldStart, result.state.growth));
          } catch (err) {
            if (epoch !== stateEpochRef.current) return;
            if (isWaterCooldownError(err) && err.state) {
              applyWaterServerState(err.state, lockedHoldStart, epoch);
              return;
            }
            if (err instanceof ApiRequestError && err.state) {
              applyWaterServerState(err.state, lockedHoldStart, epoch);
              if (needsAdForWater(err.state)) {
                const refillLabel = getRefillActionLabel(err.state.growth);
                showSceneDialogue(`물주기·내리기 1회 완료! 「${refillLabel}」를 눌러 주세요.`);
              } else {
                const growth = roundGrowth(err.state.growth);
                const stage = getStage(growth);
                showSceneDialogue(sceneDialogueForGrowthComplete(mode, stage.label, growth));
              }
              return;
            }

            applyAuthoritativeState(before, { epoch });
            commitDisplayGrowth(lockedHoldStart, true);
            const message = err instanceof Error ? err.message : '동작 처리에 실패했습니다.';
            setActionError(message);
            showSceneDialogue(message);
          }
        })();
        return;
      }

      if (syncingRef.current) {
        holdSyncCommittedRef.current = false;
        resetHoldUi();
        return;
      }

      syncingRef.current = true;
      setActionSyncing(true);
      setActionError(null);

      try {
        const result = await waterGame();
        applyWaterServerState(result.state, lockedHoldStart, epoch);
        setLastEarned(result.lastEarned);
        const synced = resolveWaterSyncGrowth(lockedHoldStart, result.state.growth);
        finishWaterDialogue(synced);
      } catch (err) {
        if (isWaterCooldownError(err) && err.state) {
          applyWaterServerState(err.state, lockedHoldStart, epoch);
        } else if (isWaterLike && err instanceof ApiRequestError && err.state) {
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
            isWaterLike && holdStartGrowthRef.current !== null
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
      tutorialBypassQuota,
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

    if (holdModeRef.current === 'water' || holdModeRef.current === 'brew') {
      const startGrowth = holdStartGrowthRef.current;
      if (startGrowth !== null) {
        commitDisplayGrowth(
          previewHoldDisplayGrowth(startGrowth, holdDisplayStartRef.current, progress),
          progress >= 100,
        );
      }
    }

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
    if (holdStartRef.current !== null) return;
    if (isReadyToDrinkGrowth(stateRef.current.growth)) return;
    if (!canUseGrowHold(stateRef.current) && !tutorialBypassQuota) {
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
      if (holdStartRef.current !== null || syncingRef.current) return;
      if (isReadyToDrinkGrowth(activeState.growth)) return;
      if (!canUseGrowHold(activeState) && !tutorialBypassQuota) return;

      const mode: HoldMode =
        authoritativeGrowth >= COFFEE_STAGE_MIN ? 'brew' : 'water';

      const duration = randomWaterDurationSec();
      holdDurationRef.current = duration;
      holdStartRef.current = performance.now();
      holdProgressRef.current = 0;
      holdStartGrowthRef.current = authoritativeGrowth;
      holdDisplayStartRef.current = authoritativeGrowth;
      commitDisplayGrowth(authoritativeGrowth, true);

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
    tutorialBypassQuota,
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
      startHarvestRewardRoll();
      const [result] = await Promise.all([
        drinkGame(),
        wait(HARVEST_REWARD_ROLL_MS),
      ]);
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      setLastEarned(result.lastEarned);
      setActionError(null);
      const earnedCups = Math.max(1, Math.floor(Number(result.lastEarned) || 1));
      showHarvestReward(earnedCups);
      let dialogue = sceneDialogueForDrink(earnedCups);
      if (result.attendanceGoalJustMet) {
        dialogue = sceneDialogueForAttendanceGoal(dialogue);
      }
      showSceneDialogue(dialogue);
      await wait(HARVEST_REWARD_RESULT_MS);
      applyAuthoritativeState({ ...result.state, growth: 0 }, { epoch });
      triggerTapBurst();
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state, { epoch });
      } else {
        applyAuthoritativeState(before, { epoch });
      }
      const message = err instanceof Error ? err.message : '커피 마시기에 실패했습니다.';
      setActionError(message);
      setHarvestReward(null);
      showSceneDialogue(message);
    } finally {
      syncingRef.current = false;
      setIsDrinkCommitting(false);
      setActionSyncing(false);
    }
  }, [applyAuthoritativeState, showHarvestReward, showSceneDialogue, startHarvestRewardRoll, triggerTapBurst, updatePlayerRank]);

  const completeDrink = useCallback(() => {
    if (syncingRef.current) return;

    const currentSession = sessionRef.current;
    if (!currentSession?.userId) {
      showSceneDialogue(getServerUnavailableMessage());
      return;
    }
    if (loading) return;

    const before = stateRef.current;
    const canDrinkCoffee =
      isReadyToDrinkGrowth(before.growth) && !syncingRef.current && !loading;

    logDrinkClickPhase(
      'before',
      buildDrinkClickLogSnapshot(displayGrowthRef.current, before.growth, canDrinkCoffee),
    );

    if (!isReadyToDrinkGrowth(before.growth)) {
      logDrinkClickPhase(
        'after',
        buildDrinkClickLogSnapshot(displayGrowthRef.current, before.growth, false),
      );
      showSceneDialogue('아직 커피가 완성되지 않았어요.');
      return;
    }

    syncingRef.current = true;
    setIsDrinkCommitting(true);
    setActionSyncing(true);
    setActionError(null);
    resetHoldUi();

    void commitDrink(before, stateEpochRef.current).finally(() => {
      logDrinkClickPhase(
        'after',
        buildDrinkClickLogSnapshot(
          displayGrowthRef.current,
          stateRef.current.growth,
          isReadyToDrinkGrowth(stateRef.current.growth),
        ),
      );
    });
  }, [commitDrink, loading, resetHoldUi, showSceneDialogue]);

  const runTestBump = useCallback(async () => {
    const prev = stateRef.current;

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
      showSceneDialogue(getServerUnavailableMessage());
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
        setPassiveClaimFeedback(null);
        showSceneDialogue('테스트: 방치 커피 게이지 +100% (서버 반영)');
        return;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { trustServer: true, epoch });
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
    showSceneDialogue('테스트: 방치 커피 게이지 +100%');
  }, [applyAuthoritativeState, loading, isHolding, showSceneDialogue]);

  const testSetTotalCoffees = useCallback(async (totalCoffees = 1000) => {
    if (!import.meta.env.DEV) return;
    if (loading || isHolding || syncingRef.current) return;

    const prev = stateRef.current;

    const safeTotal = Math.max(0, Math.floor(totalCoffees));
    const currentSession = sessionRef.current;
    const epoch = stateEpochRef.current;

    if (currentSession?.userId) {
      try {
        const result = await devSetTotalCoffees(safeTotal);
        applyAuthoritativeState(result.state, { trustServer: true, epoch });
        showSceneDialogue(`테스트: 내린 커피 ${safeTotal.toLocaleString('ko-KR')}잔`);
        return;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { trustServer: true, epoch });
        }
        const message = err instanceof Error ? err.message : '테스트 잔 수 설정에 실패했습니다.';
        showSceneDialogue(message);
        return;
      }
    }

    applyAuthoritativeState({ ...prev, totalCoffees: safeTotal });
    showSceneDialogue(`테스트: 내린 커피 ${safeTotal.toLocaleString('ko-KR')}잔`);
  }, [applyAuthoritativeState, isHolding, loading, showSceneDialogue]);

  const testSetSpentCoffeeCups = useCallback(async (spentCoffeeCups = 1000) => {
    if (!import.meta.env.DEV) return;
    if (loading || isHolding || syncingRef.current) return;

    const prev = stateRef.current;

    const safeTotal = Math.max(0, Math.floor(spentCoffeeCups));
    const currentSession = sessionRef.current;
    const epoch = stateEpochRef.current;

    if (currentSession?.userId) {
      try {
        const result = await devSetSpentCoffeeCups(safeTotal);
        applyAuthoritativeState(result.state, { trustServer: true, epoch });
        showSceneDialogue(`테스트: 마신 커피 ${safeTotal.toLocaleString('ko-KR')}잔`);
        return;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { trustServer: true, epoch });
        }
        const message = err instanceof Error ? err.message : '테스트 잔 수 설정에 실패했습니다.';
        showSceneDialogue(message);
        return;
      }
    }

    applyAuthoritativeState({
      ...prev,
      spentCoffeeCups: safeTotal,
      lifetimeDrunkCoffees: Math.max(prev.lifetimeDrunkCoffees ?? 0, safeTotal),
    });
    showSceneDialogue(`테스트: 마신 커피 ${safeTotal.toLocaleString('ko-KR')}잔`);
  }, [applyAuthoritativeState, isHolding, loading, showSceneDialogue]);

  const releaseTestAddSpentCoffeeCups = useCallback(async (amount = RELEASE_TEST_ADD_DRUNK_COFFEES) => {
    if (loading || isHolding || syncingRef.current) return;

    const prev = stateRef.current;
    const addAmount = Math.max(1, Math.floor(amount));
    const currentSession = sessionRef.current;

    const applyLocalIncrement = () => {
      const nextSpent = mergePreservedSpentCoffeeCups(prev.spentCoffeeCups, prev.spentCoffeeCups, addAmount);
      applyAuthoritativeState({
        ...prev,
        spentCoffeeCups: nextSpent,
        lifetimeDrunkCoffees: Math.max(prev.lifetimeDrunkCoffees ?? 0, nextSpent),
      });
      showSceneDialogue(`마신 커피 +${addAmount.toLocaleString('ko-KR')}잔`);
    };

    if (currentSession?.userId) {
      stateEpochRef.current += 1;
      const epoch = stateEpochRef.current;

      try {
        const result = await releaseTestAddDrunkCoffees(addAmount);
        const nextSpent = mergePreservedSpentCoffeeCups(
          result.state.spentCoffeeCups,
          prev.spentCoffeeCups,
          addAmount,
        );
        applyAuthoritativeState(
          {
            ...result.state,
            spentCoffeeCups: nextSpent,
            lifetimeDrunkCoffees: Math.max(
              Number(result.state.lifetimeDrunkCoffees ?? 0),
              nextSpent,
            ),
          },
          { trustServer: true, epoch },
        );
        showSceneDialogue(`마신 커피 +${addAmount.toLocaleString('ko-KR')}잔`);
        return;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          const nextSpent = mergePreservedSpentCoffeeCups(
            err.state.spentCoffeeCups,
            prev.spentCoffeeCups,
            addAmount,
          );
          applyAuthoritativeState(
            {
              ...err.state,
              spentCoffeeCups: nextSpent,
              lifetimeDrunkCoffees: Math.max(
                Number(err.state.lifetimeDrunkCoffees ?? 0),
                nextSpent,
              ),
            },
            { trustServer: true, epoch },
          );
          showSceneDialogue(`마신 커피 +${addAmount.toLocaleString('ko-KR')}잔`);
          return;
        }
        applyLocalIncrement();
        return;
      }
    }

    applyLocalIncrement();
  }, [applyAuthoritativeState, isHolding, loading, showSceneDialogue]);

  const releaseTestAddBrewedCoffees = useCallback(async (amount = RELEASE_TEST_ADD_BREWED_COFFEES) => {
    if (loading || isHolding || syncingRef.current) return;

    const prev = stateRef.current;
    const addAmount = Math.max(1, Math.floor(amount));
    const currentSession = sessionRef.current;

    const applyLocalIncrement = () => {
      applyAuthoritativeState({
        ...prev,
        ...grantBrewedCoffeeFields(prev, addAmount),
      });
      showSceneDialogue(`내린 커피 +${addAmount.toLocaleString('ko-KR')}잔`);
    };

    if (currentSession?.userId) {
      stateEpochRef.current += 1;
      const epoch = stateEpochRef.current;

      try {
        const result = await releaseTestAddBrewedCoffeesApi(addAmount);
        const nextTotalCoffees = mergePreservedTotalCoffees(
          result.state.totalCoffees,
          prev.totalCoffees,
          addAmount,
        );
        applyAuthoritativeState(
          {
            ...result.state,
            totalCoffees: nextTotalCoffees,
          },
          { trustServer: true, epoch },
        );
        showSceneDialogue(`내린 커피 +${addAmount.toLocaleString('ko-KR')}잔`);
        return;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          const nextTotalCoffees = mergePreservedTotalCoffees(
            err.state.totalCoffees,
            prev.totalCoffees,
            addAmount,
          );
          applyAuthoritativeState(
            {
              ...err.state,
              totalCoffees: nextTotalCoffees,
            },
            { trustServer: true, epoch },
          );
          showSceneDialogue(`내린 커피 +${addAmount.toLocaleString('ko-KR')}잔`);
          return;
        }
        applyLocalIncrement();
        return;
      }
    }

    applyLocalIncrement();
  }, [applyAuthoritativeState, isHolding, loading, showSceneDialogue]);

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
    syncingRef.current = true;
    setActionSyncing(true);

    const rewardResetPatch = {
      ...getRouletteRewardResetStatePatch(),
      ...getDailyFortuneRewardResetStatePatch(),
    };
    const resetState = normalizeLoadedState({ ...buildResetState(), ...rewardResetPatch });
    applyAuthoritativeState(resetState, { trustServer: true, epoch });
    resetDailyGameSave();

    try {
      if (currentSession.userId && currentSession.source !== 'mock') {
        const result = await resetGame();
        applyAuthoritativeState(
          normalizeLoadedState({ ...result.state, ...rewardResetPatch }),
          { trustServer: true, epoch },
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '초기화에 실패했습니다.';
      setError(message);
    } finally {
      syncingRef.current = false;
      setActionSyncing(false);
    }
  }, [applyAuthoritativeState, hideSceneDialogue, resetHoldUi]);

  const purchaseVariant = useCallback(
    async (slug: string) => {
      if (syncingRef.current) return;
      const epoch = stateEpochRef.current;
      const before = stateRef.current;
      const beforeOwned = before.ownedCoffeeVariants;
      const localSpent = Math.max(0, Number(before.spentCoffeeCups ?? 0));
      syncingRef.current = true;
      setActionSyncing(true);
      setActionError(null);

      try {
        const currentSession = sessionRef.current;
        if (
          currentSession?.userId &&
          currentSession.source !== 'mock' &&
          localSpent >= COFFEE_VARIANT_PURCHASE_COST
        ) {
          const syncResult = await releaseTestSyncSpentCoffeeCups(localSpent);
          applyAuthoritativeState(
            {
              ...syncResult.state,
              spentCoffeeCups: mergePreservedSpentCoffeeCups(
                syncResult.state.spentCoffeeCups,
                localSpent,
                0,
              ),
            },
            { trustServer: true, epoch },
          );
        }

        const result = await purchaseCoffeeVariant(slug);
        applyAuthoritativeState(
          {
            ...result.state,
            spentCoffeeCups: Math.max(
              Math.max(0, Number(result.state.spentCoffeeCups ?? 0)),
              Math.max(0, localSpent) - COFFEE_VARIANT_PURCHASE_COST,
            ),
          },
          { epoch },
        );
        if (result.playerRank != null) {
          updatePlayerRank(result.playerRank);
        }
        const newlyUnlocked = getFirstNewlyUnlockedHidden(beforeOwned, result.state.ownedCoffeeVariants);
        if (newlyUnlocked) {
          showSceneDialogue(sceneDialogueForHiddenCharacterUnlock(newlyUnlocked.unlockedLabel));
          void scheduleReviewPrompt({
            trigger: 'hidden-character-unlock',
            onPrime: (copy) => showSceneDialogue(sceneDialogueForReviewPriming(copy)),
          });
        } else if (
          hasCrossedShopPurchaseReviewThreshold(beforeOwned, result.state.ownedCoffeeVariants)
        ) {
          const purchaseCount = getShopPurchaseCount(result.state.ownedCoffeeVariants);
          showSceneDialogue(sceneDialogueForShopPurchase2(purchaseCount));
          void scheduleReviewPrompt({
            trigger: 'shop-purchase-2',
            onPrime: (copy) => showSceneDialogue(sceneDialogueForReviewPriming(copy)),
          });
        }
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(
            {
              ...err.state,
              spentCoffeeCups: mergePreservedSpentCoffeeCups(
                err.state.spentCoffeeCups,
                before.spentCoffeeCups,
                0,
              ),
            },
            { epoch },
          );
        }
        const message = err instanceof Error ? err.message : '캐릭터 구매에 실패했습니다.';
        setActionError(message);
      } finally {
        syncingRef.current = false;
        setActionSyncing(false);
      }
    },
    [applyAuthoritativeState, showSceneDialogue, updatePlayerRank],
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
    if (!needsAdForWater(prev)) return;

    if (!currentSession?.userId) {
      showSceneDialogue(getServerUnavailableMessage());
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
      const watched = await showInterstitialAd();
      if (!watched) {
        showSceneDialogue('광고 시청을 완료해야 물주기·내리기를 다시 할 수 있어요.');
        return;
      }

      const optimistic = grantAdWaterCredit(prev);
      stateRef.current = optimistic;
      setState(optimistic);
      showSceneDialogue(sceneDialogueForAdReward());
      setWatchingAd(false);

      void (async () => {
        try {
          const result = await watchAdGame();
          if (epoch !== stateEpochRef.current) return;
          applyAuthoritativeState(
            {
              ...result.state,
              totalCoffees: Math.max(Number(result.state.totalCoffees ?? 0), stateRef.current.totalCoffees),
            },
            { epoch },
          );
        } catch (err) {
          if (epoch !== stateEpochRef.current) return;
          if (err instanceof ApiRequestError && err.state) {
            applyAuthoritativeState(
              {
                ...err.state,
                totalCoffees: Math.max(Number(err.state.totalCoffees ?? 0), stateRef.current.totalCoffees),
              },
              { epoch },
            );
          } else {
            applyAuthoritativeState(prev, { epoch });
          }
          const message = err instanceof Error ? err.message : '물 채우기 처리에 실패했습니다.';
          setActionError(message);
          showSceneDialogue(message);
        }
      })();
    } catch (err) {
      const message = err instanceof Error ? err.message : '물 채우기 처리에 실패했습니다.';
      setActionError(message);
      showSceneDialogue(message);
    } finally {
      setWatchingAd(false);
    }
  }, [applyAuthoritativeState, watchingAd, showSceneDialogue]);

  const grantTutorialWaterRefill = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (watchingAd) return false;

    const prev = stateRef.current;
    if (!needsAdForWater(prev)) return true;
    if (!currentSession?.userId) return false;

    const epoch = stateEpochRef.current;
    setActionError(null);

    const optimistic = grantAdWaterCredit(prev);
    stateRef.current = optimistic;
    setState(optimistic);

    void (async () => {
      try {
        const result = await watchAdGame();
        if (epoch !== stateEpochRef.current) return;
        applyAuthoritativeState(
          {
            ...result.state,
            totalCoffees: Math.max(Number(result.state.totalCoffees ?? 0), stateRef.current.totalCoffees),
          },
          { epoch },
        );
      } catch (err) {
        if (epoch !== stateEpochRef.current) return;
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(
            {
              ...err.state,
              totalCoffees: Math.max(Number(err.state.totalCoffees ?? 0), stateRef.current.totalCoffees),
            },
            { epoch },
          );
        } else {
          applyAuthoritativeState(prev, { epoch });
        }
      }
    })();

    return true;
  }, [applyAuthoritativeState, watchingAd]);

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
          message: getServerUnavailableMessage(),
        });
      }

      const before = stateRef.current;
      if (!canClaimShareRewardToday(before)) {
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
          showSceneDialogue(outcome.message);
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

  const claimMinigameReward = useCallback(
    async (missionKey: MissionKey, rewardSlot: 'free' | 'ad' = 'free') => {
      const currentSession = sessionRef.current;
      if (!currentSession?.userId) {
        showSceneDialogue(getServerUnavailableMessage());
        return false;
      }

      const epoch = stateEpochRef.current;

      try {
        const result = await claimMinigameRewardApi(missionKey, rewardSlot);
        applyAuthoritativeState(result.state, { epoch });
        if (result.playerRank != null) {
          updatePlayerRank(result.playerRank);
        }
        return true;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { epoch });
        }
        const message = err instanceof Error ? err.message : '미션 보상을 받지 못했어요.';
        setActionError(message);
        showSceneDialogue(message);
        return false;
      }
    },
    [applyAuthoritativeState, showSceneDialogue, updatePlayerRank],
  );

  const ensureGameplaySession = useCallback(async (): Promise<PlayerSession | null> => {
    const current = sessionRef.current;
    if (current?.userId && current.source !== 'mock') {
      return current;
    }

    if (!isBackendConfigured()) {
      return null;
    }

    try {
      const guest = await ensureGuestSession(current?.displayName || DEFAULT_DISPLAY_NAME);
      applySession(guest);
      return {
        userId: guest.userId,
        displayName: guest.displayName,
        source: guest.source,
        playerRank: guest.playerRank ?? null,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : getServerUnavailableMessage();
      setActionError(message);
      showSceneDialogue(message);
      return null;
    }
  }, [applySession, showSceneDialogue]);

  const claimDailyLoginRoulette = useCallback(async (): Promise<DailyLoginRouletteOutcome> => {
    const today = getTodayKey();
    const before = stateRef.current;

    if (!canSpinDailyLoginRouletteToday(before, today)) {
      const message = '오늘 접속 룰렛은 이미 받았어요.';
      showSceneDialogue(message);
      return { rewardCups: null, errorMessage: message };
    }

    const gameplaySession = await ensureGameplaySession();
    if (!gameplaySession?.userId) {
      const message = isBackendConfigured()
        ? '로그인 정보를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.'
        : getServerUnavailableMessage();
      showSceneDialogue(message);
      return { rewardCups: null, errorMessage: message };
    }

    stateEpochRef.current += 1;
    const epoch = stateEpochRef.current;

    try {
      const result = await claimDailyLoginRouletteGame();
      const rewardTotalCoffees = mergePreservedTotalCoffees(
        result.state.totalCoffees,
        before.totalCoffees,
        result.rewardCups,
      );
      if (result.bonusSpin) {
        applyAuthoritativeState(
          {
            ...result.state,
            totalCoffees: rewardTotalCoffees,
            dailyLoginRouletteRewardCups:
              Math.max(0, Number(before.dailyLoginRouletteRewardCups ?? 0)) + result.rewardCups,
          },
          { epoch },
        );
      } else {
        applyAuthoritativeState(
          {
            ...result.state,
            totalCoffees: rewardTotalCoffees,
            dailyLoginRouletteDayKey: today,
            dailyLoginRouletteRewardCups: result.rewardCups,
            dailyLoginRouletteRespinDayKey: '',
          },
          { epoch },
        );
        markDailyLoginRouletteClaimedLocal(result.rewardCups, today);
      }
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      return { rewardCups: result.rewardCups };
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(
          {
            ...err.state,
            totalCoffees: mergePreservedTotalCoffees(
              err.state.totalCoffees,
              before.totalCoffees,
            ),
          },
          { epoch },
        );
      }
      const message = err instanceof Error ? err.message : '접속 룰렛 보상을 받지 못했어요.';
      showSceneDialogue(message);
      return { rewardCups: null, errorMessage: message };
    }
  }, [applyAuthoritativeState, ensureGameplaySession, showSceneDialogue, updatePlayerRank]);

  const respinDailyLoginRoulette = useCallback(async (): Promise<DailyLoginRouletteOutcome> => {
    const today = getTodayKey();
    const before = stateRef.current;

    if (!canRespinDailyLoginRouletteToday(before.dailyLoginRouletteDayKey, before.dailyLoginRouletteRespinDayKey, today)) {
      const message =
        before.dailyLoginRouletteDayKey !== today
          ? '먼저 오늘의 룰렛을 돌려 주세요.'
          : '오늘 다시 돌리기는 이미 사용했어요.';
      showSceneDialogue(message);
      return { rewardCups: null, errorMessage: message };
    }

    const gameplaySession = await ensureGameplaySession();
    if (!gameplaySession?.userId) {
      const message = isBackendConfigured()
        ? '로그인 정보를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.'
        : getServerUnavailableMessage();
      showSceneDialogue(message);
      return { rewardCups: null, errorMessage: message };
    }

    stateEpochRef.current += 1;
    const epoch = stateEpochRef.current;

    try {
      const clientPreviousRewardCups = Math.max(0, Number(before.dailyLoginRouletteRewardCups ?? 0));
      const result = await respinDailyLoginRouletteGame(clientPreviousRewardCups, today);
      const previousRewardCups = Math.max(
        0,
        Number(result.previousRewardCups ?? clientPreviousRewardCups),
      );
      const rewardTotalCoffees = mergePreservedTotalCoffees(
        result.state.totalCoffees,
        before.totalCoffees,
        result.rewardCups - previousRewardCups,
      );
      applyAuthoritativeState(
        {
          ...result.state,
          totalCoffees: rewardTotalCoffees,
          dailyLoginRouletteRewardCups: result.rewardCups,
          dailyLoginRouletteRespinDayKey: today,
        },
        { epoch },
      );
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      markDailyLoginRouletteClaimedLocal(result.rewardCups, today);
      return { rewardCups: result.rewardCups };
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        const clientClaimedToday = before.dailyLoginRouletteDayKey === today;
        const serverClaimedToday =
          String(err.state.dailyLoginRouletteDayKey ?? '') === today;
        if (!clientClaimedToday || serverClaimedToday) {
          applyAuthoritativeState(
            {
              ...err.state,
              totalCoffees: mergePreservedTotalCoffees(
                err.state.totalCoffees,
                before.totalCoffees,
              ),
            },
            { epoch },
          );
        }
      }
      const message = err instanceof Error ? err.message : '룰렛 다시 돌리기에 실패했어요.';
      showSceneDialogue(message);
      return { rewardCups: null, errorMessage: message };
    }
  }, [applyAuthoritativeState, ensureGameplaySession, showSceneDialogue, updatePlayerRank]);

  const resetRouletteRewardState = useCallback(async () => {
    resetDailyLoginRouletteStorage();
    resetCatRouletteGuideForToday();

    const epoch = stateEpochRef.current;
    applyAuthoritativeState(
      {
        ...stateRef.current,
        ...getRouletteRewardResetStatePatch(),
      },
      { trustServer: true, epoch },
    );

    const currentSession = sessionRef.current;
    if (import.meta.env.DEV && currentSession?.userId && currentSession.source !== 'mock') {
      try {
        const result = await devResetDailyLoginRouletteGame();
        applyAuthoritativeState(normalizeLoadedState(result.state), { trustServer: true, epoch });
      } catch {
        // optimistic client reset is enough for UI retry
      }
    }
  }, [applyAuthoritativeState]);

  const resetDailyFortuneRewardState = useCallback(async () => {
    const epoch = stateEpochRef.current;
    applyAuthoritativeState(
      {
        ...stateRef.current,
        ...getDailyFortuneRewardResetStatePatch(),
      },
      { trustServer: true, epoch },
    );

    const currentSession = sessionRef.current;
    if (import.meta.env.DEV && currentSession?.userId && currentSession.source !== 'mock') {
      try {
        const result = await devResetDailyRitualGame();
        applyAuthoritativeState(normalizeLoadedState(result.state), { trustServer: true, epoch });
      } catch {
        // optimistic client reset is enough for UI retry
      }
    }
  }, [applyAuthoritativeState]);

  const resetDailyLoginRouletteForTest = useCallback(async () => {
    await resetRouletteRewardState();
  }, [resetRouletteRewardState]);

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
      triggerTapBurst();
      setPassiveClaimFeedback({
        tone: 'success',
        text: '✓ 방치 커피+1 = 내린 커피+1',
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

    try {
      const result = await claimPassiveCoffeeGame();
      applyAuthoritativeState(result.state, { trustServer: true, epoch });
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      setLastEarned(result.lastEarned);
      triggerTapBurst();
      setPassiveClaimFeedback({
        tone: 'success',
        text: '✓ 방치 커피+1 = 내린 커피+1',
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
      const watched = await watchRewardedAd('passive-reactivate');
      if (!watched) {
        showSceneDialogue('광고 시청을 완료해야 재활성할 수 있어요.');
        return false;
      }

      if (!currentSession?.userId) {
        applyAuthoritativeState(preview.state, { trustServer: true, epoch });
        showSceneDialogue(sceneDialogueForPassiveReactivate());
        return true;
      }

      syncingRef.current = true;
      setActionSyncing(true);

      try {
        const result = await reactivatePassiveCoffeeGame();
        applyAuthoritativeState(result.state, { trustServer: true, epoch });
        showSceneDialogue(sceneDialogueForPassiveReactivate());
        return true;
      } catch (err) {
        if (err instanceof ApiRequestError && err.state) {
          applyAuthoritativeState(err.state, { trustServer: true, epoch });
        } else {
          applyAuthoritativeState(before, { trustServer: true, epoch });
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
    claimingPassiveCoffee,
    reactivatingPassiveCoffee,
    showSceneDialogue,
    watchingAd,
  ]);

  const claimAttendanceDaily = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession?.userId || syncingRef.current || claimingAttendanceDaily) return false;

    const before = stateRef.current;
    const preview = applyClaimAttendanceDailyReward(before);
    if (!preview.ok) {
      showSceneDialogue(
        preview.reason === 'already-claimed'
          ? '오늘 출석 보상은 이미 받았어요.'
          : '오늘 출석 목표를 먼저 달성해 주세요.',
      );
      return false;
    }

    syncingRef.current = true;
    setClaimingAttendanceDaily(true);
    setActionSyncing(true);
    const epoch = stateEpochRef.current;
    stateRef.current = preview.state;
    setState(preview.state);

    try {
      const result = await claimAttendanceDailyRewardApi();
      applyAuthoritativeState(result.state, { epoch });
      showSceneDialogue(sceneDialogueForAttendanceDailyClaim(result.rewardCups ?? preview.rewardCups));
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state, { epoch });
      } else {
        stateRef.current = before;
        setState(before);
      }
      showSceneDialogue(err instanceof Error ? err.message : '출석 보상을 받지 못했어요.');
      return false;
    } finally {
      syncingRef.current = false;
      setClaimingAttendanceDaily(false);
      setActionSyncing(false);
    }
  }, [applyAuthoritativeState, claimingAttendanceDaily, showSceneDialogue]);

  const claimAttendanceStreak = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession?.userId || syncingRef.current || claimingAttendanceStreak) return false;

    const before = stateRef.current;
    const preview = applyClaimAttendanceStreakBonus(before);
    if (!preview.ok) {
      showSceneDialogue('7일 연속 출석 보너스를 받을 수 없어요.');
      return false;
    }

    syncingRef.current = true;
    setClaimingAttendanceStreak(true);
    setActionSyncing(true);
    const epoch = stateEpochRef.current;
    stateRef.current = preview.state;
    setState(preview.state);

    try {
      const result = await claimAttendanceStreakBonusApi();
      applyAuthoritativeState(result.state, { epoch });
      showSceneDialogue(sceneDialogueForAttendanceStreakClaim(result.rewardCups ?? preview.rewardCups));
      void scheduleReviewPrompt({
        trigger: 'attendance-streak-7',
        onPrime: (copy) => showSceneDialogue(sceneDialogueForReviewPriming(copy)),
      });
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state, { epoch });
      } else {
        stateRef.current = before;
        setState(before);
      }
      showSceneDialogue(err instanceof Error ? err.message : '연속 출석 보너스를 받지 못했어요.');
      return false;
    } finally {
      syncingRef.current = false;
      setClaimingAttendanceStreak(false);
      setActionSyncing(false);
    }
  }, [applyAuthoritativeState, claimingAttendanceStreak, showSceneDialogue]);

  const claimBrewedCoffeeFinishBonus = useCallback(async () => {
    if (claimingFinishBonus || watchingAd || syncingRef.current) {
      showSceneDialogue('잠시만 기다려 주세요…');
      return false;
    }

    const before = stateRef.current;
    if (before.totalCoffees >= 50) {
      showSceneDialogue('50잔을 채웠어요. 내린 커피 마시기를 눌러 주세요.');
      return false;
    }

    if (before.totalCoffees < BREWED_COFFEE_FINISH_BONUS_THRESHOLD) {
      const need = BREWED_COFFEE_FINISH_BONUS_THRESHOLD - before.totalCoffees;
      showSceneDialogue(`${need.toLocaleString('ko-KR')}잔만 더 모으면 마지막 부스트를 받을 수 있어요.`);
      return false;
    }

    const currentSession = sessionRef.current;
    if (!currentSession?.userId) {
      const message = getServerUnavailableMessage();
      setActionError(message);
      showSceneDialogue(message);
      return false;
    }

    syncingRef.current = true;
    setClaimingFinishBonus(true);
    setActionSyncing(true);
    setWatchingAd(true);
    setActionError(null);

    try {
      const rewarded = await watchRewardedAd('coffee-finish-bonus');
      setWatchingAd(false);

      if (!rewarded) {
        showSceneDialogue('부스트를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
        return false;
      }

      stateEpochRef.current += 1;
      const epoch = stateEpochRef.current;
      const optimistic = {
        ...before,
        ...grantBrewedCoffeeFields(before, BREWED_COFFEE_FINISH_BONUS_AMOUNT),
      };
      stateRef.current = optimistic;
      setState(optimistic);

      const result = await claimBrewedCoffeeFinishBonusGame();
      applyAuthoritativeState(result.state, { epoch });
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      showSceneDialogue(`마지막 부스트! 내린 커피 +${result.rewardCups}잔`);
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state);
      } else {
        stateRef.current = before;
        setState(before);
      }
      const message = err instanceof Error ? err.message : '마지막 부스트를 받을 수 없어요.';
      setActionError(message);
      showSceneDialogue(message);
      return false;
    } finally {
      syncingRef.current = false;
      setClaimingFinishBonus(false);
      setWatchingAd(false);
      setActionSyncing(false);
    }
  }, [applyAuthoritativeState, claimingFinishBonus, showSceneDialogue, updatePlayerRank, watchingAd]);

  const sellBatch = useCallback(async (cupCount: number): Promise<SellBatchOutcome> => {
    const batchSize = Math.floor(Number(cupCount) || 0);
    if (!BREWED_COFFEE_DRINK_OPTIONS.includes(batchSize as (typeof BREWED_COFFEE_DRINK_OPTIONS)[number])) {
      showSceneDialogue('선택한 잔 수를 사용할 수 없어요.');
      return { ok: false };
    }

    const reward = getBrewedCoffeePointReward(batchSize);
    const currentSession = sessionRef.current;
    if (!currentSession?.userId) {
      const message = import.meta.env.DEV
        ? '백엔드 서버를 실행하고 게스트 로그인 후 다시 시도해 주세요.'
        : getServerUnavailableMessage();
      setActionError(message);
      showSceneDialogue(message);
      return { ok: false };
    }

    if (syncingRef.current) {
      const message = '다른 동작을 처리 중이에요. 잠시 후 다시 시도해 주세요.';
      showSceneDialogue(message);
      return { ok: false };
    }

    const before = settleDailyPoint(stateRef.current);
    if (hasReachedDailyPointCap(before)) {
      showSceneDialogue(sceneDialogueForDailyPointCap());
      return { ok: false };
    }

    if (before.totalCoffees < batchSize) {
      const message = `내린 커피 ${batchSize.toLocaleString('ko-KR')}잔이 필요해요.`;
      setActionError(message);
      showSceneDialogue(message);
      return { ok: false };
    }

    const room = getDailyPointRoom(before);
    const actualReward = Math.min(reward, room);
    if (actualReward <= 0) {
      showSceneDialogue(sceneDialogueForDailyPointCap());
      return { ok: false };
    }

    syncingRef.current = true;
    setSellingBatch(true);
    setActionSyncing(true);
    setActionError(null);
    const epoch = stateEpochRef.current;

    const nextMoney = before.money + actualReward;
    const today = getTodayKey();
    const dailyBrewedSpent =
      before.dailyBrewedSpentDayKey === today ? before.dailyBrewedSpent + batchSize : batchSize;
    const optimistic = {
      ...before,
      totalCoffees: before.totalCoffees - batchSize,
      spentCoffeeCups: before.spentCoffeeCups + batchSize,
      lifetimeDrunkCoffees: (before.lifetimeDrunkCoffees ?? 0) + batchSize,
      lifetimeBrewedSpent: (before.lifetimeBrewedSpent ?? 0) + batchSize,
      dailyBrewedSpentDayKey: today,
      dailyBrewedSpent,
      money: nextMoney,
    };
    stateRef.current = optimistic;
    setState(optimistic);
    setLastEarned(actualReward);

    try {
      const result = await sellCoffeeBatch(batchSize);
      applyAuthoritativeState(result.state, { epoch });
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      setLastEarned(result.lastEarned);
      const earned = result.lastEarned ?? actualReward;
      const capReached =
        result.dailyCapJustReached === true || hasReachedDailyPointCap(result.state);
      const brewed200Reached = hasCrossedBrewedSpentReviewThreshold(
        before.lifetimeBrewedSpent ?? 0,
        result.state.lifetimeBrewedSpent ?? 0,
      );

      const promotion = await claimBrewedCoffeePromotion(batchSize, earned);
      if (promotion.ok && promotion.state) {
        applyAuthoritativeState(promotion.state, { epoch });
      }

      let popupMessage: string;
      if (capReached) {
        popupMessage = sceneDialogueForDailyPointCap();
        void scheduleReviewPrompt({
          trigger: 'daily-point-cap',
          onPrime: (copy) => showSceneDialogue(sceneDialogueForReviewPriming(copy)),
        });
      } else if (brewed200Reached) {
        popupMessage = sceneDialogueForBrewedSpent200(result.state.lifetimeBrewedSpent ?? 0);
      } else if (promotion.ok) {
        popupMessage = sceneDialogueForSellBatchWithPromotion(batchSize, earned, promotion.message);
      } else if (!promotion.skipped) {
        popupMessage = sceneDialogueForSellBatchPromotionFailed(batchSize, earned);
      } else {
        popupMessage = sceneDialogueForSellBatch(batchSize, earned);
      }

      if (brewed200Reached) {
        void scheduleReviewPrompt({
          trigger: 'brewed-spent-200',
          onPrime: (copy) => showSceneDialogue(sceneDialogueForReviewPriming(copy)),
        });
      }
      return { ok: true, popupMessage };
    } catch (err) {
      if (err instanceof ApiRequestError && err.state) {
        applyAuthoritativeState(err.state, { epoch });
      } else {
        stateRef.current = before;
        setState(before);
        setLastEarned(null);
      }
      const message = err instanceof Error ? err.message : '내린 커피 마시기에 실패했습니다.';
      setActionError(message);
      showSceneDialogue(message);
      return { ok: false };
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
      false,
      state.dailyPassiveGrowth,
      balanceRules.dailyPassiveGrowthCap,
      state.passiveCoffeesClaimed,
    ) && !claimingPassiveCoffee && !reactivatingPassiveCoffee,
    onPassiveUpdate: applyPassiveAccrual,
  });

  useEffect(() => {
    releasePassiveClaimUi();
    return () => {
      releasePassiveClaimUi();
    };
  }, [releasePassiveClaimUi]);

  useEffect(() => {
    const stats = getPassiveUiStats(stateRef.current, balanceRules);

    if (stats.canClaim && !prevPassiveCanClaimRef.current) {
      if (
        !canSpinDailyLoginRouletteToday(stateRef.current) ||
        hasSeenDailyRouletteSceneDialogueToday()
      ) {
        showSceneDialogue(sceneDialogueForPassiveReady());
      }
    }

    prevPassiveCanClaimRef.current = stats.canClaim;
  }, [
    balanceRules,
    showSceneDialogue,
    state.dailyPassiveGrowth,
    state.passiveCoffeesClaimed,
    state.passiveDayKey,
    state.growth,
  ]);

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
      if (harvestRewardTimerRef.current !== null) {
        clearTimeout(harvestRewardTimerRef.current);
      }
    },
    [clearHoldTimer],
  );

  const progress = Math.min(100, (state.money / GOAL_AMOUNT) * 100);
  const dailyPointCapReached = hasReachedDailyPointCap(settleDailyPoint(state));
  const drinkUiActive =
    (isReadyToDrinkGrowth(state.growth) || isDrinkCommitting) && !isHolding;
  const readyToDrink =
    isReadyToDrinkGrowth(state.growth) && !actionSyncing && !isHolding;
  const holdRemainingSec = Math.max(0, holdTargetSec - holdElapsedSec);
  const waterStatus = useMemo(
    () => getWaterStatus(state),
    [state.waterDayKey, state.watersToday, state.adWaterCredits, state.growth],
  );
  const needsAd = waterStatus.needsAd;
  const growActionSlot = getGrowActionSlot({
    readyToDrink,
    isDrinkCommitting,
    state,
    visualGrowth: displayGrowth,
  });
  const showWatchAdButton = growActionSlot === 'ad';
  const passiveActive =
    canAccruePassiveGrowth(
      state.growth,
      false,
      state.dailyPassiveGrowth,
      balanceRules.dailyPassiveGrowthCap,
      state.passiveCoffeesClaimed,
    ) &&
    !claimingPassiveCoffee &&
    !reactivatingPassiveCoffee;

  const previewReviewTest = useCallback(
    (trigger: ReviewTrigger) => {
      if (!isReviewPreviewEnabled()) {
        return;
      }

      const label = REVIEW_TRIGGER_LABELS[trigger];
      setReviewPreviewStatus(`「${label}」 미리보기 시작… (화면 위 대화창을 확인해 주세요)`);

      void previewReviewPrompt({
        trigger,
        fastPreview: true,
        onMilestone: () => {
          setReviewPreviewStatus(`1/3 축하 대사 · ${label}`);
          switch (trigger) {
            case 'daily-point-cap':
              showSceneDialogue(sceneDialogueForDailyPointCap(), false);
              break;
            case 'daily-ranking-top3':
              showSceneDialogue('오늘의 커피 랭킹 TOP3에 들었어요!', false);
              break;
            case 'attendance-streak-7':
              showSceneDialogue(sceneDialogueForAttendanceStreakClaim(10), false);
              break;
            case 'hidden-character-unlock':
              showSceneDialogue(sceneDialogueForHiddenCharacterUnlock('히든 커플'), false);
              break;
            case 'brewed-spent-200':
              showSceneDialogue(sceneDialogueForBrewedSpent200(200), false);
              break;
            case 'shop-purchase-2':
              showSceneDialogue(sceneDialogueForShopPurchase2(2), false);
              break;
          }
        },
        onPrime: (copy) => {
          setReviewPreviewStatus(`2/3 프라이밍 카피 · ${label}`);
          showSceneDialogue(sceneDialogueForReviewPriming(copy), false);
        },
        onComplete: () => {
          setReviewPreviewStatus(`3/3 완료 · ${label} (토스 앱에서는 여기서 리뷰 팝업)`);
          showSceneDialogue(sceneDialogueForReviewPreviewComplete());
        },
      });
    },
    [showSceneDialogue],
  );

  const resetReviewTestStore = useCallback(() => {
    if (!isReviewPreviewEnabled()) {
      return;
    }
    resetReviewPromptStore();
    setReviewPreviewStatus('리뷰 유도 기록을 초기화했어요.');
    showSceneDialogue('리뷰 유도 기록을 초기화했어요.');
  }, [showSceneDialogue]);

  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);

  return {
    session,
    state,
    displayGrowth,
    balanceRules,
    connectionWarning,
    loading,
    error,
    actionError,
    clearActionError,
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
    testSetTotalCoffees,
    testSetSpentCoffeeCups,
    releaseTestAddSpentCoffeeCups,
    releaseTestAddBrewedCoffees,
    purchaseVariant,
    selectVariant,
    reset,
    watchAd,
    grantTutorialWaterRefill,
    claimBrewedCoffeeFinishBonus,
    claimingFinishBonus,
    sellBatch,
    sellingBatch,
    claimAttendanceDaily,
    claimAttendanceStreak,
    claimingAttendanceDaily,
    claimingAttendanceStreak,
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
    claimMinigameReward,
    claimDailyLoginRoulette,
    respinDailyLoginRoulette,
    resetDailyLoginRouletteForTest,
    resetRouletteRewardState,
    resetDailyFortuneRewardState,
    getRewardResetLogSnapshot: () => buildRewardResetLogSnapshot(stateRef.current),
    claimPassiveCoffee,
    claimingPassiveCoffee,
    passiveClaimFeedback,
    reactivatePassiveCoffee,
    reactivatingPassiveCoffee,
    actionSyncing,
    passiveActive,
    holdMode,
    lastEarned,
    harvestReward,
    tapBurst,
    isHolding,
    holdProgress,
    holdTargetSec,
    holdElapsedSec,
    holdRemainingSec,
    remaining: Math.max(0, GOAL_AMOUNT - state.money),
    dailyPointCapReached,
    reviewPreviewStatus,
    sceneDialogue,
    showSceneDialogue,
    applyServerState: applyAuthoritativeState,
    updatePlayerRank,
    previewReviewTest,
    resetReviewTestStore,
  };
}
