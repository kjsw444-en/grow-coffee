import { useButtonSound } from '../audio/SoundProvider';
import type { RitualMissionProgress } from '../services/dailyRitual';
import './DailyMissionPanel.css';

type DailyMissionPanelProps = {
  visible: boolean;
  variant?: 'default' | 'dock';
  missions: RitualMissionProgress[];
  rewardCups: number;
  canClaim: boolean;
  claimed: boolean;
  disabled?: boolean;
  onClaim: () => void | Promise<void>;
  onClaimFortune?: () => void | Promise<void>;
  canClaimFortune?: boolean;
  fortuneProgress?: number;
  fortuneGoal?: number;
  fortuneRewardCups?: number;
};

export function DailyMissionPanel({
  visible,
  variant = 'default',
  missions,
  rewardCups,
  canClaim,
  claimed,
  disabled,
  onClaim,
  onClaimFortune,
  canClaimFortune = false,
  fortuneProgress = 0,
  fortuneGoal = 0,
  fortuneRewardCups = 0,
}: DailyMissionPanelProps) {
  const buttonSound = useButtonSound();

  if (!visible) {
    return null;
  }

  const isDock = variant === 'dock';
  const claimReady = canClaim && !claimed;

  return (
    <section
      className={`daily-mission-panel${isDock ? ' daily-mission-panel--dock' : ''}${claimReady ? ' daily-mission-panel--ready' : ''}`}
      aria-label="오늘의 미션"
    >
      <header className="daily-mission-panel__head">
        <h2 className="daily-mission-panel__title">오늘의 미션</h2>
        <p className="daily-mission-panel__reward">완료 시 +{rewardCups}잔</p>
      </header>

      <ul className="daily-mission-panel__list">
        {missions.map((mission) => (
          <li
            key={mission.missionId}
            className={`daily-mission-panel__item${mission.done ? ' daily-mission-panel__item--done' : ''}`}
          >
            <span className="daily-mission-panel__check" aria-hidden="true">
              {mission.done ? '✓' : '○'}
            </span>
            <span className="daily-mission-panel__text">
              {mission.label}
              {mission.goal > 1 ? ` (${mission.current}/${mission.goal})` : ''}
            </span>
          </li>
        ))}
      </ul>

      {canClaimFortune && fortuneGoal > 0 && (
        <button
          type="button"
          className="daily-mission-panel__fortune-claim"
          disabled={disabled}
          onClick={() => {
            void (async () => {
              await buttonSound();
              await onClaimFortune?.();
            })();
          }}
        >
          수확 보너스 {fortuneRewardCups}잔 ({fortuneProgress}/{fortuneGoal})
        </button>
      )}

      <button
        type="button"
        className={`daily-mission-panel__claim${claimReady ? ' daily-mission-panel__claim--ready' : ''}`}
        disabled={disabled || claimed || !canClaim}
        onClick={() => {
          void (async () => {
            await buttonSound();
            await onClaim();
          })();
        }}
      >
        {claimed ? '보상 받음' : canClaim ? '보상받기' : '진행 중'}
      </button>
    </section>
  );
}
