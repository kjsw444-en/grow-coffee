import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useSound } from '../audio/SoundProvider';
import { resumeGameAudioAfterAd } from '../audio/resumeGameAudioAfterAd';
import {
  DAILY_LOGIN_ROULETTE_SEGMENTS,
  formatDailyLoginRouletteReward,
  getDailyLoginRouletteSegmentIndex,
  getDailyLoginRouletteSegmentIndexAtPointer,
  getNextDailyLoginRouletteRotation,
  isDailyLoginRouletteBigWin,
} from '../game/dailyLoginRoulette';
import { AppPortal } from './AppPortal';
import './DailyLoginRouletteModal.css';
import './RewardDialog.css';

const WHEEL_IMAGE_SRC = '/images/daily-roulette-wheel.png';
const BIG_WIN_IMAGE_SRC = '/images/daily-roulette-win-5plus.png?v=1';

type DailyLoginRouletteModalProps = {
  spinning: boolean;
  resultCups: number | null;
  spinGeneration: number;
  snapRevealKey?: number;
  canRespin: boolean;
  actionError?: string | null;
  onSpin: () => void;
  onRespin: () => void;
  onReceive: () => void;
  onClose: () => void;
};

const SPIN_MS = 4200;
const SPIN_TICK_MS = 750;

function playRouletteSpinTick(play: (id: 'slotRoll') => void) {
  resumeGameAudioAfterAd();
  play('slotRoll');
}

function playRouletteStop(play: (id: 'slotStop' | 'win') => void, resultCups: number) {
  resumeGameAudioAfterAd();
  play('slotStop');
  if (isDailyLoginRouletteBigWin(resultCups)) {
    window.setTimeout(() => play('win'), 100);
  }
}

function resetWheelToStart(
  rotationRef: MutableRefObject<number>,
  setRotation: (value: number) => void,
  setAnimating: (value: boolean) => void,
  setRevealedCups: (value: number | null) => void,
) {
  setRevealedCups(null);
  setAnimating(false);
  rotationRef.current = 0;
  setRotation(0);
}

function snapWheelToResult(
  resultCups: number,
  rotationRef: MutableRefObject<number>,
  setRotation: (value: number) => void,
  setAnimating: (value: boolean) => void,
  setRevealedCups: (value: number | null) => void,
) {
  const index = getDailyLoginRouletteSegmentIndex(resultCups);
  const finalRotation = getNextDailyLoginRouletteRotation(index, 0, 6);
  rotationRef.current = finalRotation;
  setRotation(finalRotation);
  setAnimating(false);
  setRevealedCups(resultCups);
}

export function DailyLoginRouletteModal({
  spinning,
  resultCups,
  spinGeneration,
  snapRevealKey = 0,
  canRespin,
  actionError,
  onSpin,
  onRespin,
  onReceive,
  onClose,
}: DailyLoginRouletteModalProps) {
  const { play } = useSound();
  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [revealedCups, setRevealedCups] = useState<number | null>(null);
  const rotationRef = useRef(0);
  const lastSpinGenerationRef = useRef(0);
  const lastSnapRevealKeyRef = useRef(0);
  const spinTickTimerRef = useRef(0);

  useEffect(() => {
    if (!animating) {
      if (spinTickTimerRef.current) {
        window.clearInterval(spinTickTimerRef.current);
        spinTickTimerRef.current = 0;
      }
      return;
    }

    playRouletteSpinTick(play);
    spinTickTimerRef.current = window.setInterval(() => {
      playRouletteSpinTick(play);
    }, SPIN_TICK_MS);

    return () => {
      if (spinTickTimerRef.current) {
        window.clearInterval(spinTickTimerRef.current);
        spinTickTimerRef.current = 0;
      }
    };
  }, [animating, play]);

  useEffect(() => {
    if (resultCups === null) {
      lastSpinGenerationRef.current = spinGeneration;
      resetWheelToStart(rotationRef, setRotation, setAnimating, setRevealedCups);
      return;
    }

    if (snapRevealKey !== lastSnapRevealKeyRef.current && snapRevealKey > 0) {
      lastSnapRevealKeyRef.current = snapRevealKey;
      snapWheelToResult(resultCups, rotationRef, setRotation, setAnimating, setRevealedCups);
      return;
    }

    if (spinGeneration === lastSpinGenerationRef.current) {
      return;
    }

    lastSpinGenerationRef.current = spinGeneration;

    const index = getDailyLoginRouletteSegmentIndex(resultCups);
    const nextRotation = getNextDailyLoginRouletteRotation(index, 0, 6);

    if (import.meta.env.DEV) {
      const atPointer = getDailyLoginRouletteSegmentIndexAtPointer(nextRotation);
      if (atPointer !== index) {
        console.warn('[daily-roulette] pointer mismatch', {
          resultCups,
          index,
          atPointer,
          cupsAtPointer: DAILY_LOGIN_ROULETTE_SEGMENTS[atPointer],
          nextRotation,
        });
      }
    }

    resetWheelToStart(rotationRef, setRotation, setAnimating, setRevealedCups);

    let revealTimer = 0;
    let raf2 = 0;

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        rotationRef.current = nextRotation;
        setAnimating(true);
        setRotation(nextRotation);

        revealTimer = window.setTimeout(() => {
          setAnimating(false);
          setRevealedCups(resultCups);
          playRouletteStop(play, resultCups);
        }, SPIN_MS);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(revealTimer);
    };
  }, [play, resultCups, snapRevealKey, spinGeneration]);

  const showInitialLayout = resultCups === null && !animating;
  const awaitingReveal =
    resultCups !== null && (revealedCups === null || revealedCups !== resultCups) && !spinning;
  const showResult =
    revealedCups !== null &&
    resultCups !== null &&
    revealedCups === resultCups &&
    !animating &&
    !spinning;
  const canSpin = showInitialLayout && !spinning && !animating;
  const showPostSpinActions = showResult || awaitingReveal;
  const showBigWin = showResult && isDailyLoginRouletteBigWin(revealedCups);
  const wheelImageSrc = showBigWin ? BIG_WIN_IMAGE_SRC : WHEEL_IMAGE_SRC;
  const showWheelPointer = !showBigWin && (showInitialLayout || animating || awaitingReveal);

  return (
    <AppPortal rootId="daily-roulette-portal-root">
      <div
        className="daily-roulette-overlay reward-dialog-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-roulette-title"
      >
      <div className="daily-roulette-card">
        <p className="daily-roulette-badge">1일 1접속 이벤트</p>
        <h2 id="daily-roulette-title">오늘의 행운 룰렛</h2>
        <p className="daily-roulette-desc">
          하루 첫 접속 보너스! 룰렛을 돌려 <strong>내린 커피</strong>를 받으세요.
        </p>

        <div className="daily-roulette-wheel-scene" aria-hidden="true">
          <img className="daily-roulette-wheel-scene__bg" src={wheelImageSrc} alt="" draggable={false} />
          {!showWheelPointer ? null : (
            <>
              <div key={`dial-${spinGeneration}-${resultCups ?? 'idle'}`} className="daily-roulette-wheel-scene__dial">
                <div
                  className={`daily-roulette-wheel-scene__pointer ${animating ? 'daily-roulette-wheel-scene__pointer--active' : ''}`}
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  <span className="daily-roulette-wheel-scene__pointer-arm" />
                </div>
              </div>
              <span className="daily-roulette-wheel-scene__pointer-cover" />
            </>
          )}
          {showBigWin && (
            <div className="daily-roulette-celebration-dialog" role="status" aria-live="polite">
              <p className="daily-roulette-celebration-dialog__text">축하한다 냥</p>
            </div>
          )}
        </div>

        {actionError ? (
          <p className="daily-roulette-error" role="alert">
            {actionError}
          </p>
        ) : showResult ? (
          <p className="daily-roulette-result" role="status">
            🎉 {formatDailyLoginRouletteReward(revealedCups)} 당첨!
          </p>
        ) : animating || awaitingReveal ? (
          <p className="daily-roulette-hint">룰렛이 돌아가는 중…</p>
        ) : spinning ? (
          <p className="daily-roulette-hint">룰렛 준비 중…</p>
        ) : (
          <p className="daily-roulette-hint">1·5·10·15·20·50잔 중 확률에 따라 당첨됩니다.</p>
        )}

        <div className="daily-roulette-actions">
          {showPostSpinActions ? (
            <>
              {showResult && (
                <button
                  className="daily-roulette-primary daily-roulette-claim feed-ad-button"
                  type="button"
                  onClick={onReceive}
                >
                  {formatDailyLoginRouletteReward(revealedCups)} 받기
                </button>
              )}
              {canRespin && showResult && (
                <button
                  className="daily-roulette-secondary feed-ad-button"
                  disabled={spinning || animating}
                  type="button"
                  onClick={onRespin}
                >
                  다시 돌리기
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="daily-roulette-primary feed-ad-button"
                disabled={!canSpin}
                type="button"
                onClick={onSpin}
              >
                {spinning || animating ? '룰렛 준비 중…' : '룰렛 돌리기'}
              </button>
              {!spinning && !animating && (
                <button className="daily-roulette-secondary" type="button" onClick={onClose}>
                  나중에
                </button>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </AppPortal>
  );
}
