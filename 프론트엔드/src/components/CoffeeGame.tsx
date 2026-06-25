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
import { getAttendanceUiStats, getTodayKey } from '../game/attendance';
import { formatPassivePanelHint, getPassiveUiStats } from '../game/passiveGrowth';
import { formatWaterPanelHint } from '../game/waterQuota';
import { randomCatNudgeDialogue } from '../game/sceneDialogue';
import { useCoffeeGame } from '../game/useCoffeeGame';
import { REVIEW_TRIGGER_LABELS, REVIEW_TRIGGERS, isReviewPreviewEnabled } from '../services/reviewPrompt';
import { initInterstitialAds } from '../services/interstitialAd';
import { initRewardedAds } from '../services/rewardedAd';
import { isDrinkStage } from '../game/utils';
import type { AuthUser } from '../hooks/useAuth';
import type { DailyGameId } from '../services/dailyGamePick';
import type { BonusFeatureView } from '../features/goldcat/BonusFeatureHost';
import type { ComicInitialTarget } from '../features/goldcat/StoryComicScreen';
import { getCoffeeRanking, syncCoffeeRanking, type CoffeeRankingView } from '../services/coffeeRanking';
import { getRankingBrewedSpend } from '../game/rankingScore';
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
import { RankingSheet } from './RankingSheet';
import { RecommendButtons } from './RecommendButtons';
import { SettingsSheet } from './SettingsSheet';
import { UserBar } from './UserBar';
import { DailyLoginRouletteModal } from './DailyLoginRouletteModal';
import { canClaimDailyLoginRouletteToday, canRespinDailyLoginRouletteToday, pickDailyLoginRouletteCups } from '../game/dailyLoginRoulette';
import {
  dismissDailyLoginRouletteForSession,
  hasSeenDailyLoginRouletteLocal,
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
    purchaseVariant,
    selectVariant,
    reset,
    watchAd,
    grantTutorialWaterRefill,
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
    loggingIn,
    authMessage,
    loginWithToss,
    logout,
    isTossInApp,
    sceneDialogue,
    showSceneDialogue,
    updatePlayerRank,
    dailyPointCapReached,
    previewReviewTest,
    resetReviewTestStore,
    reviewPreviewStatus,
  } = useCoffeeGame({ tutorialBypassQuota: tutorialActive });

  const [showSettings, setShowSettings] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showMyCoffee, setShowMyCoffee] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [coffeeRanking, setCoffeeRanking] = useState<CoffeeRankingView | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [bonusView, setBonusView] = useState<BonusFeatureView>(null);
  const [comicTarget, setComicTarget] = useState<ComicInitialTarget | null>(null);
  const [comicInlineEntry, setComicInlineEntry] = useState(false);
  const [showDailyRoulette, setShowDailyRoulette] = useState(false);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<number | null>(null);
  const [rouletteSpinGeneration, setRouletteSpinGeneration] = useState(0);
  const [rouletteSnapRevealKey, setRouletteSnapRevealKey] = useState(0);
  const [rouletteActionError, setRouletteActionError] = useState<string | null>(null);
  const pendingRouletteAfterOnboardingRef = useRef(false);
  const rouletteSyncedOnOpenRef = useRef(false);
  const rouletteResultBeforeRespinRef = useRef<number | null>(null);
  const rouletteRespinModeRef = useRef(false);
  const [rouletteRespinMode, setRouletteRespinMode] = useState(false);

  useEffect(() => {
    rouletteRespinModeRef.current = rouletteRespinMode;
  }, [rouletteRespinMode]);
  const { play, unlock, startAmbient } = useSound();
  const buttonSound = useButtonSound();
  const user = toAuthUser(session);
  const catDialogueCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const catDialogueRawRef = useRef<string | null>(null);

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

  useEffect(() => () => stopCatDialogueCycle(), [stopCatDialogueCycle]);

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

  const openDailyRouletteIfEligible = useCallback((options?: { afterOnboarding?: boolean; forceOpen?: boolean }) => {
    if (loading) return false;

    const onboarding = getOnboardingUiState();
    if (!options?.forceOpen && (onboarding.showWelcome || onboarding.tutorialActive)) return false;

    const forcePreview =
      import.meta.env.DEV && new URLSearchParams(window.location.search).get('roulette') === '1';

    if (forcePreview) {
      setShowDailyRoulette(true);
      return true;
    }

    if (hasSeenDailyLoginRouletteLocal()) return false;
    if (!canClaimDailyLoginRouletteToday(state.dailyLoginRouletteDayKey)) {
      if (import.meta.env.DEV && options?.afterOnboarding) {
        console.warn('[daily-roulette] post-onboarding blocked: server already claimed today');
      }
      return false;
    }
    syncDailyLoginRouletteLocalWithServer(state.dailyLoginRouletteDayKey);
    if (isDailyLoginRouletteDismissedForSession()) return false;

    setRouletteActionError(null);
    markDailyLoginRouletteShownLocal();
    setShowDailyRoulette(true);
    return true;
  }, [loading, state.dailyLoginRouletteDayKey]);

  const requestDailyRouletteAfterOnboarding = useCallback(() => {
    pendingRouletteAfterOnboardingRef.current = true;
  }, []);

  useEffect(() => {
    if (loading) return;

    const onboarding = getOnboardingUiState();
    if (onboarding.showWelcome || onboarding.tutorialActive) return;

    if (pendingRouletteAfterOnboardingRef.current) {
      const opened = openDailyRouletteIfEligible({ afterOnboarding: true });
      if (opened || hasSeenDailyLoginRouletteLocal()) {
        pendingRouletteAfterOnboardingRef.current = false;
      }
      return;
    }

    openDailyRouletteIfEligible();
  }, [loading, openDailyRouletteIfEligible, showWelcome, state.dailyLoginRouletteDayKey, tutorialActive]);

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
      state.dailyLoginRouletteRewardCups > 0
    ) {
      setRouletteResult(state.dailyLoginRouletteRewardCups);
      setRouletteSnapRevealKey((key) => key + 1);
    }
  }, [
    clearActionError,
    showDailyRoulette,
    state.dailyLoginRouletteDayKey,
    state.dailyLoginRouletteRewardCups,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;

    window.resetGrowCoffeeDailyRoulette = () => {
      void resetDailyLoginRouletteForTest().then(() => {
        openDailyRouletteIfEligible({ forceOpen: true });
      });
    };

    window.resetGrowCoffeeOnboarding = () => {
      resetOnboardingStorage();
      syncOnboardingUi();
      void resetDailyLoginRouletteForTest().then(() => {
        requestDailyRouletteAfterOnboarding();
      });
    };
  }, [openDailyRouletteIfEligible, requestDailyRouletteAfterOnboarding, resetDailyLoginRouletteForTest, syncOnboardingUi]);

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
  }, [claimDailyLoginRoulette, play, respinDailyLoginRoulette, restoreRouletteResultBeforeRespin]);

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
    dismissDailyLoginRouletteForSession();
    setShowDailyRoulette(false);
    setRouletteResult(null);
    play('modalClose');
  }, [buttonSound, play]);

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
      dismissDailyLoginRouletteForSession();
      setShowDailyRoulette(false);
      setRouletteResult(null);
      play('modalClose');
      return;
    }

    dismissDailyLoginRouletteForSession();
    setShowDailyRoulette(false);
    play('modalClose');
  }, [buttonSound, play, restoreRouletteResultBeforeRespin, rouletteRespinMode, rouletteResult]);

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
      requestDailyRouletteAfterOnboarding();
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
    requestDailyRouletteAfterOnboarding();
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

  const openSettings = async () => {
    await buttonSound();
    play('modalOpen');
    setShowSettings(true);
  };

  const closeSettings = async () => {
    await buttonSound();
    play('modalClose');
    setShowSettings(false);
  };

  const openShop = async () => {
    await buttonSound();
    play('modalOpen');
    setShowShop(true);
  };

  const closeShop = async () => {
    await buttonSound();
    play('modalClose');
    setShowShop(false);
  };

  const openMyCoffee = async () => {
    await buttonSound();
    play('modalOpen');
    setShowMyCoffee(true);
  };

  const closeMyCoffee = async () => {
    await buttonSound();
    play('modalClose');
    setShowMyCoffee(false);
  };

  const openRanking = async () => {
    await buttonSound();
    play('modalOpen');
    setShowRanking(true);
    setRankingLoading(true);
    setRankingError(null);
    setCoffeeRanking(
      getCoffeeRanking(getRankingBrewedSpend(state), session?.displayName ?? MOCK_USER.name),
    );

    try {
      const ranking = await syncCoffeeRanking({
        userId: session?.userId ?? '',
        spentCoffeeCups: getRankingBrewedSpend(state),
        displayName: session?.displayName ?? MOCK_USER.name,
      });
      setCoffeeRanking(ranking);
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
  };

  const closeRanking = async () => {
    await buttonSound();
    play('modalClose');
    setShowRanking(false);
  };

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
    requestDailyRouletteAfterOnboarding();
    await reset();
    if (import.meta.env.DEV) {
      await resetDailyLoginRouletteForTest();
    }
    setShowSettings(false);
  }, [buttonSound, requestDailyRouletteAfterOnboarding, reset, resetDailyLoginRouletteForTest, syncOnboardingUi]);

  const handleDrinkTap = useCallback(() => {
    completeDrink();
    void unlock().then(() => buttonSound());
  }, [buttonSound, completeDrink, unlock]);

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

  const waterHint = useMemo(
    () =>
      formatWaterPanelHint({
        growth: state.growth,
        readyToDrink,
        growActionSlot,
        waterStatus,
      }),
    [growActionSlot, readyToDrink, state.growth, waterStatus],
  );

  const passiveCupStats = useMemo(
    () => getPassiveUiStats(state, balanceRules),
    [state, balanceRules],
  );

  const passiveHint = useMemo(
    () => formatPassivePanelHint(passiveCupStats, balanceRules.passiveGrowthPerSecond),
    [balanceRules.passiveGrowthPerSecond, passiveCupStats],
  );

  const attendanceStats = useMemo(() => getAttendanceUiStats(state), [state]);

  const drinkStage = useMemo(
    () => isDrinkStage(isHolding ? state.growth : displayGrowth),
    [displayGrowth, isHolding, state.growth],
  );

  const tutorialPlantProps = tutorialActive
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
      };

  return (
    <div className="game">
      <UserBar money={state.money} user={user} onOpenSettings={openSettings} />

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
              plantGrowth={isHolding ? state.growth : displayGrowth}
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
              onCatPressStart={handleCatPressStart}
              onCatPressEnd={handleCatPressEnd}
              onOpenComicSeries={openComicSeries}
              onOpenDailyGame={openDailyGame}
              onOpenShop={openShop}
              sceneDialogue={sceneDialogue}
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
              growth={
                isHolding && (holdMode === 'water' || holdMode === 'brew')
                  ? displayGrowth
                  : state.growth
              }
              percentGrowth={state.growth}
              totalCoffees={state.totalCoffees}
              emptiedCoffeeCups={state.spentCoffeeCups}
              passiveCoffee={{
                earned: passiveCupStats.cupsReceived,
                max: passiveCupStats.maxCups,
                remainder: passiveCupStats.remainder,
                cupFillPercent: passiveCupStats.cupFillPercent,
                complete: passiveCupStats.complete,
                canClaim: passiveCupStats.canClaim,
                canReactivate: passiveCupStats.canReactivate,
                reactivateUsedToday: passiveCupStats.reactivateUsedToday,
              }}
              onClaimPassiveCoffee={() => void claimPassiveCoffee()}
              onReactivatePassiveCoffee={() => void reactivatePassiveCoffee()}
              claimingPassiveCoffee={claimingPassiveCoffee}
              reactivatingPassiveCoffee={reactivatingPassiveCoffee}
              claimSyncBlocked={false}
              reactivateSyncBlocked={actionSyncing && !reactivatingPassiveCoffee}
              passiveClaimFeedback={passiveClaimFeedback}
              waterHint={waterHint}
              passiveHint={passiveHint}
              isWatering={isHolding && (holdMode === 'water' || holdMode === 'brew')}
              isPassivelyAccruing={
                passiveActive && !passiveCupStats.canClaim && !passiveCupStats.complete
              }
              sellBatchLabel="내린 커피 마시기"
              onSellBatch={(cupCount) => void handleSellBatch(cupCount)}
              sellDisabled={dailyPointCapReached || sellingBatch || isHolding || actionSyncing}
              sellPending={sellingBatch}
              attendance={attendanceStats}
              onClaimAttendanceDaily={() => void claimAttendanceDaily()}
              onClaimAttendanceStreak={() => void claimAttendanceStreak()}
              claimingAttendanceDaily={claimingAttendanceDaily}
              claimingAttendanceStreak={claimingAttendanceStreak}
            />

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
                </div>
                )}

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
        onRank={() => void openRanking()}
        onShop={openShop}
        onMyCoffee={openMyCoffee}
        onSettings={openSettings}
      />

      {showRanking && (
        <RankingSheet
          ranking={coffeeRanking}
          loading={rankingLoading}
          error={rankingError}
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
