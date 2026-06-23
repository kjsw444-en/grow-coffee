import { useState } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import { shareWithCoffeeFriends } from '../services/tossShare';
import './GameFlowFooter.css';

const STEPS = [
  { num: 1, text: '씨앗\n물주기' },
  { num: 2, text: '새싹·원두\n성장' },
  { num: 3, text: '커피\n완성' },
  { num: 4, text: '커피\n마시기' },
  { num: 5, text: '다시\n반복' },
];

export function GameFlowFooter() {
  const [sharePending, setSharePending] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const buttonSound = useButtonSound();

  const handleShare = async () => {
    if (sharePending) return;

    await buttonSound();
    setSharePending(true);
    setShareMessage('공유 화면을 여는 중...');

    try {
      await shareWithCoffeeFriends({ onMessage: setShareMessage });
    } finally {
      setSharePending(false);
    }
  };

  return (
    <section className="game-flow" aria-label="게임 진행 순서">
      <button
        type="button"
        className="game-flow__share"
        disabled={sharePending}
        onClick={() => void handleShare()}
      >
        <span className="game-flow__share-icon" aria-hidden="true">
          ☕
        </span>
        <span className="game-flow__share-copy">
          <strong>{sharePending ? '공유 준비 중...' : '커피 덕후에게 공유하기'}</strong>
          <small>토스 친구에게 커피 키우기 초대</small>
        </span>
      </button>

      {shareMessage && (
        <p className="game-flow__share-message" role="status" aria-live="polite">
          {shareMessage}
        </p>
      )}

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
