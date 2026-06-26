import { memo, useId, useRef } from 'react';
import { HOLD_DURATION_LABEL, type HoldMode } from '../game/constants';
import { isCoffeeStage, isDrinkStage } from '../game/utils';
import './WaterHoldCircle.css';

type WaterHoldCircleProps = {
  disabled?: boolean;
  embedded?: boolean;
  growth?: number;
  holdMode: HoldMode;
  isHolding: boolean;
  holdProgress: number;
  holdElapsedSec: number;
  holdTargetSec: number;
  holdRemainingSec: number;
  onPointerDown: () => void;
  onPointerUp: () => void;
};

function useRingSize(embedded: boolean) {
  const radius = embedded ? 94 : 92;
  const btnSize = embedded ? 148 : 220;
  const circumference = 2 * Math.PI * radius;
  return { radius, btnSize, circumference };
}

export const WaterHoldCircle = memo(function WaterHoldCircle({
  disabled,
  embedded = false,
  growth = 0,
  holdMode,
  isHolding,
  holdProgress,
  holdElapsedSec,
  holdTargetSec,
  holdRemainingSec,
  onPointerDown,
  onPointerUp,
}: WaterHoldCircleProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const uid = useId().replace(/:/g, '');
  const { radius, btnSize, circumference } = useRingSize(embedded);
  const progress = Math.min(100, Math.max(0, holdProgress));
  const offset = circumference * (1 - progress / 100);
  const tipTheta = -Math.PI / 2 + (progress / 100) * 2 * Math.PI;
  const tipX = 110 + radius * Math.cos(tipTheta);
  const tipY = 110 + radius * Math.sin(tipTheta);
  const showTip = isHolding && progress > 1 && progress < 99.5;
  const isDrink = holdMode === 'drink';
  const isBrew =
    holdMode === 'brew' || (isCoffeeStage(growth) && !isDrinkStage(growth));

  const idleLabel = isBrew
    ? '커피 내리기'
    : isDrink
      ? '커피 마시기'
      : embedded
        ? '물주기'
        : '버튼을 눌러 물주기';
  const holdingLabel = isBrew
    ? '커피 내리는중'
    : isDrink
      ? '커피 받는중'
      : embedded
        ? '물주는 중'
        : '물을 주는 중...';
  const ariaLabel = isBrew ? '커피 내리기' : isDrink ? '커피 마시기' : '물주기';

  const rootClass = [
    'water-hold',
    embedded ? 'water-hold--embedded' : '',
    isDrink ? 'water-hold--drink' : '',
    isBrew ? 'water-hold--brew' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={rootClass}>
      {!embedded && (
        <h2 className="water-hold__title">
          {isBrew ? '☕ 커피 내리기 ☕' : isDrink ? '☕ 커피 마시기 ☕' : '💧 물주기 💧'}
        </h2>
      )}

      <button
        ref={btnRef}
        type="button"
        className={`water-hold__btn ${isHolding ? 'water-hold__btn--active' : ''}`}
        style={{ width: btnSize, height: btnSize }}
        disabled={disabled}
        aria-label={ariaLabel}
        onPointerDown={(e) => {
          e.preventDefault();
          btnRef.current?.setPointerCapture(e.pointerId);
          onPointerDown();
        }}
        onPointerUp={(e) => {
          if (btnRef.current?.hasPointerCapture(e.pointerId)) {
            btnRef.current.releasePointerCapture(e.pointerId);
          }
          onPointerUp();
        }}
        onPointerCancel={(e) => {
          if (btnRef.current?.hasPointerCapture(e.pointerId)) {
            btnRef.current.releasePointerCapture(e.pointerId);
          }
          onPointerUp();
        }}
        onLostPointerCapture={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg
          className={`water-hold__ring ${isHolding ? 'water-hold__ring--active' : ''}`}
          viewBox="0 0 220 220"
          aria-hidden="true"
          style={{ width: btnSize, height: btnSize }}
        >
          <defs>
            <linearGradient id={`${uid}-ring-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f0e6de" />
              <stop offset="100%" stopColor="#e8dcd4" />
            </linearGradient>
            <linearGradient id={`${uid}-ring-fill`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ecd0c4" />
              <stop offset="55%" stopColor="#e0b8a8" />
              <stop offset="100%" stopColor="#d4a898" />
            </linearGradient>
            <filter id={`${uid}-ring-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            className="water-hold__ring-bg"
            cx="110"
            cy="110"
            r={radius}
            stroke={`url(#${uid}-ring-bg)`}
          />
          <circle
            className={`water-hold__ring-fill ${isHolding ? 'water-hold__ring-fill--active' : ''}`}
            cx="110"
            cy="110"
            r={radius}
            stroke={`url(#${uid}-ring-fill)`}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isHolding ? offset : circumference}
          />
          {showTip && (
            <circle
              className="water-hold__ring-tip"
              cx={tipX}
              cy={tipY}
              r={embedded ? 6 : 7}
              filter={`url(#${uid}-ring-glow)`}
            />
          )}
          {!isHolding && (
            <circle
              className="water-hold__ring-edge"
              cx="110"
              cy={110 - radius}
              r={embedded ? 5 : 6}
            />
          )}
        </svg>
        <div className="water-hold__inner">
          {isHolding ? (
            <>
              <p className="water-hold__status">{holdingLabel}</p>
              <p className="water-hold__timer">{holdRemainingSec.toFixed(1)}초</p>
              {embedded && <p className="water-hold__gauge-pct">{Math.round(progress)}%</p>}
              {!embedded && (
                <p className="water-hold__target">
                  목표 {holdTargetSec}초 · 경과 {holdElapsedSec.toFixed(1)}초
                </p>
              )}
            </>
          ) : (
            <>
              <p className="water-hold__status">{idleLabel}</p>
              {!embedded && !isBrew && <p className="water-hold__target">{HOLD_DURATION_LABEL}</p>}
            </>
          )}
        </div>
      </button>

      {!embedded && <p className="water-hold__warn">손을 떼면 취소돼요!</p>}
      {!embedded && (
        <p className="water-hold__footer">
          {isBrew
            ? '커피 내리는 동안 계속 버튼을 누르고 있어요'
            : isDrink
              ? '커피를 받는 동안 계속 버튼을 누르고 있어요'
              : '물 주는 동안 계속 버튼을 누르고 있어요'}
        </p>
      )}
    </section>
  );
});
