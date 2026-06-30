import { useEffect } from 'react';
import { SCENE_DIALOGUE_IDLE_MS } from '../game/sceneDialogue';
import { logRewardDialog, type RewardDialogLogType } from '../utils/rewardDialogLog';
import { AppPortal } from './AppPortal';
import './RewardDialog.css';

type RewardDialogProps = {
  type: RewardDialogLogType;
  open: boolean;
  message: string;
  title?: string;
  autoHideMs?: number;
  onClose: () => void;
};

const TITLES: Record<RewardDialogLogType, string> = {
  roulette: '룰렛 보상',
  fortune: '오늘의 커피 운세',
  brewed: '내린 커피 마시기',
};

const BADGES: Record<RewardDialogLogType, string> = {
  roulette: 'ROULETTE REWARD',
  fortune: 'FORTUNE REWARD',
  brewed: 'BREWED COFFEE',
};

export function RewardDialog({
  type,
  open,
  message,
  title,
  autoHideMs = SCENE_DIALOGUE_IDLE_MS,
  onClose,
}: RewardDialogProps) {
  const trimmed = message.trim();
  const shouldOpen = open && trimmed.length > 0;

  useEffect(() => {
    logRewardDialog({
      type,
      shouldOpen,
      mounted: shouldOpen,
      rewardState: shouldOpen ? trimmed : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });
  }, [shouldOpen, trimmed, type]);

  useEffect(() => {
    if (!shouldOpen || autoHideMs <= 0) return;

    const timer = window.setTimeout(onClose, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [autoHideMs, onClose, shouldOpen]);

  if (!shouldOpen) {
    return null;
  }

  return (
    <AppPortal rootId="reward-dialog-portal-root">
      <div
        className="reward-dialog-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-dialog-title"
      >
        <div className="reward-dialog-card">
          <span className="reward-dialog-badge">{BADGES[type]}</span>
          <h2 id="reward-dialog-title" className="reward-dialog-title">
            {title ?? TITLES[type]}
          </h2>
          <p className="reward-dialog-message">{trimmed}</p>
          <button type="button" className="reward-dialog-close" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </AppPortal>
  );
}
