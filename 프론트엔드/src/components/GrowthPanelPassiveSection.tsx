import { memo, useEffect, useRef, useState } from 'react';
import { formatPassiveGrowthPercent } from '../game/utils';
import type { PassiveCoffeeStat } from './growthPanelTypes';
type GrowthPanelPassiveSectionProps = {
  passiveCoffee: PassiveCoffeeStat;
  isPassivelyAccruing?: boolean;
  onClaimPassiveCoffee?: () => void;
  onReactivatePassiveCoffee?: () => void;
  claimingPassiveCoffee?: boolean;
  reactivatingPassiveCoffee?: boolean;
  claimSyncBlocked?: boolean;
  reactivateSyncBlocked?: boolean;
  passiveClaimFeedback?: { tone: 'error' | 'success'; text: string } | null;
};

function passiveSectionEqual(
  prev: GrowthPanelPassiveSectionProps,
  next: GrowthPanelPassiveSectionProps,
) {
  const a = prev.passiveCoffee;
  const b = next.passiveCoffee;
  return (
    a.earned === b.earned &&
    a.max === b.max &&
    a.cupFillPercent === b.cupFillPercent &&
    a.complete === b.complete &&
    a.canClaim === b.canClaim &&
    a.canReactivate === b.canReactivate &&
    a.reactivateUsedToday === b.reactivateUsedToday &&
    a.timeRemainingLabel === b.timeRemainingLabel &&
    prev.isPassivelyAccruing === next.isPassivelyAccruing &&
    prev.claimingPassiveCoffee === next.claimingPassiveCoffee &&
    prev.reactivatingPassiveCoffee === next.reactivatingPassiveCoffee &&
    prev.claimSyncBlocked === next.claimSyncBlocked &&
    prev.reactivateSyncBlocked === next.reactivateSyncBlocked &&
    prev.passiveClaimFeedback === next.passiveClaimFeedback &&
    prev.onClaimPassiveCoffee === next.onClaimPassiveCoffee &&
    prev.onReactivatePassiveCoffee === next.onReactivatePassiveCoffee
  );
}

function GrowthPanelPassiveSectionComponent({
  passiveCoffee,
  isPassivelyAccruing = false,
  onClaimPassiveCoffee,
  onReactivatePassiveCoffee,
  claimingPassiveCoffee = false,
  reactivatingPassiveCoffee = false,
  claimSyncBlocked = false,
  reactivateSyncBlocked = false,
  passiveClaimFeedback = null,
}: GrowthPanelPassiveSectionProps) {
  const passiveFillPercent = Math.min(100, Math.max(0, passiveCoffee.cupFillPercent));
  const passiveLive = isPassivelyAccruing && !passiveCoffee.canClaim && !passiveCoffee.complete;
  const displayPercentRef = useRef(passiveFillPercent);
  const [displayPercent, setDisplayPercent] = useState(passiveFillPercent);
  const [percentTick, setPercentTick] = useState(false);
  const prevTargetRef = useRef(passiveFillPercent);

  useEffect(() => {
    const target = passiveFillPercent;

    if (!passiveLive) {
      displayPercentRef.current = target;
      setDisplayPercent(target);
      prevTargetRef.current = target;
      setPercentTick(false);
      return;
    }

    if (target > prevTargetRef.current + 0.006) {
      prevTargetRef.current = target;
      setPercentTick(true);
      const tickTimer = window.setTimeout(() => setPercentTick(false), 260);
      return () => window.clearTimeout(tickTimer);
    }

    prevTargetRef.current = target;
  }, [passiveFillPercent, passiveLive]);

  useEffect(() => {
    if (!passiveLive) return;

    let raf = 0;
    const loop = () => {
      const target = passiveFillPercent;
      const current = displayPercentRef.current;
      const diff = target - current;

      if (Math.abs(diff) > 0.0025) {
        const next = current + diff * 0.2;
        displayPercentRef.current = next;
        setDisplayPercent(next);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [passiveFillPercent, passiveLive]);

  const passiveGaugeFill = passiveLive ? displayPercent : passiveFillPercent;
  const passiveGaugeLabel = formatPassiveGrowthPercent(passiveGaugeFill);  const passivePulse =
    (passiveCoffee.canClaim && !claimingPassiveCoffee && !claimSyncBlocked) ||
    (passiveCoffee.canReactivate && !reactivatingPassiveCoffee && !reactivateSyncBlocked);
  const passiveClaimDisabled = claimingPassiveCoffee || claimSyncBlocked;
  const passiveReactivateDisabled = reactivatingPassiveCoffee || reactivateSyncBlocked;

  return (
    <div
      className={`growth-panel__passive-stat${passiveCoffee.complete ? ' growth-panel__passive-stat--complete' : ''}${passiveCoffee.canClaim || passiveCoffee.canReactivate ? ' growth-panel__passive-stat--ready' : ''}${passiveCoffee.reactivateUsedToday && passiveCoffee.complete ? ' growth-panel__passive-stat--done-today' : ''}`}
      aria-label={`방치 커피 ${passiveCoffee.earned}/${passiveCoffee.max}잔`}
    >
      <div className="growth-panel__passive-head">
        <div className="growth-panel__passive-head-main">
          <span className="growth-panel__passive-icon" aria-hidden="true">
            ☀
          </span>
          <span className="growth-panel__passive-label">방치 커피</span>
          <strong className="growth-panel__passive-count">
            {passiveCoffee.earned}/{passiveCoffee.max}잔
          </strong>
        </div>
        {passiveCoffee.timeRemainingLabel && (
          <span className="growth-panel__passive-remaining">{passiveCoffee.timeRemainingLabel}</span>
        )}
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
            className={`growth-panel__passive-claim growth-panel__passive-claim--reactivate${reactivatingPassiveCoffee ? ' growth-panel__passive-claim--claiming' : ''}${passivePulse ? ' growth-panel__passive-claim--pulse' : ''}${reactivateSyncBlocked && !reactivatingPassiveCoffee ? ' growth-panel__passive-claim--blocked' : ''}`}
            disabled={passiveReactivateDisabled}
            onClick={onReactivatePassiveCoffee}
          >
            {reactivatingPassiveCoffee ? '재활성 중…' : '재활성'}
          </button>
        )}
      </div>
      <div className="growth-panel__passive-meta">
        <span>하루 최대 {passiveCoffee.max}잔</span>
        {passiveCoffee.canClaim && <span> · 방치 커피+1 = 내린 커피+1</span>}
        {passiveCoffee.canReactivate && <span> · 리워드 광고 후 다시 2잔 충전</span>}
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
            style={{ width: `${Math.min(100, Math.max(0, passiveGaugeFill))}%` }}
          />
        </div>
        <span
          className={`growth-panel__passive-gauge-percent${passiveLive ? ' growth-panel__passive-gauge-percent--live' : ''}${percentTick ? ' growth-panel__passive-gauge-percent--tick' : ''}`}
        >
          {passiveGaugeLabel}
        </span>      </div>
    </div>
  );
}

export const GrowthPanelPassiveSection = memo(GrowthPanelPassiveSectionComponent, passiveSectionEqual);
