import type { ReactNode } from 'react';
import type { MissionPlayStatus } from '../../services/dailyGamePlayQuota';
import { isMissionPlayExhausted } from '../../services/dailyGamePlayQuota';
import { VictoryReplayButton } from './GameVictoryOverlay';
import { MissionPlayBadge } from './MissionPlayBadge';

type MissionSelectRowProps = {
  icon: string;
  title: string;
  description: string;
  rewardClaimed: boolean;
  playStatus: MissionPlayStatus;
  rewardBadge: ReactNode;
  extraClassName?: string;
  onStart: () => void | Promise<void>;
};

export function MissionSelectRow({
  icon,
  title,
  description,
  rewardClaimed,
  playStatus,
  rewardBadge,
  extraClassName = '',
  onStart,
}: MissionSelectRowProps) {
  const exhausted = isMissionPlayExhausted(playStatus);
  const attempted = playStatus.state !== 'free_available';
  const rowComplete = rewardClaimed || attempted;
  const canStartFree = playStatus.state === 'free_available';
  const canReplay = playStatus.state === 'ad_required';

  return (
    <div className={`ai-mission-select-item${canReplay ? ' has-replay' : ''}`}>
      <div
        className={`ai-mission-select-shell ${rowComplete ? 'done' : ''} ${exhausted ? 'exhausted' : ''} ${extraClassName}`.trim()}
      >
        <button
          className="ai-mission-select-button"
          disabled={exhausted || !canStartFree}
          type="button"
          onClick={() => {
            if (canStartFree) void onStart();
          }}
        >
          <span className="ai-mission-select-icon">{icon}</span>
          <div className="ai-mission-select-copy">
            <strong>{title}</strong>
            <small>{description}</small>
          </div>
        </button>
        <div className="ai-mission-select-badges">
          {rewardBadge}
          {canReplay ? (
            <VictoryReplayButton
              className="ai-mission-select-replay-inline"
              compact
              needsAd
              onReplay={() => void onStart()}
            />
          ) : (
            <MissionPlayBadge status={playStatus} />
          )}
        </div>
      </div>
    </div>
  );
}
