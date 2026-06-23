import { memo } from 'react';
import { getStage, formatPassiveGrowthPercent, formatTreeGrowthPercent, getStageGrowthRange } from '../game/utils';
import './GrowthPanel.css';

type PassiveCoffeeStat = {
  earned: number;
  max: number;
  remainder: number;
  cupFillPercent: number;
  complete: boolean;
  canClaim: boolean;
  canReactivate: boolean;
  reactivateUsedToday: boolean;
};

type GrowthPanelProps = {
  growth: number;
  /** 숫자 라벨 — 물주기 확정치(25% 단위). 바 애니메이션과 분리 */
  percentGrowth?: number;
  totalCoffees: number;
  emptiedCoffeeCups: number;
  passiveCoffee?: PassiveCoffeeStat | null;
  onClaimPassiveCoffee?: () => void;
  onReactivatePassiveCoffee?: () => void;
  claimingPassiveCoffee?: boolean;
  reactivatingPassiveCoffee?: boolean;
  claimSyncBlocked?: boolean;
  passiveClaimFeedback?: { tone: 'error' | 'success'; text: string } | null;
  waterHint?: string | null;
  passiveHint?: string | null;
  isWatering?: boolean;
  isPassivelyAccruing?: boolean;
  canSellBatch?: boolean;
  sellBatchLabel?: string;
  onSellBatch?: () => void;
  sellDisabled?: boolean;
  sellPending?: boolean;
};

function GrowthPanelComponent({
  growth,
  percentGrowth,
  totalCoffees,
  emptiedCoffeeCups,
  passiveCoffee = null,
  onClaimPassiveCoffee,
  onReactivatePassiveCoffee,
  claimingPassiveCoffee = false,
  reactivatingPassiveCoffee = false,
  claimSyncBlocked = false,
  passiveClaimFeedback = null,
  waterHint,
  passiveHint,
  isWatering,
  isPassivelyAccruing = false,
  canSellBatch = false,
  sellBatchLabel,
  onSellBatch,
  sellDisabled = false,
  sellPending = false,
}: GrowthPanelProps) {
  const labelGrowth = percentGrowth ?? growth;
  const stage = getStage(labelGrowth);
  const barWidth = Math.min(100, Math.max(0, growth));
  const barLive = Boolean(isWatering);
  const passiveFillPercent = passiveCoffee
    ? Math.min(100, Math.max(0, passiveCoffee.cupFillPercent))
    : 0;
  const passiveGaugeLabel = passiveCoffee
    ? formatPassiveGrowthPercent(passiveCoffee.cupFillPercent)
    : '0%';
  const passivePulse =
    passiveCoffee &&
    ((passiveCoffee.canClaim && !claimingPassiveCoffee && !claimSyncBlocked) ||
      (passiveCoffee.canReactivate && !reactivatingPassiveCoffee));
  const passiveClaimDisabled = claimingPassiveCoffee || claimSyncBlocked;

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
        <div
          className="growth-panel__coffee-stat growth-panel__coffee-stat--emptied"
          aria-label={`비운 커피잔 ${emptiedCoffeeCups}잔`}
        >
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

      {passiveCoffee && (
        <div
          className={`growth-panel__passive-stat${passiveCoffee.complete ? ' growth-panel__passive-stat--complete' : ''}${passiveCoffee.canClaim || passiveCoffee.canReactivate ? ' growth-panel__passive-stat--ready' : ''}${passiveCoffee.reactivateUsedToday && passiveCoffee.complete ? ' growth-panel__passive-stat--done-today' : ''}`}
          aria-label={`방치 커피 ${passiveCoffee.earned}/${passiveCoffee.max}잔`}
        >
          <div className="growth-panel__passive-head">
            <span className="growth-panel__passive-icon" aria-hidden="true">
              ☀
            </span>
            <span className="growth-panel__passive-label">방치 커피</span>
            <strong className="growth-panel__passive-count">
              {passiveCoffee.earned}/{passiveCoffee.max}잔
            </strong>
            {(passiveCoffee.canClaim || claimingPassiveCoffee) && onClaimPassiveCoffee && (
              <button
                type="button"
                className={`growth-panel__passive-claim${claimingPassiveCoffee ? ' growth-panel__passive-claim--claiming' : ''}${passivePulse ? ' growth-panel__passive-claim--pulse' : ''}${claimSyncBlocked && !claimingPassiveCoffee ? ' growth-panel__passive-claim--blocked' : ''}`}
                disabled={passiveClaimDisabled}
                aria-busy={claimingPassiveCoffee}
                onClick={(event) => {
                  event.stopPropagation();
                  onClaimPassiveCoffee();
                }}
              >
                {claimingPassiveCoffee ? '받는 중…' : '방치 커피 받기'}
              </button>
            )}
            {passiveCoffee.canReactivate && onReactivatePassiveCoffee && (
              <button
                type="button"
                className={`growth-panel__passive-claim growth-panel__passive-claim--reactivate${reactivatingPassiveCoffee ? ' growth-panel__passive-claim--claiming' : ''}${passivePulse ? ' growth-panel__passive-claim--pulse' : ''}`}
                disabled={reactivatingPassiveCoffee}
                onClick={onReactivatePassiveCoffee}
              >
                {reactivatingPassiveCoffee ? '재활성 중…' : '재활성'}
              </button>
            )}
          </div>
          <div className="growth-panel__passive-meta">
            <span>하루 최대 {passiveCoffee.max}잔</span>
            {passiveCoffee.canClaim && <span> · 받으면 내린 커피 +1</span>}
            {passiveCoffee.canReactivate && <span> · 광고 후 다시 2잔 충전</span>}
            {passiveCoffee.complete && passiveCoffee.reactivateUsedToday && (
              <span> · 오늘 재활성 완료</span>
            )}
            {passiveCoffee.complete && !passiveCoffee.canReactivate && !passiveCoffee.reactivateUsedToday && (
              <span> · 오늘 수령 완료</span>
            )}
          </div>
          {passiveClaimFeedback && (
            <p
              className={`growth-panel__passive-feedback growth-panel__passive-feedback--${passiveClaimFeedback.tone}`}
              role="status"
            >
              {passiveClaimFeedback.text}
            </p>
          )}
          <div className="growth-panel__passive-track-row">
            <div className="growth-panel__passive-track" aria-hidden="true">
              <div
                className={`growth-panel__passive-fill${isPassivelyAccruing && !passiveCoffee.canClaim ? ' growth-panel__passive-fill--live' : ''}${passiveCoffee.canClaim ? ' growth-panel__passive-fill--ready' : ''}${passiveCoffee.canReactivate ? ' growth-panel__passive-fill--ready' : ''}`}
                style={{ width: `${passiveFillPercent}%` }}
              />
            </div>
            <span className="growth-panel__passive-gauge-percent">{passiveGaugeLabel}</span>
          </div>
        </div>
      )}

      <div className="growth-panel__head">
        <span className="growth-panel__label">커피나무 성장률</span>
        <span className="growth-panel__percent">{formatTreeGrowthPercent(labelGrowth)}</span>
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
          {sellPending ? '판매 중…' : (sellBatchLabel ?? '10잔 판매')}
        </button>
      )}
    </section>
  );
}

export const GrowthPanel = memo(GrowthPanelComponent);
