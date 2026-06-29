import { memo } from 'react';
import type { AttendanceUiStats } from '../game/attendance';
import { GrowthPanelAttendanceSection } from './GrowthPanelAttendanceSection';
import { GrowthPanelCoffeeRow } from './GrowthPanelCoffeeRow';
import { GrowthPanelPassiveSection } from './GrowthPanelPassiveSection';
import { GrowthPanelSellSection } from './GrowthPanelSellSection';
import { GrowthPanelTreeSection } from './GrowthPanelTreeSection';
import type { PassiveCoffeeStat } from './growthPanelTypes';
import './GrowthPanel.css';

type GrowthPanelProps = {
  growth: number;
  /** 물주기 중 holdProgress 기반 실시간 미리보기 — 바·숫자가 버튼 링과 동기화 */
  holdPreviewGrowth?: number | null;
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
  ritualGiftLabel?: string | null;
  ritualGiftDescription?: string | null;
  treeStageGrowth?: number;
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
  holdPreviewGrowth = null,
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
  ritualGiftLabel = null,
  ritualGiftDescription = null,
  treeStageGrowth,
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
  const treeGrowth = holdPreviewGrowth ?? growth;
  const labelGrowth = percentGrowth ?? treeGrowth;
  const barLive = Boolean(isWatering);

  return (
    <section className="growth-panel">
      <GrowthPanelCoffeeRow totalCoffees={totalCoffees} emptiedCoffeeCups={emptiedCoffeeCups} />
      {passiveCoffee && (
        <GrowthPanelPassiveSection
          passiveCoffee={passiveCoffee}
          isPassivelyAccruing={isPassivelyAccruing}
          onClaimPassiveCoffee={onClaimPassiveCoffee}
          onReactivatePassiveCoffee={onReactivatePassiveCoffee}
          claimingPassiveCoffee={claimingPassiveCoffee}
          reactivatingPassiveCoffee={reactivatingPassiveCoffee}
          claimSyncBlocked={claimSyncBlocked}
          reactivateSyncBlocked={reactivateSyncBlocked}
          passiveClaimFeedback={passiveClaimFeedback}
        />
      )}
      <GrowthPanelTreeSection
        growth={treeGrowth}
        labelGrowth={labelGrowth}
        stageGrowth={treeStageGrowth ?? labelGrowth}
        barLive={barLive}
        passiveHint={passiveHint}
        waterHint={waterHint}
        ritualGiftLabel={ritualGiftLabel}
        ritualGiftDescription={ritualGiftDescription}
      />
      <GrowthPanelSellSection
        totalCoffees={totalCoffees}
        sellBatchLabel={sellBatchLabel}
        onSellBatch={onSellBatch}
        onClaimFinishBonus={onClaimFinishBonus}
        sellDisabled={sellDisabled}
        sellPending={sellPending}
        claimingFinishBonus={claimingFinishBonus}
      />
      {attendance && (
        <GrowthPanelAttendanceSection
          attendance={attendance}
          onClaimAttendanceDaily={onClaimAttendanceDaily}
          onClaimAttendanceStreak={onClaimAttendanceStreak}
          claimingAttendanceDaily={claimingAttendanceDaily}
          claimingAttendanceStreak={claimingAttendanceStreak}
        />
      )}
    </section>
  );
}

export const GrowthPanel = memo(GrowthPanelComponent);
