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
        growth={growth}
        stageGrowth={treeStageGrowth ?? growth}
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
