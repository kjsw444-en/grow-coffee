import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameAudio } from '../audio/useGameAudio';
import { useButtonSound, useSound } from '../audio/SoundProvider';
import { ONBOARDING_KEY, MOCK_USER } from '../game/mockData';
import { formatPassivePanelHint, getPassiveUiStats } from '../game/passiveGrowth';
import { GOAL_AMOUNT, SELL_BATCH_REWARD, SELL_BATCH_SIZE } from '../game/constants';
import { formatWaterPanelHint } from '../game/waterQuota';
import { randomCatNudgeDialogue } from '../game/sceneDialogue';
import { useCoffeeGame } from '../game/useCoffeeGame';
import { initInterstitialAds } from '../services/interstitialAd';
import { initRewardedAds } from '../services/rewardedAd';
import { formatWon, isDrinkStage } from '../game/utils';
import type { AuthUser } from '../hooks/useAuth';
import type { DailyGameId } from '../services/dailyGamePick';
import type { BonusFeatureView } from '../features/goldcat/BonusFeatureHost';
import type { ComicInitialTarget } from '../features/goldcat/StoryComicScreen';
import { getCoffeeRanking, syncCoffeeRanking, type CoffeeRankingView } from '../services/coffeeRanking';
import { AdBannerSlot } from './AdBannerSlot';
import { BottomNav } from './BottomNav';
import { CharacterShopSheet } from './CharacterShopSheet';
import { MyCoffeeSheet } from './MyCoffeeSheet';
import { GameFlowFooter } from './GameFlowFooter';
import { GrowthPanel } from './GrowthPanel';
import { OnboardingModal } from './OnboardingModal';
import { PlantScene } from './PlantScene';
import { RankingSheet } from './RankingSheet';
import { RecommendButtons } from './RecommendButtons';
import { SettingsSheet } from './SettingsSheet';
import { UserBar } from './UserBar';
import './CoffeeGame.css';

const BonusFeatureHost = lazy(() =>
  import('../features/goldcat/BonusFeatureHost').then((module) => ({
    default: module.BonusFeatureHost,
  })),
);

function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

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
  const {
    session,
    state,
    balanceRules,
    connectionWarning,
    loading,
    error,
    actionError,
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
    canSellBatch,
    displayGrowth,
    passiveActive,
    passiveClock,
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
  } = useCoffeeGame();

  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
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

  useGameAudio({
    state,
    growth: state.growth,
    isHolding,
    lastEarned,
    showOnboarding,
  });

  useEffect(() => {
    if (showOnboarding) play('modalOpen');
  }, [showOnboarding, play]);

  useEffect(() => {
    initRewardedAds();
    initInterstitialAds();
  }, []);

  const closeOnboarding = async () => {
    await buttonSound();
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
    play('modalClose');
    await unlock();
    await startAmbient();
  };

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
      getCoffeeRanking(state.spentCoffeeCups, session?.displayName ?? MOCK_USER.name),
    );

    try {
      const ranking = await syncCoffeeRanking({
        userId: session?.userId ?? '',
        spentCoffeeCups: state.spentCoffeeCups,
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
    reset();
    setShowSettings(false);
  }, [buttonSound, reset]);

  const handleDrinkTap = useCallback(() => {
    completeDrink();
    void unlock().then(() => buttonSound());
  }, [buttonSound, completeDrink, unlock]);

  const handleWatchAd = useCallback(() => {
    void watchAd();
    void unlock();
  }, [unlock, watchAd]);

  const handleWinReset = useCallback(async () => {
    await buttonSound();
    reset();
  }, [buttonSound, reset]);

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

  const handleSellBatch = useCallback(() => {
    void sellBatch();
    void unlock().then(() => buttonSound());
  }, [buttonSound, sellBatch, unlock]);

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

  const drinkStage = useMemo(
    () => isDrinkStage(isHolding ? state.growth : displayGrowth),
    [displayGrowth, isHolding, state.growth],
  );

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
      ) : state.redeemed ? (
        <main className="game__main">
          <section className="game__win">
            <div className="game__win-emoji" aria-hidden="true">
              🎉☕
            </div>
            <h2>축하해요!</h2>
            <p>
              {formatWon(GOAL_AMOUNT)}을 모았어요.
              <br />
              토스 포인트로 아메리카노 한 잔!
            </p>
            <button type="button" className="game__win-btn" onClick={handleWinReset}>
              다시 키우기
            </button>
          </section>
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
              disabled={state.redeemed || (actionSyncing && !isDrinkCommitting)}
              readyToDrink={readyToDrink}
              drinkUiActive={drinkUiActive}
              isDrinkCommitting={isDrinkCommitting}
              needsAd={needsAd}
              showWatchAdButton={showWatchAdButton}
              growActionSlot={growActionSlot}
              canUseGrowHold={canUseGrowHold}
              canWater={waterStatus.canWater}
              watchingAd={watchingAd}
              watchAdDisabled={state.redeemed || watchingAd}
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
              canSellBatch={canSellBatch}
              sellBatchLabel={`${SELL_BATCH_SIZE}잔 판매 (+${formatWon(SELL_BATCH_REWARD)})`}
              onSellBatch={() => void handleSellBatch()}
              sellDisabled={sellingBatch || isHolding || actionSyncing}
              sellPending={sellingBatch}
            />

            {import.meta.env.DEV && (
              <div className="game__test-row">
                <button
                  type="button"
                  className="game__test-btn"
                  disabled={state.redeemed || isHolding || loading || actionSyncing}
                  onClick={() => testBumpGrowth()}
                >
                  테스트 +25%
                </button>
                <button
                  type="button"
                  className="game__test-btn"
                  disabled={state.redeemed || isHolding || loading || actionSyncing}
                  onClick={() => void testBumpPassiveGrowth()}
                >
                  방치 +100%
                </button>
              </div>
            )}

            <GameFlowFooter
              onShareReward={claimShareReward}
              sharingReward={sharingReward}
              shareRewardAvailable={shareRewardAvailable}
              disabled={state.redeemed || loading || actionSyncing}
            />
          </main>
        </>
      )}

      {!state.redeemed && (
        <div className="game__text-banner" aria-label="텍스트 배너">
          <AdBannerSlot variant="list" bannerShape="expanded" />
        </div>
      )}

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
          totalCoffees={state.totalCoffees}
          ownedCoffeeVariants={state.ownedCoffeeVariants}
          selectedCoffeeVariant={state.selectedCoffeeVariant}
          busy={actionSyncing}
          onPurchase={(slug) => void purchaseVariant(slug)}
          onSelect={(slug) => void selectVariant(slug)}
          onClose={() => void closeShop()}
        />
      )}

      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
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
          />
        </Suspense>
      )}
    </div>
  );
}
