import { memo, useEffect, useRef, useState } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import {
  BREWED_COFFEE_DRINK_OPTIONS,
  BREWED_COFFEE_FINISH_BONUS_AMOUNT,
  BREWED_COFFEE_FINISH_BONUS_THRESHOLD,
  BREWED_COFFEE_RATE_NOTICE,
  getBrewedCoffeeDrinkCupHint,
  getBrewedCoffeePointReward,
  MIN_BREWED_COFFEE_DRINK,
} from '../game/brewedCoffeeDrink';
import { formatWon } from '../game/utils';

type GrowthPanelSellSectionProps = {
  totalCoffees: number;
  sellBatchLabel?: string;
  onSellBatch?: (cupCount: number) => void;
  onClaimFinishBonus?: () => void;
  sellDisabled?: boolean;
  sellPending?: boolean;
  claimingFinishBonus?: boolean;
};

function GrowthPanelSellSectionComponent({
  totalCoffees,
  sellBatchLabel,
  onSellBatch,
  onClaimFinishBonus,
  sellDisabled = false,
  sellPending = false,
  claimingFinishBonus = false,
}: GrowthPanelSellSectionProps) {
  const [drinkPickerOpen, setDrinkPickerOpen] = useState(false);
  const [sellBlockedBubble, setSellBlockedBubble] = useState(false);
  const sellUnfoldSound = useButtonSound('sellUnfold');
  const sellWrapRef = useRef<HTMLDivElement>(null);

  const sellBatchBlocked = sellDisabled || totalCoffees < MIN_BREWED_COFFEE_DRINK;
  const sellCupHint = getBrewedCoffeeDrinkCupHint(totalCoffees);
  const sellCupBlocked = totalCoffees < MIN_BREWED_COFFEE_DRINK;
  const sellBlockedBubbleText = `${MIN_BREWED_COFFEE_DRINK.toLocaleString('ko-KR')}잔 이상부터 가능`;
  const cashoutRemaining = Math.max(0, MIN_BREWED_COFFEE_DRINK - totalCoffees);
  const cashoutProgressPercent = Math.min(100, (totalCoffees / MIN_BREWED_COFFEE_DRINK) * 100);
  const finishBonusAvailable =
    Boolean(onClaimFinishBonus) &&
    totalCoffees >= BREWED_COFFEE_FINISH_BONUS_THRESHOLD &&
    totalCoffees < MIN_BREWED_COFFEE_DRINK;

  const handlePickDrink = (cupCount: number) => {
    setDrinkPickerOpen(false);
    onSellBatch?.(cupCount);
  };

  useEffect(() => {
    if (!sellBlockedBubble) return;

    const timer = window.setTimeout(() => setSellBlockedBubble(false), 2600);

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sellWrapRef.current?.contains(target)) return;
      setSellBlockedBubble(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [sellBlockedBubble]);

  const handleSellWrapClick = () => {
    if (sellBatchBlocked && sellCupBlocked) {
      setSellBlockedBubble(true);
    }
  };

  const handleSellBtnClick = () => {
    if (sellBatchBlocked) return;
    setSellBlockedBubble(false);
    if (!drinkPickerOpen) {
      void sellUnfoldSound();
    }
    setDrinkPickerOpen((open) => !open);
  };

  if (!onSellBatch) return null;

  return (
    <>
      <div
        className={`growth-panel__cashout-progress${cashoutRemaining === 0 ? ' growth-panel__cashout-progress--ready' : ''}`}
        aria-label={
          cashoutRemaining === 0
            ? '내린 커피 마시기 가능'
            : `내린 커피 마시기까지 ${cashoutRemaining}잔 남음`
        }
      >
        <div className="growth-panel__cashout-head">
          <span className="growth-panel__cashout-title">내린 커피 마시기까지</span>
          <strong className="growth-panel__cashout-remaining">
            {cashoutRemaining === 0 ? '가능!' : `${cashoutRemaining.toLocaleString('ko-KR')}잔 남음`}
          </strong>
        </div>
        <div className="growth-panel__cashout-track" aria-hidden="true">
          <div className="growth-panel__cashout-fill" style={{ width: `${cashoutProgressPercent}%` }} />
        </div>
        {totalCoffees >= 40 && cashoutRemaining > 0 && (
          <p className="growth-panel__cashout-note">조금만 더 모으면 첫 커피값을 받을 수 있어요.</p>
        )}
        {finishBonusAvailable && (
          <button
            type="button"
            className="growth-panel__finish-bonus-btn"
            disabled={claimingFinishBonus || sellDisabled || sellPending}
            onClick={onClaimFinishBonus}
          >
            {claimingFinishBonus
              ? '받는 중…'
              : `마지막 부스트 +${BREWED_COFFEE_FINISH_BONUS_AMOUNT}잔`}
          </button>
        )}
      </div>
      <div ref={sellWrapRef} className="growth-panel__sell-wrap" onClick={handleSellWrapClick}>
        {sellBlockedBubble && (
          <div className="growth-panel__sell-bubble" role="tooltip">
            <p className="growth-panel__sell-bubble-text">{sellBlockedBubbleText}</p>
          </div>
        )}
        <button
          type="button"
          className="growth-panel__sell-btn"
          onClick={(event) => {
            event.stopPropagation();
            handleSellBtnClick();
          }}
          disabled={sellBatchBlocked}
          aria-expanded={drinkPickerOpen}
        >
          <span className="growth-panel__sell-btn-label">
            {sellPending ? '마시는 중…' : (sellBatchLabel ?? '내린 커피 마시기')}
          </span>
          {!sellPending && (
            <span className="growth-panel__sell-btn-hint" aria-live="polite">
              {sellCupHint}
            </span>
          )}
        </button>
      </div>
      {drinkPickerOpen && !sellPending && (
        <div className="growth-panel__drink-picker" role="group" aria-label="내린 커피 마시기 잔 수 선택">
          <p className="growth-panel__drink-picker-title">몇 잔 마실까요?</p>
          <div className="growth-panel__drink-options">
            {BREWED_COFFEE_DRINK_OPTIONS.map((cupCount) => {
              const reward = getBrewedCoffeePointReward(cupCount);
              const affordable = totalCoffees >= cupCount;
              return (
                <button
                  key={cupCount}
                  type="button"
                  className="growth-panel__drink-option"
                  disabled={sellBatchBlocked || !affordable}
                  onClick={() => handlePickDrink(cupCount)}
                >
                  <span className="growth-panel__drink-option-cups">
                    {cupCount.toLocaleString('ko-KR')}잔
                  </span>
                  <span className="growth-panel__drink-option-points">커피값 {formatWon(reward)}</span>
                </button>
              );
            })}
          </div>
          <p className="growth-panel__drink-picker-note">{BREWED_COFFEE_RATE_NOTICE}</p>
          <button
            type="button"
            className="growth-panel__drink-picker-close"
            onClick={() => setDrinkPickerOpen(false)}
          >
            닫기
          </button>
        </div>
      )}
    </>
  );
}

export const GrowthPanelSellSection = memo(GrowthPanelSellSectionComponent);
