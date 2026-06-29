import { useButtonSound } from '../audio/SoundProvider';
import './DailyRitualGiftBox.css';

const RITUAL_GIFT_BOX_SRC = '/images/daily-ritual-cat-gift-box.png?v=3';

type DailyRitualGiftBoxProps = {
  visible: boolean;
  disabled?: boolean;
  onOpen: () => void | Promise<void>;
};

export function DailyRitualGiftBox({ visible, disabled, onOpen }: DailyRitualGiftBoxProps) {
  const buttonSound = useButtonSound();

  if (!visible) {
    return null;
  }

  return (
    <div className="daily-ritual-gift" aria-live="polite">
      <div className="daily-ritual-gift__stage">
        <div className="daily-ritual-gift__aura" aria-hidden="true" />
        <div className="daily-ritual-gift__sparkles" aria-hidden="true">
          <span className="daily-ritual-gift__sparkle daily-ritual-gift__sparkle--1" />
          <span className="daily-ritual-gift__sparkle daily-ritual-gift__sparkle--2" />
          <span className="daily-ritual-gift__sparkle daily-ritual-gift__sparkle--3" />
          <span className="daily-ritual-gift__sparkle daily-ritual-gift__sparkle--4" />
          <span className="daily-ritual-gift__sparkle daily-ritual-gift__sparkle--5" />
        </div>
        <button
          type="button"
          className="daily-ritual-gift__box"
          disabled={disabled}
          aria-label="고양이 선물 상자 열기"
          onClick={() => {
            void (async () => {
              await buttonSound();
              await onOpen();
            })();
          }}
        >
          <img
            className="daily-ritual-gift__image"
            src={RITUAL_GIFT_BOX_SRC}
            alt=""
            width={148}
            height={148}
            draggable={false}
          />
        </button>
      </div>
      <p className="daily-ritual-gift__hint">고양이 선물이 도착했어요!</p>
    </div>
  );
}
