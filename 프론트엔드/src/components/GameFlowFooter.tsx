import { useState } from 'react';
import { AdBannerSlot } from './AdBannerSlot';
import { useButtonSound } from '../audio/SoundProvider';
import { SHARE_REWARD_COFFEE_AMOUNT } from '../game/constants';
import './GameFlowFooter.css';

const STEPS = [
  { num: 1, text: '씨앗\n물주기' },
  { num: 2, text: '새싹·원두\n성장' },
  { num: 3, text: '커피\n완성' },
  { num: 4, text: '커피\n마시기' },
  { num: 5, text: '다시\n반복' },
];

type GameFlowFooterProps = {
  onShareReward: (onMessage?: (message: string) => void) => Promise<string>;
  sharingReward?: boolean;
  shareRewardAvailable?: boolean;
  disabled?: boolean;
};

export function GameFlowFooter({
  onShareReward,
  sharingReward = false,
  shareRewardAvailable = true,
  disabled = false,
}: GameFlowFooterProps) {
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const buttonSound = useButtonSound();

  const handleShare = async () => {
    if (sharingReward || disabled) return;

    await buttonSound();
    setShareMessage('공유 화면을 여는 중...');

    try {
      const message = await onShareReward(setShareMessage);
      setShareMessage(message || null);
    } catch {
      setShareMessage('공유 리워드를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const shareHint = shareRewardAvailable
    ? `공유하면 내린 커피 ${SHARE_REWARD_COFFEE_AMOUNT}잔 · 하루 1회`
    : '오늘 공유 리워드 완료 · 내일 다시 가능';

  const handleNotifyOptIn = async () => {
    await buttonSound();
    setNotifyMessage('토스 푸시 알림 연동 검토 중이에요. 곧 만나요!');
  };

  return (
    <section className="game-flow" aria-label="게임 진행 순서">
      <button
        type="button"
        className="game-flow__share"
        disabled={sharingReward || disabled || !shareRewardAvailable}
        onClick={() => void handleShare()}
      >
        <span className="game-flow__share-icon" aria-hidden="true">
          ☕
        </span>
        <span className="game-flow__share-copy">
          <strong>
            {sharingReward ? '공유 준비 중...' : '커피 덕후에게 공유하기'}
          </strong>
          <small>{shareHint}</small>
        </span>
      </button>

      {shareMessage && (
        <p className="game-flow__share-message" role="status" aria-live="polite">
          {shareMessage}
        </p>
      )}

      <button
        type="button"
        className="game-flow__notify"
        disabled={disabled}
        onClick={() => void handleNotifyOptIn()}
      >
        <span className="game-flow__notify-icon" aria-hidden="true">
          🔔
        </span>
        <span className="game-flow__notify-copy">
          <strong>새로운 커피, 기능 나오면 알람받기</strong>
          <small>토스 푸시 알림 · 준비 중</small>
        </span>
      </button>

      {notifyMessage && (
        <p className="game-flow__notify-message" role="status" aria-live="polite">
          {notifyMessage}
        </p>
      )}

      <AdBannerSlot variant="feed" className="game-flow__image-banner" />

      <p className="game-flow__title">게임 진행 순서</p>
      <div className="game-flow__steps">
        {STEPS.map((step, i) => (
          <div key={step.num} className="game-flow__step-wrap">
            <div className="game-flow__step">
              <span className="game-flow__num">{step.num}</span>
              <span className="game-flow__text">{step.text}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="game-flow__arrow" aria-hidden="true">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
