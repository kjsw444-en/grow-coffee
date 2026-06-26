import { memo, useEffect, useRef, useState } from 'react';
import { formatTreeGrowthPercent, getStage, getStageGrowthRange } from '../game/utils';

type GrowthPanelTreeSectionProps = {
  growth: number;
  labelGrowth: number;
  stageGrowth: number;
  barLive: boolean;
  passiveHint?: string | null;
  waterHint?: string | null;
  ritualGiftLabel?: string | null;
  ritualGiftDescription?: string | null;
};

function GrowthPanelTreeSectionComponent({
  growth,
  labelGrowth,
  stageGrowth,
  barLive,
  passiveHint,
  waterHint,
  ritualGiftLabel,
  ritualGiftDescription,
}: GrowthPanelTreeSectionProps) {
  const stage = getStage(stageGrowth);
  const barWidth = Math.min(100, Math.max(0, growth));
  const prevLabelGrowthRef = useRef(labelGrowth);
  const [percentTick, setPercentTick] = useState(false);
  const [giftTipOpen, setGiftTipOpen] = useState(false);
  const giftTipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!barLive) {
      prevLabelGrowthRef.current = labelGrowth;
      setPercentTick(false);
      return;
    }

    if (Math.abs(labelGrowth - prevLabelGrowthRef.current) < 0.005) {
      return;
    }

    prevLabelGrowthRef.current = labelGrowth;
    setPercentTick(true);
    const timer = window.setTimeout(() => setPercentTick(false), 260);
    return () => window.clearTimeout(timer);
  }, [barLive, labelGrowth]);

  useEffect(() => {
    if (!giftTipOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (giftTipRef.current?.contains(target)) return;
      setGiftTipOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [giftTipOpen]);

  return (
    <>
      <div className="growth-panel__head">
        <span className="growth-panel__label">커피나무 성장률</span>
        <span
          className={`growth-panel__percent${barLive ? ' growth-panel__percent--live' : ''}${percentTick ? ' growth-panel__percent--tick' : ''}`}
        >
          {formatTreeGrowthPercent(labelGrowth)}
        </span>
        {ritualGiftLabel && ritualGiftDescription && (
          <div ref={giftTipRef} className="growth-panel__ritual-gift-wrap">
            <button
              type="button"
              className="growth-panel__ritual-gift"
              aria-expanded={giftTipOpen}
              aria-label={`고양이 선물 ${ritualGiftLabel} · 설명 보기`}
              onClick={() => setGiftTipOpen((open) => !open)}
            >
              <span className="growth-panel__ritual-gift-icon" aria-hidden="true">
                🎁
              </span>
              <span className="growth-panel__ritual-gift-label">{ritualGiftLabel}</span>
            </button>
            {giftTipOpen && (
              <div className="growth-panel__ritual-gift-tip" role="tooltip">
                <p className="growth-panel__ritual-gift-tip-title">고양이 선물 · {ritualGiftLabel}</p>
                <p className="growth-panel__ritual-gift-tip-body">{ritualGiftDescription}</p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="growth-panel__bar">
        <div
          className={`growth-panel__bar-fill ${barLive ? 'growth-panel__bar-fill--live' : ''}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="growth-panel__badge">
        성장 단계: {stage.label} ({getStageGrowthRange(stage)})
      </span>
      {passiveHint && <span className="growth-panel__passive-hint">{passiveHint}</span>}
      {waterHint && <span className="growth-panel__water-hint">{waterHint}</span>}
    </>
  );
}

export const GrowthPanelTreeSection = memo(GrowthPanelTreeSectionComponent);
