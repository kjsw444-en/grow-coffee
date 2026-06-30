import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useGameAudio } from '../audio/useGameAudio';
import { useButtonSound, useSound } from '../audio/SoundProvider';
import { MOCK_USER } from '../game/mockData';
import {
  getOnboardingUiState,
  hasCompletedInteractiveTutorial,
  markInteractiveTutorialComplete,
  markWelcomeOnboardingComplete,
  ONBOARDING_RESET_EVENT,
  resetOnboardingStorage,
} from '../services/onboardingStorage';
import {
  hasSeenCatFortuneGuideToday,
  hasSeenCatRouletteGuideToday,
  markCatFortuneGuideSeenToday,
  markCatRouletteGuideSeenToday,
  primeBonusRouletteNudge,
  resetCatGuideStorage,
  resetCatRouletteGuideForToday,
} from '../services/catGuideStorage';
import { getAttendanceUiStats, getTodayKey } from '../game/attendance';
import { formatPassivePanelHint, formatPassiveTimeRemainingLabel, getPassiveUiStats, roundGrowth } from '../game/passiveGrowth';
import { formatWaterPanelHint } from '../game/waterQuota';
import { randomCatNudgeDialogue, sceneDialogueForBonusRouletteNudge, sceneDialogueForDailyRitualFortuneNudge, sceneDialogueForDailyRouletteNudge, sceneDialogueForRevealedFortune, sceneDialogueForReviewPriming } from '../game/sceneDialogue';
import { useCoffeeGame } from '../game/useCoffeeGame';
import { useDrinkVideoPreload } from '../game/useDrinkVideoPreload';
import { REVIEW_TRIGGER_LABELS, REVIEW_TRIGGERS, isReviewPreviewEnabled, scheduleReviewPrompt } from '../services/reviewPrompt';
import {
  isRankingTop3PromotionMockEnabled,
  resetRankingTop3PromotionForTest,
  claimRankingTop3Promotion,
  getRankingTop3ClaimSuccessMessage,
} from '../services/rankingTop3Promotion';
import { initInterstitialAds } from '../services/interstitialAd';
import { initRewardedAds } from '../services/rewardedAd';
import { formatWon, isDrinkStage } from '../game/utils';
import {
  RELEASE_TEST_ADD_DRUNK_COFFEES,
  RELEASE_TEST_ADD_BREWED_COFFEES,
  RELEASE_TEST_TOOLS_ENABLED,
} from '../game/featureFlags';
import type { AuthUser } from '../hooks/useAuth';
import type { DailyGameId } from '../services/dailyGamePick';
import type { BonusFeatureView } from '../features/goldcat/BonusFeatureHost';
import type { ComicInitialTarget } from '../features/goldcat/StoryComicScreen';
import { getCoffeeRanking, syncCoffeeRanking, type CoffeeRankingView } from '../services/coffeeRanking';
import { devFinalizeRankingNow, fetchRankingTop3PromotionStatus, type RankingTop3RewardStatus, claimRitualFortuneRewardGame, claimRitualMissionRewardGame, openRitualGiftGame, revealRitualFortuneGame, ApiRequestError, devResetDailyRitualGame, devSetDailyRitualFortuneGame, devCompleteDailyRitualMissionGame, devAdvanceDailyRitualGame } from '../services/api';
import { getDailyRankingBrewedSpend } from '../game/rankingScore';
import { AdBannerSlot } from './AdBannerSlot';
import { BottomNav } from './BottomNav';
import { CharacterShopSheet } from './CharacterShopSheet';
import { MyCoffeeSheet } from './MyCoffeeSheet';
import { GameFlowFooter } from './GameFlowFooter';
import { GrowthPanel } from './GrowthPanel';
import { OnboardingModal } from './OnboardingModal';
import {
  InteractiveTutorialOverlay,
  type TutorialStep,
} from './InteractiveTutorialOverlay';
import { PlantScene } from './PlantScene';
import { DailyMissionPanel } from './DailyMissionPanel';
import { RankingSheet } from './RankingSheet';
import { RankingRewardAlertModal } from './RankingRewardAlertModal';
import { RecommendButtons } from './RecommendButtons';
import { SettingsSheet } from './SettingsSheet';
import { UserBar } from './UserBar';
import { DailyLoginRouletteModal } from './DailyLoginRouletteModal';
import { canRespinDailyLoginRouletteToday, canSpinDailyLoginRouletteToday, hasPendingBonusRouletteSpin, pickDailyLoginRouletteCups } from '../game/dailyLoginRoulette';
import {
  buildLocalMissionPreview,
  canClaimLocalMissionReward,
  getOpenedRitualGiftLabel,
  getOpenedRitualGiftDescription,
  getRitualEffectiveGrowth,
  isRitualFortunePending,
  isRitualGiftPending,
  RITUAL_GIFT_TEST_OPTIONS,
} from '../services/dailyRitual';
import {
  dismissDailyLoginRouletteForSession,
  clearDailyLoginRouletteSessionDismiss,
  isDailyLoginRouletteDismissedForSession,
  markDailyLoginRouletteShownLocal,
  syncDailyLoginRouletteLocalWithServer,
} from '../services/dailyLoginRouletteStorage';
import { watchRewardedAd } from '../services/rewardedAd';
import './CoffeeGame.css';

const BonusFeatureHost = lazy(() =>
  import('../features/goldcat/BonusFeatureHost').then((module) => ({
    default: module.BonusFeatureHost,
  })),
);


function toAuthUser(session: {
  userId: string;
  displayName: string;
  source: string;
  playerRank?: number | null;
} | null): AuthUser {
  const source = (session?.source ?? 'mock') as AuthUser['source'];

  return {
    userId: session?.userId ?? '',
    name: session?.displayName ?? MOCK_USER.name,
    rank: session?.playerRank ?? (source === 'mock' ? MOCK_USER.rank : null),
    source,
  };
}

export function CoffeeGame() {
  const [showWelcome, setShowWelcome] = useState(() => getOnboardingUiState().showWelcome);
  const [tutorialActive, setTutorialActive] = useState(
    () => getOnboardingUiState().tutorialActive,
  );
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('intro');
  const tutorialWatersBaselineRef = useRef<number | null>(null);
  const tutorialCoffeesBaselineRef = useRef<number | null>(null);
  const tutorialRefillingRef = useRef(false);

  const {
    session,
    state,
    balanceRules,
    connectionWarning,
    loading,
    error,
    actionError,
    clearActionError,
    startHold,
    stopHold,
    completeDrink,
    testBumpGrowth,
    testBumpPassiveGrowth,
    testSetTotalCoffees,
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
    displayGrowth,
    passiveActive,
    waterStatus,
    readyToDrink,
    drinkUiActive,
    isDrinkCommitting,
    needsAd,
    showWatchAdButton,
    growActionSlot,
    canUseGrowHold,
    watchingAd,
    sharingReward,
    shareRewardAvailable,
    claimShareReward,
    claimMinigameReward,
    claimDailyLoginRoulette,
    respinDailyLoginRoulette,
    resetDailyLoginRouletteForTest,
    claimPassiveCoffee,
    claimingPassiveCoffee,
    passiveClaimFeedback,
    reactivatePassiveCoffee,
    reactivatingPassiveCoffee,
    actionSyncing,
    holdMode,
    tapBurst,
    isHolding,
    holdProgress,
    holdTargetSec,
    holdElapsedSec,
    holdRemainingSec,
    lastEarned,
    harvestReward,
    loggingIn,
    authMessage,
    loginWithToss,
    logout,
    isTossInApp,
    sceneDialogue,
    showSceneDialogue,
    applyServerState,
    updatePlayerRank,
    dailyPointCapReached,
    previewReviewTest,
    resetReviewTestStore,
    reviewPreviewStatus,
  } = useCoffeeGame({ tutorialBypassQuota: tutorialActive });

  const drinkVideoPreloadGrowth = Math.max(
    roundGrowth(state.growth),
    roundGrowth(displayGrowth),
  );
  useDrinkVideoPreload(
    drinkVideoPreloadGrowth,
    state.selectedCoffeeVariant,
    state.ownedCoffeeVariants,
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showMyCoffee, setShowMyCoffee] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [coffeeRanking, setCoffeeRanking] = useState<CoffeeRankingView | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [rankingRewardClaiming, setRankingRewardClaiming] = useState(false);
  const [rankingRewardStatus, setRankingRewardStatus] = useState<RankingTop3RewardStatus | null>(null);
  const [showRankingRewardAlert, setShowRankingRewardAlert] = useState(false);
  const [bonusView, setBonusView] = useState<BonusFeatureView>(null);
  const [comicTarget, setComicTarget] = useState<ComicInitialTarget | null>(null);
  const [comicInlineEntry, setComicInlineEntry] = useState(false);
  const [showDailyRoulette, setShowDailyRoulette] = useState(false);
  const [catFortuneGuideSeen, setCatFortuneGuideSeen] = useState(() => hasSeenCatFortuneGuideToday());
  const [catRouletteGuideSeen, setCatRouletteGuideSeen] = useState(() => hasSeenCatRouletteGuideToday());
  const [ritualBusy, setRitualBusy] = useState(false);
  const ritualNudgeOpeningRef = useRef(false);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<number | null>(null);
  const [rouletteSpinGeneration, setRouletteSpinGeneration] = useState(0);
  const [rouletteSnapRevealKey, setRouletteSnapRevealKey] = useState(0);
  const [rouletteActionError, setRouletteActionError] = useState<string | null>(null);
  const rankingRewardAlertDismissedRef = useRef(false);
  const rouletteNudgeOpeningRef = useRef(false);
  const rouletteSyncedOnOpenRef = useRef(false);
  const rouletteResultBeforeRespinRef = useRef<number | null>(null);
  const rouletteRespinModeRef = useRef(false);
  const [rouletteRespinMode, setRouletteRespinMode] = useState(false);

  useEffect(() => {
    rouletteRespinModeRef.current = rouletteRespinMode;
  }, [rouletteRespinMode]);
  const { play, unlock, startAmbient } = useSound();
  const buttonSound = useButtonSound();
  const user = useMemo(
    () => toAuthUser(session),
    [session?.userId, session?.displayName, session?.source, session?.playerRank],
  );
  const catDialogueCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const catDialogueRawRef = useRef<string | null>(null);
  const harvestRewardStopSoundKeyRef = useRef<number | null>(null);

  const stopCatDialogueCycle = useCallback(() => {
    if (catDialogueCycleRef.current !== null) {
      clearInterval(catDialogueCycleRef.current);
      catDialogueCycleRef.current = null;
    }
  }, []);

  const handleCatPressStart = useCallback(() => {
    stopCatDialogueCycle();
    const { raw, text } = randomCatNudgeDialogue();
    catDialogueRawRef.current = raw;
    showSceneDialogue(text, false);
    catDialogueCycleRef.current = setInterval(() => {
      const next = randomCatNudgeDialogue(catDialogueRawRef.current ?? undefined);
      catDialogueRawRef.current = next.raw;
      showSceneDialogue(next.text, false);
    }, 1400);
  }, [showSceneDialogue, stopCatDialogueCycle]);

  const handleCatPressEnd = useCallback(() => {
    stopCatDialogueCycle();
    const next = randomCatNudgeDialogue(catDialogueRawRef.current ?? undefined);
    catDialogueRawRef.current = next.raw;
    showSceneDialogue(next.text, true);
  }, [showSceneDialogue, stopCatDialogueCycle]);

  const handleCatPressEndWithRoulette = useCallback(() => {
    if (rouletteNudgeOpeningRef.current || ritualNudgeOpeningRef.current) {
      rouletteNudgeOpeningRef.current = false;
      ritualNudgeOpeningRef.current = false;
      return;
    }
    handleCatPressEnd();
  }, [handleCatPressEnd]);

  useEffect(() => () => stopCatDialogueCycle(), [stopCatDialogueCycle]);

  useEffect(() => {
    if (!harvestReward || harvestReward.cups == null) return;
    if (harvestRewardStopSoundKeyRef.current === harvestReward.key) return;
    harvestRewardStopSoundKeyRef.current = harvestReward.key;
    play('slotStop');
  }, [harvestReward, play]);

  const syncOnboardingUi = useCallback(() => {
    const next = getOnboardingUiState();
    setShowWelcome(next.showWelcome);
    setTutorialActive(next.tutorialActive);
    if (next.showWelcome) {
      setTutorialStep('intro');
      tutorialWatersBaselineRef.current = null;
      tutorialCoffeesBaselineRef.current = null;
    }
  }, []);

  useEffect(() => {
    syncOnboardingUi();
    window.addEventListener(ONBOARDING_RESET_EVENT, syncOnboardingUi);
    return () => window.removeEventListener(ONBOARDING_RESET_EVENT, syncOnboardingUi);
  }, [syncOnboardingUi]);

  const onboardingBlocking = showWelcome || tutorialActive;

  const tryOpenRankingRewardAlert = useCallback(
    (status: RankingTop3RewardStatus | null | undefined) => {
      if (!status?.canClaim || rankingRewardAlertDismissedRef.current) {
        return false;
      }

      const onboarding = getOnboardingUiState();
      if (onboarding.showWelcome || onboarding.tutorialActive) {
        return false;
      }

      if (showDailyRoulette) {
        return false;
      }

      setShowRankingRewardAlert(true);
      play('modalOpen');
      return true;
    },
    [play, showDailyRoulette],
  );

  useEffect(() => {
    rankingRewardAlertDismissedRef.current = false;
  }, [session?.userId]);

  useEffect(() => {
    if (loading || !session?.userId) {
      return;
    }

    let cancelled = false;

    void fetchRankingTop3PromotionStatus()
      .then((status) => {
        if (cancelled) return;
        setRankingRewardStatus(status);
        tryOpenRankingRewardAlert(status);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [loading, session?.userId, tryOpenRankingRewardAlert]);

  useEffect(() => {
    if (onboardingBlocking || showDailyRoulette) return;
    if (!rankingRewardStatus?.canClaim || showRankingRewardAlert) return;
    tryOpenRankingRewardAlert(rankingRewardStatus);
  }, [
    onboardingBlocking,
    rankingRewardStatus,
    showDailyRoulette,
    showRankingRewardAlert,
    tryOpenRankingRewardAlert,
  ]);

  const dismissCatFortuneGuide = useCallback(() => {
    markCatFortuneGuideSeenToday();
    setCatFortuneGuideSeen(true);
  }, []);

  const dismissCatRouletteGuide = useCallback(() => {
    markCatRouletteGuideSeenToday();
    setCatRouletteGuideSeen(true);
  }, []);

  useEffect(() => {
    const today = getTodayKey();
    setCatFortuneGuideSeen(hasSeenCatFortuneGuideToday(today));
    setCatRouletteGuideSeen(hasSeenCatRouletteGuideToday(today));
  }, [state.ritualDayKey, state.dailyLoginRouletteDayKey]);

  const pendingBonusRouletteSpin = useMemo(
    () => hasPendingBonusRouletteSpin(state),
    [state.dailyLoginRouletteDayKey, state.ritualBonusRouletteSpins],
  );

  useEffect(() => {
    if (!pendingBonusRouletteSpin) return;
    clearDailyLoginRouletteSessionDismiss();
    primeBonusRouletteNudge();
    setCatRouletteGuideSeen(false);
  }, [pendingBonusRouletteSpin]);

  const openDailyRouletteModal = useCallback((options?: { forceOpen?: boolean }) => {
    if (loading && !options?.forceOpen) return false;

    const onboarding = getOnboardingUiState();
    if (!options?.forceOpen && (onboarding.showWelcome || onboarding.tutorialActive)) return false;

    const forcePreview =
      import.meta.env.DEV && new URLSearchParams(window.location.search).get('roulette') === '1';

    if (forcePreview || options?.forceOpen) {
      setRouletteActionError(null);
      setShowDailyRoulette(true);
      return true;
    }

    if (!canSpinDailyLoginRouletteToday(state)) {
      return false;
    }

    setRouletteActionError(null);
    if (pendingBonusRouletteSpin && !options?.forceOpen) {
      setRouletteResult(null);
      setRouletteSpinGeneration(0);
      setRouletteSnapRevealKey(0);
      rouletteSyncedOnOpenRef.current = false;
    }
    markDailyLoginRouletteShownLocal();
    setShowDailyRoulette(true);
    return true;
  }, [loading, pendingBonusRouletteSpin, state]);

  const showDailyRouletteNudge = useMemo(() => {
    if (loading || onboardingBlocking) return false;
    const onboarding = getOnboardingUiState();
    if (onboarding.showWelcome || onboarding.tutorialActive) return false;
    if (!canSpinDailyLoginRouletteToday(state)) return false;
    if (pendingBonusRouletteSpin) return true;
    return !catRouletteGuideSeen && !isDailyLoginRouletteDismissedForSession();
  }, [catRouletteGuideSeen, loading, onboardingBlocking, pendingBonusRouletteSpin, state]);

  useEffect(() => {
    syncDailyLoginRouletteLocalWithServer(state.dailyLoginRouletteDayKey);
  }, [state.dailyLoginRouletteDayKey]);

  const showFortuneNudge = useMemo(() => {
    if (loading || onboardingBlocking || showDailyRoulette) return false;
    if (showDailyRouletteNudge) return false;
    if (catFortuneGuideSeen) return false;
    return isRitualFortunePending(state);
  }, [catFortuneGuideSeen, loading, onboardingBlocking, showDailyRoulette, showDailyRouletteNudge, state]);

  const showRitualGiftBox = useMemo(() => {
    if (loading || onboardingBlocking || showDailyRoulette) return false;
    return isRitualGiftPending(state);
  }, [loading, onboardingBlocking, showDailyRoulette, state]);

  const showMissionPanel = useMemo(() => {
    if (loading || onboardingBlocking) return false;
    return Boolean(state.ritualFortuneRevealed && !state.ritualMissionClaimed);
  }, [loading, onboardingBlocking, state.ritualFortuneRevealed, state.ritualMissionClaimed]);

  const ritualMissions = useMemo(() => buildLocalMissionPreview(state), [state]);

  const openedRitualGiftLabel = useMemo(() => getOpenedRitualGiftLabel(state), [state]);
  const openedRitualGiftDescription = useMemo(() => getOpenedRitualGiftDescription(state), [state]);

  const canClaimFortuneHarvestBonus = useMemo(() => {
    return (
      state.ritualFortuneId === 'HARVEST_GOAL_2' &&
      state.ritualFortuneRevealed &&
      !state.ritualFortuneClaimed &&
      state.ritualFortuneProgress >= 2
    );
  }, [state]);

  const handleDailyRitualFortuneReveal = useCallback(async () => {
    if (ritualBusy || !isRitualFortunePending(state)) return;

    setRitualBusy(true);
    try {
      const result = await revealRitualFortuneGame();
      dismissCatFortuneGuide();
      applyServerState(result.state, { trustServer: true });
      const copy = sceneDialogueForRevealedFortune(result.copy);
      showSceneDialogue(copy);
      play('modalOpen');
    } catch (err) {
      const message = err instanceof Error ? err.message : '운세를 확인하지 못했어요.';
      if (err instanceof ApiRequestError && err.state) {
        applyServerState(err.state, { trustServer: true });
      }
      showSceneDialogue(message);
    } finally {
      setRitualBusy(false);
    }
  }, [applyServerState, dismissCatFortuneGuide, play, ritualBusy, showSceneDialogue, state]);

  const handleDailyRitualGiftOpen = useCallback(async () => {
    if (ritualBusy || !isRitualGiftPending(state)) return;

    setRitualBusy(true);
    try {
      const result = await openRitualGiftGame();
      applyServerState(result.state, { trustServer: true });
      if (result.playerRank != null) {
        updatePlayerRank(result.playerRank);
      }
      showSceneDialogue(result.copy);
      play('slotStop');
    } catch (err) {
      const message = err instanceof Error ? err.message : '선물을 열지 못했어요.';
      if (err instanceof ApiRequestError && err.state) {
        applyServerState(err.state, { trustServer: true });
      }
      showSceneDialogue(message);
    } finally {
      setRitualBusy(false);
    }
  }, [applyServerState, play, ritualBusy, showSceneDialogue, state, updatePlayerRank]);

  const handleClaimRitualMissionReward = useCallback(async () => {
    if (ritualBusy || !canClaimLocalMissionReward(state)) return;

    setRitualBusy(true);
    try {
      const result = await claimRitualMissionRewardGame();
      applyServerState(result.state, { trustServer: true });
      showSceneDialogue(`미션 완료! 커피 ${result.rewardCups}잔을 받았어요.`);
      play('slotStop');
    } catch (err) {
      const message = err instanceof Error ? err.message : '미션 보상을 받지 못했어요.';
      if (err instanceof ApiRequestError && err.state) {
        applyServerState(err.state, { trustServer: true });
      }
      showSceneDialogue(message);
    } finally {
      setRitualBusy(false);
    }
  }, [applyServerState, play, ritualBusy, showSceneDialogue, state]);

  const handleClaimRitualFortuneReward = useCallback(async () => {
    if (ritualBusy || !canClaimFortuneHarvestBonus) return;

    setRitualBusy(true);
    try {
      const result = await claimRitualFortuneRewardGame();
      applyServerState(result.state, { trustServer: true });
      showSceneDialogue(`수확 보너스! 커피 ${result.rewardCups}잔을 받았어요.`);
      play('slotStop');
    } catch (err) {
      const message = err instanceof Error ? err.message : '수확 보너스를 받지 못했어요.';
      if (err instanceof ApiRequestError && err.state) {
        applyServerState(err.state, { trustServer: true });
      }
      showSceneDialogue(message);
    } finally {
      setRitualBusy(false);
    }
  }, [applyServerState, canClaimFortuneHarvestBonus, play, ritualBusy, showSceneDialogue]);

  const ritualDevStatus = useMemo(() => {
    if (!import.meta.env.DEV) return '';
    const doneCount = ritualMissions.filter((mission) => mission.done).length;
    return [
      state.ritualFortuneId || '운세미정',
      state.ritualFortuneRevealed ? '확인완료' : '확인전',
      state.ritualGiftOpened ? '선물완료' : '선물전',
      `미션 ${doneCount}/3`,
      state.ritualMissionClaimed ? '미션보상수령' : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }, [ritualMissions, state]);

  const applyRitualDevState = useCallback(
    (nextState: Parameters<typeof applyServerState>[0], message: string) => {
      applyServerState(nextState, { trustServer: true });
      showSceneDialogue(message);
    },
    [applyServerState, showSceneDialogue],
  );

  const handleDevResetDailyRitual = useCallback(async () => {
    if (ritualBusy) return;
    setRitualBusy(true);
    try {
      const result = await devResetDailyRitualGame();
      resetCatGuideStorage();
      setCatFortuneGuideSeen(false);
      setCatRouletteGuideSeen(hasSeenCatRouletteGuideToday());
      applyRitualDevState(result.state, '오늘의 커피 운세를 초기화했어요. (테스트용)');
    } catch (err) {
      const message = err instanceof Error ? err.message : '운세 초기화에 실패했어요.';
      if (err instanceof ApiRequestError && err.state) {
        applyServerState(err.state, { trustServer: true });
      }
      showSceneDialogue(message);
    } finally {
      setRitualBusy(false);
    }
  }, [applyRitualDevState, applyServerState, ritualBusy, showSceneDialogue]);

  const handleDevSetDailyRitualFortune = useCallback(
    async (fortuneId: string, label: string) => {
      if (ritualBusy) return;
      setRitualBusy(true);
      try {
        const result = await devSetDailyRitualFortuneGame(fortuneId);
        applyRitualDevState(result.state, `운세를 「${label}」로 바꿨어요. (테스트용)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : '운세 변경에 실패했어요.';
        if (err instanceof ApiRequestError && err.state) {
          applyServerState(err.state, { trustServer: true });
        }
        showSceneDialogue(message);
      } finally {
        setRitualBusy(false);
      }
    },
    [applyRitualDevState, applyServerState, ritualBusy, showSceneDialogue],
  );

  const handleDevCompleteDailyRitualMission = useCallback(
    async (mission: 'harvest' | 'minigame' | 'roulette', label: string) => {
      if (ritualBusy) return;
      setRitualBusy(true);
      try {
        const result = await devCompleteDailyRitualMissionGame(mission);
        applyRitualDevState(result.state, `「${label}」 미션을 완료 처리했어요. (테스트용)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : '미션 완료 처리에 실패했어요.';
        if (err instanceof ApiRequestError && err.state) {
          applyServerState(err.state, { trustServer: true });
        }
        showSceneDialogue(message);
      } finally {
        setRitualBusy(false);
      }
    },
    [applyRitualDevState, applyServerState, ritualBusy, showSceneDialogue],
  );

  const handleDevAdvanceDailyRitual = useCallback(
    async (step: 'reveal' | 'gift', label: string) => {
      if (ritualBusy) return;
      setRitualBusy(true);
      try {
        const result = await devAdvanceDailyRitualGame(step);
        applyRitualDevState(
          result.state,
          step === 'gift' ? '선물까지 열었어요. (테스트용)' : `「${label}」 완료. (테스트용)`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : '진행에 실패했어요.';
        if (err instanceof ApiRequestError && err.state) {
          applyServerState(err.state, { trustServer: true });
        }
        showSceneDialogue(message);
      } finally {
        setRitualBusy(false);
      }
    },
    [applyRitualDevState, applyServerState, ritualBusy, showSceneDialogue],
  );

  const handleDailyRitualFortuneNudgeClick = useCallback(async () => {
    await buttonSound();
    dismissCatFortuneGuide();
    ritualNudgeOpeningRef.current = true;
    await handleDailyRitualFortuneReveal();
  }, [buttonSound, dismissCatFortuneGuide, handleDailyRitualFortuneReveal]);

  const dailyFortuneNudgeText = useMemo(() => sceneDialogueForDailyRitualFortuneNudge(), []);

  const dailyRouletteNudgeText = useMemo(
    () =>
      pendingBonusRouletteSpin
        ? sceneDialogueForBonusRouletteNudge()
        : sceneDialogueForDailyRouletteNudge(),
    [pendingBonusRouletteSpin],
  );

  const handleDailyRouletteNudgeClick = useCallback(async () => {
    await buttonSound();
    rouletteNudgeOpeningRef.current = true;
    openDailyRouletteModal();
  }, [buttonSound, openDailyRouletteModal]);

  const handleCatPressStartWithRoulette = useCallback(() => {
    if (showDailyRouletteNudge) {
      void handleDailyRouletteNudgeClick();
      return;
    }
    if (showFortuneNudge) {
      void handleDailyRitualFortuneNudgeClick();
      return;
    }
    handleCatPressStart();
  }, [handleCatPressStart, handleDailyRitualFortuneNudgeClick, handleDailyRouletteNudgeClick, showDailyRouletteNudge, showFortuneNudge]);

  useEffect(() => {
    if (showDailyRoulette) return;
    setRouletteActionError(null);
    setRouletteRespinMode(false);
    rouletteRespinModeRef.current = false;
    rouletteResultBeforeRespinRef.current = null;
    setRouletteSpinGeneration(0);
    setRouletteSnapRevealKey(0);
  }, [showDailyRoulette]);

  useEffect(() => {
    if (!showDailyRoulette) {
      rouletteSyncedOnOpenRef.current = false;
      return;
    }

    clearActionError();
    setRouletteActionError(null);

    if (rouletteSyncedOnOpenRef.current) return;
    rouletteSyncedOnOpenRef.current = true;

    const today = getTodayKey();
    if (
      rouletteResult === null &&
      state.dailyLoginRouletteDayKey === today &&
      state.dailyLoginRouletteRewardCups > 0 &&
      !hasPendingBonusRouletteSpin(state)
    ) {
      setRouletteResult(state.dailyLoginRouletteRewardCups);
      setRouletteSnapRevealKey((key) => key + 1);
    }
  }, [
    clearActionError,
    showDailyRoulette,
    state.dailyLoginRouletteDayKey,
    state.dailyLoginRouletteRewardCups,
    state.ritualBonusRouletteSpins,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;

    window.resetGrowCoffeeDailyRoulette = () => {
      void resetDailyLoginRouletteForTest().then(() => {
        openDailyRouletteModal({ forceOpen: true });
      });
    };

    window.resetGrowCoffeeOnboarding = () => {
      resetOnboardingStorage();
      syncOnboardingUi();
      void resetDailyLoginRouletteForTest();
    };
  }, [openDailyRouletteModal, resetDailyLoginRouletteForTest, syncOnboardingUi]);

  const restoreRouletteResultBeforeRespin = useCallback(() => {
    if (rouletteResultBeforeRespinRef.current == null) return;
    setRouletteActionError(null);
    flushSync(() => {
      setRouletteResult(rouletteResultBeforeRespinRef.current);
      setRouletteSnapRevealKey((key) => key + 1);
    });
    setRouletteRespinMode(false);
    rouletteRespinModeRef.current = false;
    rouletteResultBeforeRespinRef.current = null;
  }, []);

  const handleDailyRouletteSpin = useCallback(async () => {
    const isRespin = rouletteRespinModeRef.current;

    if (isRespin && rouletteResultBeforeRespinRef.current == null) {
      setRouletteActionError('먼저 오늘의 룰렛을 돌려 주세요.');
      return;
    }

    setRouletteActionError(null);
    setRouletteSpinning(true);
    try {
      const adPlacement = isRespin ? 'daily-roulette-respin' : 'daily-roulette';
      const watched = await watchRewardedAd(adPlacement);
      if (!watched) {
        setRouletteActionError(
          isRespin
            ? '광고 시청을 완료해야 다시 돌릴 수 있어요.'
            : '광고 시청을 완료해야 룰렛을 돌릴 수 있어요.',
        );
        if (isRespin) {
          setRouletteRespinMode(false);
          rouletteRespinModeRef.current = false;
          rouletteResultBeforeRespinRef.current = null;
        }
        return;
      }

      const outcome = isRespin
        ? await respinDailyLoginRoulette()
        : await claimDailyLoginRoulette();

      if (outcome.rewardCups != null) {
        dismissCatRouletteGuide();
        if (isRespin) {
          setRouletteRespinMode(false);
          rouletteRespinModeRef.current = false;
          rouletteResultBeforeRespinRef.current = null;
        }
        rouletteSyncedOnOpenRef.current = true;
        flushSync(() => {
          setRouletteResult(null);
          setRouletteSpinGeneration((generation) => generation + 1);
          setRouletteResult(outcome.rewardCups);
        });
        play('win');
      } else if (outcome.errorMessage) {
        if (isRespin && rouletteResultBeforeRespinRef.current != null) {
          restoreRouletteResultBeforeRespin();
          setRouletteActionError(outcome.errorMessage);
        } else {
          setRouletteActionError(outcome.errorMessage);
        }
      }
    } finally {
      setRouletteSpinning(false);
    }
  }, [claimDailyLoginRoulette, dismissCatRouletteGuide, play, respinDailyLoginRoulette, restoreRouletteResultBeforeRespin]);

  const handleDailyRouletteRespinReset = useCallback(async () => {
    const today = getTodayKey();
    const effectiveResult =
      rouletteResult ??
      (state.dailyLoginRouletteDayKey === today && state.dailyLoginRouletteRewardCups > 0
        ? state.dailyLoginRouletteRewardCups
        : null);

    if (effectiveResult === null) {
      setRouletteActionError('먼저 오늘의 룰렛을 돌려 주세요.');
      return;
    }

    if (!canRespinDailyLoginRouletteToday(state.dailyLoginRouletteDayKey, state.dailyLoginRouletteRespinDayKey)) {
      setRouletteActionError('오늘 다시 돌리기는 이미 사용했어요.');
      return;
    }

    rouletteResultBeforeRespinRef.current = effectiveResult;
    setRouletteActionError(null);
    setRouletteRespinMode(true);
    rouletteRespinModeRef.current = true;
    await handleDailyRouletteSpin();
  }, [
    handleDailyRouletteSpin,
    rouletteResult,
    state.dailyLoginRouletteDayKey,
    state.dailyLoginRouletteRespinDayKey,
    state.dailyLoginRouletteRewardCups,
  ]);

  const rouletteCanRespin = useMemo(
    () => canRespinDailyLoginRouletteToday(state.dailyLoginRouletteDayKey, state.dailyLoginRouletteRespinDayKey),
    [state.dailyLoginRouletteDayKey, state.dailyLoginRouletteRespinDayKey],
  );

  const handleDailyRouletteReceive = useCallback(async () => {
    await buttonSound();
    dismissCatRouletteGuide();
    dismissDailyLoginRouletteForSession();
    setShowDailyRoulette(false);
    setRouletteResult(null);
    play('modalClose');
  }, [buttonSound, dismissCatRouletteGuide, play]);

  const handleDevRouletteSpinOnly = useCallback(async () => {
    if (!import.meta.env.DEV) return;

    await buttonSound();
    setShowDailyRoulette(true);
    setRouletteResult(null);
    setRouletteSpinning(false);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    setRouletteSpinning(true);
    const rewardCups = pickDailyLoginRouletteCups();
    flushSync(() => {
      setRouletteResult(null);
      setRouletteSpinGeneration((generation) => generation + 1);
      setRouletteResult(rewardCups);
    });
    setRouletteSpinning(false);
    play('win');
  }, [buttonSound, play]);

  const handleDailyRouletteClose = useCallback(async () => {
    await buttonSound();
    setRouletteActionError(null);

    if (rouletteRespinMode) {
      restoreRouletteResultBeforeRespin();
      return;
    }

    if (rouletteResult !== null) {
      dismissCatRouletteGuide();
      dismissDailyLoginRouletteForSession();
      setShowDailyRoulette(false);
      setRouletteResult(null);
      play('modalClose');
      return;
    }

    clearDailyLoginRouletteSessionDismiss();
    resetCatRouletteGuideForToday();
    setCatRouletteGuideSeen(false);
    setShowDailyRoulette(false);
    showSceneDialogue(dailyRouletteNudgeText, true);
    play('modalClose');
  }, [
    buttonSound,
    dailyRouletteNudgeText,
    dismissCatRouletteGuide,
    play,
    restoreRouletteResultBeforeRespin,
    rouletteRespinMode,
    rouletteResult,
    showSceneDialogue,
  ]);

  useGameAudio({
    state,
    growth: state.growth,
    isHolding,
    lastEarned,
    showOnboarding: onboardingBlocking,
  });

  useEffect(() => {
    if (onboardingBlocking) play('modalOpen');
  }, [onboardingBlocking, play]);

  useEffect(() => {
    initRewardedAds();
    initInterstitialAds();
  }, []);

  const finishWelcomeOnboarding = async () => {
    await buttonSound();
    markWelcomeOnboardingComplete();
    setShowWelcome(false);
    play('modalClose');
    if (!hasCompletedInteractiveTutorial()) {
      setTutorialActive(true);
      setTutorialStep('intro');
    } else {
      await unlock();
      await startAmbient();
    }
  };

  const startInteractiveTutorial = async () => {
    await buttonSound();
    tutorialWatersBaselineRef.current = state.totalWaters;
    tutorialCoffeesBaselineRef.current = state.totalCoffees;
    setTutorialStep('await-water');
  };

  const finishInteractiveTutorial = async () => {
    await buttonSound();
    markInteractiveTutorialComplete();
    setTutorialActive(false);
    setTutorialStep('intro');
    tutorialWatersBaselineRef.current = null;
    tutorialCoffeesBaselineRef.current = null;
    tutorialRefillingRef.current = false;
    play('modalClose');
    await unlock();
    await startAmbient();
  };

  useEffect(() => {
    if (!tutorialActive) return;

    if (tutorialStep === 'await-water' && isHolding) {
      setTutorialStep('water-sync');
      return;
    }

    if (tutorialStep === 'water-sync') {
      if (actionSyncing || isHolding) return;

      if (readyToDrink) {
        setTutorialStep('await-drink');
        return;
      }

      if (needsAd && !tutorialRefillingRef.current) {
        tutorialRefillingRef.current = true;
        void grantTutorialWaterRefill().finally(() => {
          tutorialRefillingRef.current = false;
          setTutorialStep('await-water');
        });
        return;
      }

      setTutorialStep('await-water');
      return;
    }

    if (tutorialStep === 'await-drink' && isDrinkCommitting) {
      setTutorialStep('drink-sync');
      return;
    }

    if (tutorialStep === 'drink-sync') {
      if (actionSyncing || isDrinkCommitting) return;

      const baseline = tutorialCoffeesBaselineRef.current;
      if (baseline !== null && state.totalCoffees > baseline && state.growth < 100) {
        setTutorialStep('complete');
      }
    }
  }, [
    actionSyncing,
    grantTutorialWaterRefill,
    isDrinkCommitting,
    isHolding,
    needsAd,
    readyToDrink,
    state.growth,
    state.totalCoffees,
    tutorialActive,
    tutorialStep,
  ]);

  const openSettings = useCallback(async () => {
    await buttonSound();
    play('modalOpen');
    setShowSettings(true);
  }, [buttonSound, play]);

  const closeSettings = useCallback(async () => {
    await buttonSound();
    play('modalClose');
    setShowSettings(false);
  }, [buttonSound, play]);

  const openShop = useCallback(async () => {
    await buttonSound();
    play('modalOpen');
    setShowShop(true);
  }, [buttonSound, play]);

  const closeShop = useCallback(async () => {
    await buttonSound();
    play('modalClose');
    setShowShop(false);
  }, [buttonSound, play]);

  const openMyCoffee = useCallback(async () => {
    await buttonSound();
    play('modalOpen');
    setShowMyCoffee(true);
  }, [buttonSound, play]);

  const closeMyCoffee = useCallback(async () => {
    await buttonSound();
    play('modalClose');
    setShowMyCoffee(false);
  }, [buttonSound, play]);

  const openRanking = useCallback(async () => {
    await buttonSound();
    play('modalOpen');
    setShowRanking(true);
    setRankingLoading(true);
    setRankingError(null);
    setRankingRewardStatus(null);
    setCoffeeRanking(
      getCoffeeRanking(getDailyRankingBrewedSpend(state), session?.displayName ?? MOCK_USER.name),
    );

    try {
      const [ranking, rewardStatus] = await Promise.all([
        syncCoffeeRanking({
          userId: session?.userId ?? '',
          spentCoffeeCups: getDailyRankingBrewedSpend(state),
          displayName: session?.displayName ?? MOCK_USER.name,
        }),
        session?.userId ? fetchRankingTop3PromotionStatus().catch(() => null) : Promise.resolve(null),
      ]);
      setCoffeeRanking(ranking);
      setRankingRewardStatus(rewardStatus);
      if (ranking.live) {
        updatePlayerRank(ranking.playerRank);
      } else if (session?.userId) {
        setRankingError('실시간 랭킹을 불러오지 못했어요 · 오프라인 미리보기');
      }
    } catch {
      setRankingError('랭킹을 불러오지 못했어요 · 오프라인 미리보기');
    } finally {
      setRankingLoading(false);
    }
  }, [buttonSound, play, session?.displayName, session?.userId, state, updatePlayerRank]);

  const closeRanking = useCallback(async () => {
    await buttonSound();
    play('modalClose');
    setShowRanking(false);
  }, [buttonSound, play]);

  const handleNavRank = useCallback(() => {
    void openRanking();
  }, [openRanking]);

  const handleClaimRankingTop3Reward = useCallback(async () => {
    if (rankingRewardClaiming) return;

    setRankingRewardClaiming(true);
    setRankingError(null);
    try {
      const result = await claimRankingTop3Promotion(session?.userId ?? '');

      if (!result.ok) {
        showSceneDialogue(result.message);
        return;
      }

      if (result.state) {
        applyServerState(result.state, { trustServer: true });
      }

      setRankingRewardStatus({
        rewardDayKey: result.rewardDayKey,
        playerRank: result.playerRank,
        eligible: true,
        claimed: true,
        canClaim: false,
      });
      setShowRankingRewardAlert(false);
      play('modalClose');
      showSceneDialogue(getRankingTop3ClaimSuccessMessage(result.mocked));
      if (!result.alreadyClaimed) {
        void scheduleReviewPrompt({
          trigger: 'daily-ranking-top3',
          onPrime: (copy) => showSceneDialogue(sceneDialogueForReviewPriming(copy)),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '랭킹 보상을 받을 수 없어요.';
      setRankingError(message);
      showSceneDialogue(message);
    } finally {
      setRankingRewardClaiming(false);
    }
  }, [applyServerState, play, rankingRewardClaiming, session?.userId, showSceneDialogue]);

  const dismissRankingRewardAlert = useCallback(async () => {
    await buttonSound();
    rankingRewardAlertDismissedRef.current = true;
    setShowRankingRewardAlert(false);
    play('modalClose');
  }, [buttonSound, play]);

  const openRankingFromRewardAlert = useCallback(async () => {
    rankingRewardAlertDismissedRef.current = true;
    setShowRankingRewardAlert(false);
    play('modalClose');
    await openRanking();
  }, [play]);

  const handleCoffeeValuePress = useCallback(async () => {
    await buttonSound();
    showSceneDialogue(`지금까지 지급받은 실제 커피값 수치는 ${formatWon(state.money)}이에요.`);
  }, [buttonSound, showSceneDialogue, state.money]);

  const handleDevFinalizeRanking = useCallback(async () => {
    if (!import.meta.env.DEV || !session?.userId) return;

    await buttonSound();
    try {
      const result = await devFinalizeRankingNow();
      setRankingRewardStatus(result.rewardStatus);
      rankingRewardAlertDismissedRef.current = false;

      if (result.rewardStatus.canClaim) {
        tryOpenRankingRewardAlert(result.rewardStatus);
      } else if (result.rewardStatus.claimed) {
        setShowRankingRewardAlert(false);
      }

      const rankLabel =
        result.rewardStatus.playerRank != null ? `${result.rewardStatus.playerRank}위` : '순위 없음';
      showSceneDialogue(
        `랭킹 즉시 확정! ${result.finalizedDayKey} 마감 · ${rankLabel} · ${result.entryCount}명 (테스트용)`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '랭킹 즉시 확정에 실패했어요.';
      showSceneDialogue(message);
    }
  }, [buttonSound, session?.userId, showSceneDialogue, tryOpenRankingRewardAlert]);

  const handleStartHold = useCallback(async () => {
    await unlock();
    startHold();
  }, [startHold, unlock]);

  const handleStopHold = useCallback(() => {
    if (isHolding && holdProgress < 100) play('waterCancel');
    stopHold();
  }, [holdProgress, isHolding, play, stopHold]);

  const handleReset = useCallback(async () => {
    await buttonSound();
    resetOnboardingStorage();
    syncOnboardingUi();
    await reset();
    if (import.meta.env.DEV) {
      await resetDailyLoginRouletteForTest();
    }
    setShowSettings(false);
  }, [buttonSound, reset, resetDailyLoginRouletteForTest, syncOnboardingUi]);

  const handleDrinkTap = useCallback(() => {
    completeDrink();
    void unlock().then(() => {
      play('slotRoll');
      return buttonSound();
    });
  }, [buttonSound, completeDrink, play, unlock]);

  const handleWatchAd = useCallback(() => {
    void watchAd();
    void unlock();
  }, [unlock, watchAd]);

  const openComicSeries = useCallback((seriesId: string) => {
    setComicTarget({ seriesId });
    setComicInlineEntry(true);
    setBonusView('comic');
  }, []);

  const openDailyGame = useCallback((gameId: DailyGameId) => {
    setBonusView(gameId);
  }, []);

  const closeBonusFeature = useCallback(() => {
    setBonusView(null);
    setComicTarget(null);
    setComicInlineEntry(false);
  }, []);

  const consumeComicTarget = useCallback(() => {
    setComicTarget(null);
  }, []);

  const handleSellBatch = useCallback(
    (cupCount: number) => {
      void sellBatch(cupCount);
      void unlock().then(() => buttonSound());
    },
    [buttonSound, sellBatch, unlock],
  );

  const handleClaimFinishBonus = useCallback(() => {
    void claimBrewedCoffeeFinishBonus();
    void unlock().then(() => buttonSound());
  }, [buttonSound, claimBrewedCoffeeFinishBonus, unlock]);

  const waterHint = useMemo(
    () =>
      formatWaterPanelHint({
        growth: state.growth,
        readyToDrink,
        growActionSlot,
        waterStatus,
      }),
    [
      growActionSlot,
      readyToDrink,
      state.growth,
      waterStatus.canWater,
      waterStatus.needsAd,
      waterStatus.watersToday,
      waterStatus.adWaterCredits,
    ],
  );

  const passiveCupStats = useMemo(
    () => getPassiveUiStats(state, balanceRules),
    [
      balanceRules,
      state.dailyPassiveGrowth,
      state.growth,
      state.growthAccrualSyncedAt,
      state.passiveCoffeesClaimed,
      state.passiveDayKey,
      state.passiveReactivateDayKey,
    ],
  );

  const passiveHint = useMemo(
    () => formatPassivePanelHint(passiveCupStats, balanceRules.passiveGrowthPerSecond),
    [balanceRules.passiveGrowthPerSecond, passiveCupStats],
  );

  const passiveCoffeePanelStats = useMemo(
    () => ({
      earned: passiveCupStats.cupsReceived,
      max: passiveCupStats.maxCups,
      remainder: passiveCupStats.remainder,
      cupFillPercent: passiveCupStats.cupFillPercent,
      complete: passiveCupStats.complete,
      canClaim: passiveCupStats.canClaim,
      canReactivate: passiveCupStats.canReactivate,
      reactivateUsedToday: passiveCupStats.reactivateUsedToday,
      timeRemainingLabel: formatPassiveTimeRemainingLabel(
        passiveCupStats,
        balanceRules.passiveGrowthPerSecond,
      ),
    }),
    [
      balanceRules.passiveGrowthPerSecond,
      passiveCupStats.canClaim,
      passiveCupStats.canReactivate,
      passiveCupStats.complete,
      passiveCupStats.cupFillPercent,
      passiveCupStats.cupsReceived,
      passiveCupStats.maxCups,
      passiveCupStats.reactivateUsedToday,
      passiveCupStats.remainder,
    ],
  );

  const handleClaimPassiveCoffee = useCallback(() => {
    void claimPassiveCoffee();
  }, [claimPassiveCoffee]);

  const handleReactivatePassiveCoffee = useCallback(() => {
    void reactivatePassiveCoffee();
  }, [reactivatePassiveCoffee]);

  const handleClaimAttendanceDaily = useCallback(() => {
    void claimAttendanceDaily();
  }, [claimAttendanceDaily]);

  const handleClaimAttendanceStreak = useCallback(() => {
    void claimAttendanceStreak();
  }, [claimAttendanceStreak]);

  const attendanceStats = useMemo(
    () => getAttendanceUiStats(state),
    [
      state.attendanceCupsToday,
      state.attendanceDailyClaimDayKey,
      state.attendanceDayKey,
      state.attendanceStreak,
      state.attendanceStreakBonusPending,
    ],
  );

  const treePanelGrowth = getRitualEffectiveGrowth(state, displayGrowth);
  const treeWatering = isHolding && (holdMode === 'water' || holdMode === 'brew');
  const drinkStage = useMemo(() => isDrinkStage(displayGrowth), [displayGrowth]);

  const tutorialPlantProps = useMemo(
    () =>
      tutorialActive
        ? {
            needsAd: false,
            showWatchAdButton: false,
            growActionSlot: readyToDrink || isDrinkCommitting ? ('drink' as const) : ('water' as const),
            canUseGrowHold: !readyToDrink && !isDrinkCommitting,
          }
        : {
            needsAd,
            showWatchAdButton,
            growActionSlot,
            canUseGrowHold,
          },
    [
      canUseGrowHold,
      growActionSlot,
      isDrinkCommitting,
      needsAd,
      readyToDrink,
      showWatchAdButton,
      tutorialActive,
    ],
  );

  return (
    <div className="game">
      <UserBar
        money={state.money}
        user={user}
        onOpenSettings={openSettings}
        onCoffeeValuePress={handleCoffeeValuePress}
      />

      {loading ? (
        <main className="game__main">
          <p className="game__status">불러오는 중...</p>
        </main>
      ) : error ? (
        <main className="game__main">
          <p className="game__status game__status--error">{error}</p>
        </main>
      ) : (
        <>
          <main className="game__main">
            {actionError && <p className="game__action-error">{actionError}</p>}
            {connectionWarning && (
              <p className="game__connection-warning" role="status">
                {connectionWarning}
              </p>
            )}
            <PlantScene
              growth={displayGrowth}
              plantGrowth={getRitualEffectiveGrowth(state, displayGrowth)}
              selectedCoffeeVariant={state.selectedCoffeeVariant}
              ownedCoffeeVariants={state.ownedCoffeeVariants}
              isWatering={isHolding}
              isReady={readyToDrink}
              tapBurst={tapBurst}
              disabled={actionSyncing && !isDrinkCommitting}
              readyToDrink={readyToDrink}
              drinkUiActive={drinkUiActive}
              isDrinkCommitting={isDrinkCommitting}
              suspendDrinkVideo={watchingAd || (actionSyncing && !isDrinkCommitting)}
              needsAd={tutorialPlantProps.needsAd}
              showWatchAdButton={tutorialPlantProps.showWatchAdButton}
              growActionSlot={tutorialPlantProps.growActionSlot}
              canUseGrowHold={tutorialPlantProps.canUseGrowHold}
              canWater={waterStatus.canWater}
              watchingAd={watchingAd}
              watchAdDisabled={watchingAd}
              holdMode={holdMode}
              isHolding={isHolding}
              holdProgress={holdProgress}
              holdElapsedSec={holdElapsedSec}
              holdTargetSec={holdTargetSec}
              holdRemainingSec={holdRemainingSec}
              onPointerDown={handleStartHold}
              onPointerUp={handleStopHold}
              onDrinkTap={handleDrinkTap}
              onWatchAd={handleWatchAd}
              onCatPressStart={handleCatPressStartWithRoulette}
              onCatPressEnd={handleCatPressEndWithRoulette}
              onOpenComicSeries={openComicSeries}
              onOpenDailyGame={openDailyGame}
              onOpenShop={openShop}
              fortuneNudgeVisible={showFortuneNudge && !showDailyRoulette}
              fortuneNudgeText={dailyFortuneNudgeText}
              onFortuneNudgeClick={handleDailyRitualFortuneNudgeClick}
              rouletteNudgeVisible={showDailyRouletteNudge && !showDailyRoulette}
              rouletteNudgeText={dailyRouletteNudgeText}
              onRouletteNudgeClick={handleDailyRouletteNudgeClick}
              ritualGiftVisible={showRitualGiftBox}
              ritualGiftDisabled={ritualBusy}
              onRitualGiftOpen={handleDailyRitualGiftOpen}
              sceneDialogue={sceneDialogue}
              harvestReward={harvestReward}
              money={state.money}
              onCoffeeValuePress={handleCoffeeValuePress}
              slotBelowShop={
                <DailyMissionPanel
                  visible={showMissionPanel}
                  variant="dock"
                  missions={ritualMissions}
                  rewardCups={10}
                  canClaim={canClaimLocalMissionReward(state)}
                  claimed={Boolean(state.ritualMissionClaimed)}
                  disabled={ritualBusy}
                  onClaim={handleClaimRitualMissionReward}
                  onClaimFortune={handleClaimRitualFortuneReward}
                  canClaimFortune={canClaimFortuneHarvestBonus}
                  fortuneProgress={state.ritualFortuneProgress}
                  fortuneGoal={2}
                  fortuneRewardCups={3}
                />
              }
            />

            {drinkStage && (
              <RecommendButtons
                placement="below"
                onOpenComicSeries={openComicSeries}
                onOpenDailyGame={openDailyGame}
                onOpenShop={openShop}
              />
            )}

            <GrowthPanel
              growth={treePanelGrowth}
              totalCoffees={state.totalCoffees}
              emptiedCoffeeCups={state.spentCoffeeCups}
              passiveCoffee={passiveCoffeePanelStats}
              onClaimPassiveCoffee={handleClaimPassiveCoffee}
              onReactivatePassiveCoffee={handleReactivatePassiveCoffee}
              claimingPassiveCoffee={claimingPassiveCoffee}
              reactivatingPassiveCoffee={reactivatingPassiveCoffee}
              claimSyncBlocked={false}
              reactivateSyncBlocked={actionSyncing && !reactivatingPassiveCoffee}
              passiveClaimFeedback={passiveClaimFeedback}
              waterHint={waterHint}
              passiveHint={passiveHint}
              isWatering={treeWatering}
              isPassivelyAccruing={
                passiveActive && !passiveCupStats.canClaim && !passiveCupStats.complete
              }
              ritualGiftLabel={openedRitualGiftLabel}
              ritualGiftDescription={openedRitualGiftDescription}
              treeStageGrowth={treePanelGrowth}
              sellBatchLabel="내린 커피 마시기"
              onSellBatch={handleSellBatch}
              onClaimFinishBonus={handleClaimFinishBonus}
              claimingFinishBonus={claimingFinishBonus}
              sellDisabled={dailyPointCapReached || sellingBatch || isHolding || actionSyncing}
              sellPending={sellingBatch}
              attendance={attendanceStats}
              onClaimAttendanceDaily={handleClaimAttendanceDaily}
              onClaimAttendanceStreak={handleClaimAttendanceStreak}
              claimingAttendanceDaily={claimingAttendanceDaily}
              claimingAttendanceStreak={claimingAttendanceStreak}
            />

            {RELEASE_TEST_TOOLS_ENABLED && (
              <div className="game__release-test-row">
                <button
                  type="button"
                  className="game__release-test-btn"
                  disabled={isHolding || loading || actionSyncing}
                  onClick={() => void releaseTestAddSpentCoffeeCups(RELEASE_TEST_ADD_DRUNK_COFFEES)}
                >
                  마신 커피 +{RELEASE_TEST_ADD_DRUNK_COFFEES.toLocaleString('ko-KR')}잔
                </button>
                <button
                  type="button"
                  className="game__release-test-btn"
                  disabled={isHolding || loading || actionSyncing}
                  onClick={() => void releaseTestAddBrewedCoffees(RELEASE_TEST_ADD_BREWED_COFFEES)}
                >
                  내린 커피 +{RELEASE_TEST_ADD_BREWED_COFFEES.toLocaleString('ko-KR')}잔
                </button>
              </div>
            )}

            {isReviewPreviewEnabled() && (
              <>
                {import.meta.env.DEV && (
                  <div className="game__test-row">
                  <button
                    type="button"
                    className="game__test-btn"
                    disabled={isHolding || loading || actionSyncing}
                    onClick={() => testBumpGrowth()}
                  >
                    테스트 +25%
                  </button>
                  <button
                    type="button"
                    className="game__test-btn"
                    disabled={isHolding || loading || actionSyncing}
                    onClick={() => void testBumpPassiveGrowth()}
                  >
                    방치 +100%
                  </button>
                  <button
                    type="button"
                    className="game__test-btn"
                    disabled={isHolding || loading || actionSyncing}
                    onClick={() => void testSetTotalCoffees(1000)}
                  >
                    내린 커피 1000잔
                  </button>
                  <button
                    type="button"
                    className="game__test-btn"
                    disabled={rouletteSpinning}
                    onClick={() => void handleDevRouletteSpinOnly()}
                  >
                    룰렛만 돌리기
                  </button>
                  {import.meta.env.DEV && (
                    <button
                      type="button"
                      className="game__test-btn"
                      disabled={loading || actionSyncing || !session?.userId}
                      onClick={() => void handleDevFinalizeRanking()}
                    >
                      랭킹 즉시 매기기
                    </button>
                  )}
                  {isRankingTop3PromotionMockEnabled() && (
                    <button
                      type="button"
                      className="game__test-btn"
                      disabled={loading || actionSyncing || !session?.userId}
                      onClick={() => {
                        void resetRankingTop3PromotionForTest(session?.userId ?? '').then(() => {
                          setRankingRewardStatus(null);
                          showSceneDialogue('어제 랭킹 보상 지급 기록을 초기화했어요. (테스트용)');
                        });
                      }}
                    >
                      랭킹 보상 지급 초기화
                    </button>
                  )}
                </div>
                )}

                <section className="game__test-review game__test-review--ritual" aria-label="오늘의 커피 운세 테스트">
                  <p className="game__test-review-title">오늘의 커피 운세 테스트</p>
                  {ritualDevStatus && (
                    <p className="game__test-review-status" role="status">
                      {ritualDevStatus}
                    </p>
                  )}
                  <div className="game__test-row game__test-row--review">
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => void handleDevResetDailyRitual()}
                    >
                      운세 초기화
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => void handleDailyRitualFortuneReveal()}
                    >
                      운세 확인
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => void handleDailyRitualGiftOpen()}
                    >
                      선물 열기
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => void handleDevAdvanceDailyRitual('reveal', '운세 확인')}
                    >
                      운세 건너뛰기
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => void handleDevAdvanceDailyRitual('gift', '선물 열기')}
                    >
                      선물까지 건너뛰기
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => void handleDevCompleteDailyRitualMission('harvest', '수확 2번')}
                    >
                      수확 미션 완료
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => void handleDevCompleteDailyRitualMission('minigame', '미니게임')}
                    >
                      미니게임 미션
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => void handleDevCompleteDailyRitualMission('roulette', '룰렛')}
                    >
                      룰렛 미션
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy || !canClaimFortuneHarvestBonus}
                      onClick={() => void handleClaimRitualFortuneReward()}
                    >
                      수확 보너스 받기
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy || !canClaimLocalMissionReward(state)}
                      onClick={() => void handleClaimRitualMissionReward()}
                    >
                      미션 10잔 받기
                    </button>
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--ritual"
                      disabled={loading || actionSyncing || ritualBusy}
                      onClick={() => {
                        void resetDailyLoginRouletteForTest().then(() => {
                          showSceneDialogue('룰렛 수령 상태를 초기화했어요. (테스트용)');
                        });
                      }}
                    >
                      룰렛 초기화
                    </button>
                  </div>
                  <div className="game__test-row game__test-row--review">
                    {RITUAL_GIFT_TEST_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="game__test-btn game__test-btn--ritual-fortune"
                        disabled={loading || actionSyncing || ritualBusy}
                        onClick={() => void handleDevSetDailyRitualFortune(option.id, option.label)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="game__test-review" aria-label="리뷰 유도 미리보기">
                  <p className="game__test-review-title">리뷰 미리보기</p>
                  {reviewPreviewStatus && (
                    <p className="game__test-review-status" role="status">
                      {reviewPreviewStatus}
                    </p>
                  )}
                  <div className="game__test-row game__test-row--review">
                    {REVIEW_TRIGGERS.map((trigger) => (
                      <button
                        key={trigger}
                        type="button"
                        className="game__test-btn game__test-btn--review"
                        disabled={loading || actionSyncing}
                        onClick={() => previewReviewTest(trigger)}
                      >
                        {REVIEW_TRIGGER_LABELS[trigger]}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="game__test-btn game__test-btn--review-reset"
                      disabled={loading || actionSyncing}
                      onClick={() => resetReviewTestStore()}
                    >
                      기록 초기화
                    </button>
                  </div>
                </section>
              </>
            )}

            <GameFlowFooter
              onShareReward={claimShareReward}
              sharingReward={sharingReward}
              shareRewardAvailable={shareRewardAvailable}
              disabled={loading || actionSyncing}
            />
          </main>
        </>
      )}

      <div className="game__text-banner" aria-label="텍스트 배너">
        <AdBannerSlot variant="list" bannerShape="expanded" />
      </div>

      <BottomNav
        onRank={handleNavRank}
        onShop={openShop}
        onMyCoffee={openMyCoffee}
        onSettings={openSettings}
      />

      {showRanking && (
        <RankingSheet
          ranking={coffeeRanking}
          loading={rankingLoading}
          error={rankingError}
          rewardStatus={rankingRewardStatus}
          claimingReward={rankingRewardClaiming}
          onClaimTop3Reward={handleClaimRankingTop3Reward}
          onClose={() => void closeRanking()}
        />
      )}

      {showMyCoffee && (
        <MyCoffeeSheet
          ownedCoffeeVariants={state.ownedCoffeeVariants}
          selectedCoffeeVariant={state.selectedCoffeeVariant}
          busy={actionSyncing}
          onSelect={(slug) => void selectVariant(slug)}
          onClose={() => void closeMyCoffee()}
        />
      )}

      {showShop && (
        <CharacterShopSheet
          spentCoffeeCups={state.spentCoffeeCups}
          ownedCoffeeVariants={state.ownedCoffeeVariants}
          selectedCoffeeVariant={state.selectedCoffeeVariant}
          busy={actionSyncing}
          onPurchase={(slug) => void purchaseVariant(slug)}
          onSelect={(slug) => void selectVariant(slug)}
          onClose={() => void closeShop()}
        />
      )}

      {showWelcome && <OnboardingModal onClose={() => void finishWelcomeOnboarding()} />}
      {showDailyRoulette && (
        <DailyLoginRouletteModal
          resultCups={rouletteResult}
          spinning={rouletteSpinning}
          spinGeneration={rouletteSpinGeneration}
          snapRevealKey={rouletteSnapRevealKey}
          canRespin={rouletteCanRespin}
          actionError={rouletteActionError}
          onClose={() => void handleDailyRouletteClose()}
          onReceive={() => void handleDailyRouletteReceive()}
          onRespin={handleDailyRouletteRespinReset}
          onSpin={() => void handleDailyRouletteSpin()}
        />
      )}
      {showRankingRewardAlert && rankingRewardStatus?.canClaim && (
        <RankingRewardAlertModal
          status={rankingRewardStatus}
          claiming={rankingRewardClaiming}
          onClaim={() => void handleClaimRankingTop3Reward()}
          onOpenRanking={() => void openRankingFromRewardAlert()}
          onDismiss={() => void dismissRankingRewardAlert()}
        />
      )}
      {tutorialActive && !showWelcome && (
        <InteractiveTutorialOverlay
          step={tutorialStep}
          onStart={() => void startInteractiveTutorial()}
          onComplete={() => void finishInteractiveTutorial()}
        />
      )}
      {showSettings && (
        <SettingsSheet
          user={user}
          totalWaters={state.totalWaters}
          totalCoffees={state.totalCoffees}
          loggingIn={loggingIn}
          authMessage={authMessage}
          isTossInApp={isTossInApp}
          onLoginWithToss={loginWithToss}
          onLogout={logout}
          onReset={handleReset}
          onClose={closeSettings}
        />
      )}

      {bonusView !== null && (
        <Suspense fallback={null}>
          <BonusFeatureHost
            farmerName={session?.displayName ?? MOCK_USER.name}
            view={bonusView}
            comicInitialTarget={comicTarget}
            comicInlineEntry={comicInlineEntry}
            onConsumeComicTarget={consumeComicTarget}
            onClose={closeBonusFeature}
            onGrantMinigameReward={claimMinigameReward}
          />
        </Suspense>
      )}
    </div>
  );
}
