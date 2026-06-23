import { useCallback, useRef, useState, type PointerEvent } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import { CAT_BUTTON_PRESSED_SRC, CAT_BUTTON_SRC } from '../game/constants';
import './CatBonusButton.css';

type CatBonusButtonProps = {
  disabled?: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
};

export function CatBonusButton({ disabled, onPressStart, onPressEnd }: CatBonusButtonProps) {
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

  return (
    <button
      type="button"
      className={`cat-bonus-btn${pressed ? ' cat-bonus-btn--pressed' : ''}`}
      disabled={disabled}
      aria-label="커피냥"
      onPointerDown={(event) => void handlePointerDown(event)}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => finishPress(true)}
      onPointerCancel={() => finishPress(true)}
    >
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
  );
}
