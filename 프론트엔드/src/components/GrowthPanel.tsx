import { memo } from 'react';
import { getStage, formatGrowthPercent, getStageGrowthRange } from '../game/utils';
import './GrowthPanel.css';
type GrowthPanelProps = {
  growth: number;
  totalCoffees: number;
  emptiedCoffeeCups: number;
  waterHint?: string | null;
  passiveHint?: string | null;
  isWatering?: boolean;
  isPassivelyGrowing?: boolean;
  canSellBatch?: boolean;
  sellBatchLabel?: string;
  onSellBatch?: () => void;
  sellDisabled?: boolean;
};

function GrowthPanelComponent({
  growth,
  totalCoffees,
  emptiedCoffeeCups,
  waterHint,
  passiveHint,
  isWatering,
  isPassivelyGrowing = false,
  canSellBatch = false,
  sellBatchLabel,
  onSellBatch,
  sellDisabled = false,
}: GrowthPanelProps) {
  const stage = getStage(growth);
  const barWidth = Math.min(100, Math.max(0, growth));
  const barLive = isWatering || isPassivelyGrowing;

  return (
    <section className="growth-panel">
      <div className="growth-panel__coffee-row">
        <div className="growth-panel__coffee-stat" aria-label={`내린 커피 ${totalCoffees}잔`}>
          <span className="growth-panel__coffee-icon" aria-hidden="true">
            ☕
          </span>
          <span className="growth-panel__coffee-label">내린 커피</span>
          <strong className="growth-panel__coffee-count">{totalCoffees.toLocaleString('ko-KR')}잔</strong>
        </div>
        <div className="growth-panel__coffee-stat growth-panel__coffee-stat--emptied" aria-label={`비운 커피잔 ${emptiedCoffeeCups}잔`}>
          <span className="growth-panel__coffee-icon growth-panel__coffee-icon--emptied" aria-hidden="true">
            <span className="growth-panel__empty-cup">☕</span>
            <span className="growth-panel__empty-check">✓</span>
          </span>
          <span className="growth-panel__coffee-label">비운 커피잔</span>
          <strong className="growth-panel__coffee-count growth-panel__coffee-count--emptied">
            {emptiedCoffeeCups.toLocaleString('ko-KR')}잔
          </strong>
        </div>
      </div>
      <div className="growth-panel__head">
        <span className="growth-panel__label">커피나무 성장률</span>
        <span className="growth-panel__percent">{formatGrowthPercent(growth)}</span>
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
      {canSellBatch && onSellBatch && (
        <button
          type="button"
          className="growth-panel__sell-btn"
          onClick={onSellBatch}
          disabled={sellDisabled}
        >
          {sellBatchLabel ?? '10잔 판매'}
        </button>
      )}
    </section>
  );
}

export const GrowthPanel = memo(GrowthPanelComponent);
