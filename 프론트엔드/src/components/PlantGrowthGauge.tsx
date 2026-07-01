import { memo } from 'react';
import { COFFEE_STAGE_MIN } from '../game/constants';
import { formatPassiveGrowthPercent } from '../game/utils';
import './PlantGrowthGauge.css';

type PlantGrowthGaugeProps = {
  growth: number;
  isHolding?: boolean;
};

function PlantGrowthGaugeComponent({ growth, isHolding = false }: PlantGrowthGaugeProps) {
  const clamped = Math.min(100, Math.max(0, growth));
  const isFull = clamped >= 99.95;
  const fillHeight = isFull ? 100 : clamped;

  return (
    <div
      className={[
        'plant-growth-gauge',
        isHolding ? 'plant-growth-gauge--holding' : '',
        isFull ? 'plant-growth-gauge--full' : '',
        clamped >= COFFEE_STAGE_MIN ? 'plant-growth-gauge--mature' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <span className="plant-growth-gauge__label">성장</span>
      <div className="plant-growth-gauge__track">
        <div className="plant-growth-gauge__ticks" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="plant-growth-gauge__fill-wrap">
          <div className="plant-growth-gauge__fill" style={{ height: `${fillHeight}%` }}>
            <div className="plant-growth-gauge__fill-glow" aria-hidden="true" />
            <div className="plant-growth-gauge__fill-shimmer" aria-hidden="true" />
            <div className="plant-growth-gauge__fill-sparkles" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
      <span className="plant-growth-gauge__pct">{formatPassiveGrowthPercent(clamped, 1)}</span>
    </div>
  );
}

export const PlantGrowthGauge = memo(PlantGrowthGaugeComponent);
