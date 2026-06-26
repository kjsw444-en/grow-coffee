import { memo, useEffect, useRef, useState } from 'react';
import { BREWED_COFFEE_HELP, DRUNK_COFFEE_HELP } from '../game/coffeeCurrencyHelp';
import {
  BREWED_COFFEE_DRINK_OPTIONS,
  BREWED_COFFEE_FINISH_BONUS_AMOUNT,
  BREWED_COFFEE_FINISH_BONUS_THRESHOLD,
  BREWED_COFFEE_RATE_NOTICE,
  getBrewedCoffeeDrinkCupHint,
  getBrewedCoffeePointReward,
  MIN_BREWED_COFFEE_DRINK,
} from '../game/brewedCoffeeDrink';
import { getStage, formatPassiveGrowthPercent, formatTreeGrowthPercent, getStageGrowthRange, formatWon } from '../game/utils';
import './GrowthPanel.css';

import type { AttendanceUiStats } from '../game/attendance';

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
  reactivateSyncBlocked?: boolean;
  passiveClaimFeedback?: { tone: 'error' | 'success'; text: string } | null;
  waterHint?: string | null;
  passiveHint?: string | null;
  isWatering?: boolean;
  isPassivelyAccruing?: boolean;
  sellBatchLabel?: string;
  onSellBatch?: (cupCount: number) => void;
  onClaimFinishBonus?: () => void;
  sellDisabled?: boolean;
  sellPending?: boolean;
  claimingFinishBonus?: boolean;
  attendance?: AttendanceUiStats | null;
  onClaimAttendanceDaily?: () => void;
  onClaimAttendanceStreak?: () => void;
  claimingAttendanceDaily?: boolean;
  claimingAttendanceStreak?: boolean;
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
  reactivateSyncBlocked = false,
  passiveClaimFeedback = null,
  waterHint,
  passiveHint,
  isWatering,
  isPassivelyAccruing = false,
  sellBatchLabel,
  onSellBatch,
  onClaimFinishBonus,
  sellDisabled = false,
  sellPending = false,
  claimingFinishBonus = false,
  attendance = null,
  onClaimAttendanceDaily,
  onClaimAttendanceStreak,
  claimingAttendanceDaily = false,
  claimingAttendanceStreak = false,
}: GrowthPanelProps) {
  const [drinkPickerOpen, setDrinkPickerOpen] = useState(false);
  const [coffeeTip, setCoffeeTip] = useState<'brewed' | 'drunk' | null>(null);
  const [sellBlockedBubble, setSellBlockedBubble] = useState(false);
  const brewedCoffeeTipRef = useRef<HTMLDivElement>(null);
  const drunkCoffeeTipRef = useRef<HTMLDivElement>(null);
  const sellWrapRef = useRef<HTMLDivElement>(null);
  const labelGrowth = isWatering ? growth : (percentGrowth ?? growth);
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
      (passiveCoffee.canReactivate && !reactivatingPassiveCoffee && !reactivateSyncBlocked));
  const passiveClaimDisabled = claimingPassiveCoffee || claimSyncBlocked;
  const passiveReactivateDisabled = reactivatingPassiveCoffee || reactivateSyncBlocked;
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
    if (!coffeeTip) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (brewedCoffeeTipRef.current?.contains(target)) return;
      if (drunkCoffeeTipRef.current?.contains(target)) return;
      setCoffeeTip(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [coffeeTip]);

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
    setDrinkPickerOpen((open) => !open);
  };

  return (
    <section className="growth-panel">
      <div className="growth-panel__coffee-row">
        <div ref={brewedCoffeeTipRef} className="growth-panel__coffee-stat-wrap">
          <button
            type="button"
            className="growth-panel__coffee-stat growth-panel__coffee-stat--tip"
            aria-label={`내린 커피 ${totalCoffees}잔 · 설명 보기`}
            aria-expanded={coffeeTip === 'brewed'}
            onClick={() => setCoffeeTip((tip) => (tip === 'brewed' ? null : 'brewed'))}
          >
            <span className="growth-panel__coffee-icon" aria-hidden="true">
              ☕
            </span>
            <span className="growth-panel__coffee-label">내린 커피</span>
            <strong className="growth-panel__coffee-count">{totalCoffees.toLocaleString('ko-KR')}잔</strong>
          </button>
          {coffeeTip === 'brewed' && (
            <div className="growth-panel__coffee-tip growth-panel__coffee-tip--left" role="tooltip">
              <p className="growth-panel__coffee-tip-title">{BREWED_COFFEE_HELP.title}</p>
              <p className="growth-panel__coffee-tip-body">
                <strong>{BREWED_COFFEE_HELP.earnTitle}</strong>
                <br />
                {BREWED_COFFEE_HELP.earnLines.map((line) => (
                  <span key={line}>
                    · {line}
                    <br />
                  </span>
                ))}
              </p>
              <p className="growth-panel__coffee-tip-body">
                <strong>{BREWED_COFFEE_HELP.spendTitle}</strong>
                <br />
                {BREWED_COFFEE_HELP.spendLines.map((line) => (
                  <span key={line}>
                    · {line}
                    <br />
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
        <div ref={drunkCoffeeTipRef} className="growth-panel__coffee-stat-wrap">
          <button
            type="button"
            className="growth-panel__coffee-stat growth-panel__coffee-stat--emptied growth-panel__coffee-stat--tip"
            aria-label={`마신 커피 ${emptiedCoffeeCups}잔 · 설명 보기`}
            aria-expanded={coffeeTip === 'drunk'}
            onClick={() => setCoffeeTip((tip) => (tip === 'drunk' ? null : 'drunk'))}
          >
            <span className="growth-panel__coffee-icon growth-panel__coffee-icon--emptied" aria-hidden="true">
              <span className="growth-panel__empty-cup">☕</span>
              <span className="growth-panel__empty-check">✓</span>
            </span>
            <span className="growth-panel__coffee-label">마신 커피</span>
            <strong className="growth-panel__coffee-count growth-panel__coffee-count--emptied">
              {emptiedCoffeeCups.toLocaleString('ko-KR')}잔
            </strong>
          </button>
          {coffeeTip === 'drunk' && (
            <div className="growth-panel__coffee-tip" role="tooltip">
              <p className="growth-panel__coffee-tip-title">{DRUNK_COFFEE_HELP.title}</p>
              <p className="growth-panel__coffee-tip-body">
                <strong>{DRUNK_COFFEE_HELP.earnTitle}</strong>
                <br />
                {DRUNK_COFFEE_HELP.earnLines.map((line) => (
                  <span key={line}>
                    · {line}
                    <br />
                  </span>
                ))}
              </p>
              <p className="growth-panel__coffee-tip-body">
                <strong>{DRUNK_COFFEE_HELP.spendTitle}</strong>
                <br />
                {DRUNK_COFFEE_HELP.spendLines.map((line) => (
                  <span key={line}>
                    · {line}
                    <br />
                  </span>
                ))}
              </p>
            </div>
          )}
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
                style={{ width: `${passiveFillPercent}%` }}
              />
            </div>
            <span className="growth-panel__passive-gauge-percent">{passiveGaugeLabel}</span>
          </div>
        </div>
      )}

      <div className="growth-panel__head">
        <span className="growth-panel__label">커피나무 성장률</span>
        <span
          className={`growth-panel__percent${barLive ? ' growth-panel__percent--live' : ''}`}
        >
          {formatTreeGrowthPercent(labelGrowth)}
        </span>
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
      {onSellBatch && (
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
              <span className="growth-panel__cashout-title">
                내린 커피 마시기까지
              </span>
              <strong className="growth-panel__cashout-remaining">
                {cashoutRemaining === 0 ? '가능!' : `${cashoutRemaining.toLocaleString('ko-KR')}잔 남음`}
              </strong>
            </div>
            <div className="growth-panel__cashout-track" aria-hidden="true">
              <div className="growth-panel__cashout-fill" style={{ width: `${cashoutProgressPercent}%` }} />
            </div>
            {totalCoffees >= 40 && cashoutRemaining > 0 && (
              <p className="growth-panel__cashout-note">
                조금만 더 모으면 첫 커피값을 받을 수 있어요.
              </p>
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
                      <span className="growth-panel__drink-option-points">
                        커피값 {formatWon(reward)}
                      </span>
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
      )}
      {attendance && (
        <div
          className={`growth-panel__attendance${attendance.goalMetToday ? ' growth-panel__attendance--complete' : ''}`}
          aria-label={`출석 체크 오늘 ${Math.min(attendance.harvestsToday, attendance.dailyGoal)}/${attendance.dailyGoal}회, 연속 ${attendance.streak}/${attendance.streakTarget}일`}
        >
          <div className="growth-panel__attendance-head">
            <span className="growth-panel__attendance-icon" aria-hidden="true">
              📅
            </span>
            <span className="growth-panel__attendance-label">출석 체크</span>
            <strong className="growth-panel__attendance-today">
              오늘 {Math.min(attendance.harvestsToday, attendance.dailyGoal)}/{attendance.dailyGoal}회
            </strong>
          </div>
          <div className="growth-panel__attendance-track-row">
            <div className="growth-panel__attendance-track" aria-hidden="true">
              <div
                className={`growth-panel__attendance-fill${attendance.goalMetToday ? ' growth-panel__attendance-fill--complete' : ''}`}
                style={{ width: `${attendance.progressPercent}%` }}
              />
            </div>
            <span className="growth-panel__attendance-streak">
              연속 {attendance.streak}/{attendance.streakTarget}일
            </span>
          </div>
          <p className="growth-panel__attendance-note">
            {attendance.dailyClaimedToday
              ? '오늘 출석 보상을 받았어요. 내일도 이어가면 연속일이 쌓여요.'
              : attendance.goalMetToday
                ? '목표 달성! 아래 버튼으로 출석 보상을 받아 주세요.'
                : `커피나무 100% ${attendance.dailyGoal}번 · 일일 ${attendance.dailyRewardCups}잔 · ${attendance.streakTarget}일 연속 +${attendance.bonusCups}잔`}
          </p>
          {(attendance.canClaimDaily || attendance.canClaimStreakBonus) && (
            <div className="growth-panel__attendance-rewards">
              {attendance.canClaimDaily && (
                <button
                  type="button"
                  className="growth-panel__attendance-reward-btn"
                  disabled={claimingAttendanceDaily}
                  onClick={onClaimAttendanceDaily}
                >
                  {claimingAttendanceDaily
                    ? '받는 중…'
                    : `내린 커피 ${attendance.dailyRewardCups}잔 받기`}
                </button>
              )}
              {attendance.canClaimStreakBonus && (
                <button
                  type="button"
                  className="growth-panel__attendance-reward-btn growth-panel__attendance-reward-btn--streak"
                  disabled={claimingAttendanceStreak}
                  onClick={onClaimAttendanceStreak}
                >
                  {claimingAttendanceStreak
                    ? '받는 중…'
                    : `연속 7일 혜택 +${attendance.bonusCups}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export const GrowthPanel = memo(GrowthPanelComponent);
