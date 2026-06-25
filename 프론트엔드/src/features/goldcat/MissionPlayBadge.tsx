import { getMissionPlayLabel, type MissionPlayStatus } from '../../services/dailyGamePlayQuota';

type MissionPlayBadgeProps = {
  status: MissionPlayStatus;
};

export function MissionPlayBadge({ status }: MissionPlayBadgeProps) {
  const label = getMissionPlayLabel(status);
  const className =
    status.state === 'exhausted'
      ? 'ai-quest-badge exhausted'
      : status.state === 'ad_required'
        ? 'ai-quest-badge ad'
        : 'ai-quest-badge play';

  return <span className={className}>{label}</span>;
}
