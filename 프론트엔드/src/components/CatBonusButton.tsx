import { useCallback, useRef, useState, type PointerEvent } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import { CAT_BUTTON_PRESSED_SRC, CAT_BUTTON_SRC } from '../game/constants';
import './CatBonusButton.css';

type CatBonusButtonProps = {
  disabled?: boolean;
  fortuneNudgeVisible?: boolean;
  fortuneNudgeText?: string;
  rouletteNudgeVisible?: boolean;
  rouletteNudgeText?: string;
  onFortuneNudgeClick?: () => void;
  onRouletteNudgeClick?: () => void;
  onPressStart: () => void;
  onPressEnd: () => void;
};

export function CatBonusButton({
  disabled,
  fortuneNudgeVisible = false,
  fortuneNudgeText,
  rouletteNudgeVisible = false,
  rouletteNudgeText,
  onFortuneNudgeClick,
  onRouletteNudgeClick,
  onPressStart,
  onPressEnd,
}: CatBonusButtonProps) {
  const buttonSound = useButtonSound();
  const [pressed, setPressed] = useState(false);
  const pressedRef = useRef(false);

  const finishPress = useCallback(
    (notifyEnd: boolean) => {
      if (!pressedRef.current) return;
      pressedRef.current = false;
      setPressed(false);
      if (notifyEnd) onPressEnd();
    },
    [onPressEnd],
  );

  const handlePointerDown = useCallback(
    async (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pressedRef.current = true;
      setPressed(true);
      await buttonSound();
      onPressStart();
    },
    [buttonSound, disabled, onPressStart],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finishPress(true);
    },
    [disabled, finishPress],
  );

  const handleBubbleClick = useCallback(async () => {
    if (disabled) return;
    await buttonSound();
    if (rouletteNudgeVisible) {
      onRouletteNudgeClick?.();
      return;
    }
    if (fortuneNudgeVisible) {
      onFortuneNudgeClick?.();
    }
  }, [buttonSound, disabled, fortuneNudgeVisible, onFortuneNudgeClick, onRouletteNudgeClick, rouletteNudgeVisible]);

  const bubbleVisible = rouletteNudgeVisible || fortuneNudgeVisible;
  const bubbleText = rouletteNudgeVisible ? rouletteNudgeText : fortuneNudgeText;
  const bubbleLabel = rouletteNudgeVisible ? '1일 1룰렛 열기' : '오늘의 선물 받기';

  return (
    <div
      className={`cat-bonus-btn-wrap${bubbleVisible ? ' cat-bonus-btn-wrap--nudge' : ''}`}
    >
      {bubbleVisible && bubbleText && (
        <button
          type="button"
          className="cat-bonus-btn__roulette-bubble"
          aria-label={bubbleLabel}
          onClick={() => void handleBubbleClick()}
        >
          <p className="cat-bonus-btn__roulette-bubble-text">{bubbleText}</p>
        </button>
      )}
      <button
        type="button"
        className={`cat-bonus-btn${pressed ? ' cat-bonus-btn--pressed' : ''}${bubbleVisible ? ' cat-bonus-btn--nudge-pulse' : ''}`}
        disabled={disabled}
        aria-label={bubbleVisible ? bubbleLabel : '커피냥'}
        onPointerDown={(event) => void handlePointerDown(event)}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => finishPress(true)}
        onPointerCancel={() => finishPress(true)}
      >
        <span className="cat-bonus-btn__hitbox" aria-hidden="true" />
        <span className="cat-bonus-btn__frame" aria-hidden="true">
          <img
            className="cat-bonus-btn__img"
            src={pressed ? CAT_BUTTON_PRESSED_SRC : CAT_BUTTON_SRC}
            alt=""
            draggable={false}
          />
        </span>
        <span className="cat-bonus-btn__label">커피냥</span>
      </button>
    </div>
  );
}
