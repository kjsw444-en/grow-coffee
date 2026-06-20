import { useEffect, useState } from 'react';
import { useGameAudio } from '../audio/useGameAudio';
import { useButtonSound, useSound } from '../audio/SoundProvider';
import { ONBOARDING_KEY } from '../game/mockData';
import { GOAL_AMOUNT } from '../game/constants';
import { useCoffeeGame } from '../game/useCoffeeGame';
import { formatWon } from '../game/utils';
import { BottomNav } from './BottomNav';
import { GameFlowFooter } from './GameFlowFooter';
import { GrowthPanel } from './GrowthPanel';
import { OnboardingModal } from './OnboardingModal';
import { PlantScene } from './PlantScene';
import { SettingsSheet } from './SettingsSheet';
import { UserBar } from './UserBar';
import './CoffeeGame.css';

function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function CoffeeGame() {
  const {
    state,
    startHold,
    stopHold,
    reset,
    readyToDrink,
    holdMode,
    tapBurst,
    isHolding,
    holdProgress,
    holdTargetSec,
    holdElapsedSec,
    holdRemainingSec,
    lastEarned,
  } = useCoffeeGame();

  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
  const [showSettings, setShowSettings] = useState(false);
  const { play, unlock, startAmbient } = useSound();
  const buttonSound = useButtonSound();

  useGameAudio({
    state,
    isHolding,
    lastEarned,
    showOnboarding,
  });

  useEffect(() => {
    if (showOnboarding) play('modalOpen');
  }, [showOnboarding, play]);

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

  const handleStartHold = async () => {
    await unlock();
    startHold();
  };

  const handleStopHold = () => {
    if (isHolding && holdProgress < 100) play('waterCancel');
    stopHold();
  };

  const handleReset = async () => {
    await buttonSound();
    reset();
    setShowSettings(false);
  };

  const handleWinReset = async () => {
    await buttonSound();
    reset();
  };

  return (
    <div className="game">
      <UserBar money={state.money} onOpenSettings={openSettings} />

      {state.redeemed ? (
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
          <GrowthPanel growth={state.growth} />

          <main className="game__main">
            <PlantScene
              growth={state.growth}
              isWatering={isHolding}
              isReady={readyToDrink}
              tapBurst={tapBurst}
              disabled={state.redeemed}
              readyToDrink={readyToDrink}
              holdMode={holdMode}
              isHolding={isHolding}
              holdProgress={holdProgress}
              holdElapsedSec={holdElapsedSec}
              holdTargetSec={holdTargetSec}
              holdRemainingSec={holdRemainingSec}
              onPointerDown={handleStartHold}
              onPointerUp={handleStopHold}
            />

            <GameFlowFooter />
          </main>
        </>
      )}

      <BottomNav onSettings={openSettings} />

      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
      {showSettings && (
        <SettingsSheet
          totalWaters={state.totalWaters}
          totalCoffees={state.totalCoffees}
          onReset={handleReset}
          onClose={closeSettings}
        />
      )}
    </div>
  );
}
