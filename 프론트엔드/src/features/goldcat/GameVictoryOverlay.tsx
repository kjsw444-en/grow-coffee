type VictoryGoldButtonProps = {
  rewardKg: number;
  alreadyClaimed?: boolean;
  disabled?: boolean;
  onClaim: () => void;
  className?: string;
};

export function VictoryGoldButton({
  rewardKg,
  alreadyClaimed = false,
  disabled = false,
  onClaim,
  className = '',
}: VictoryGoldButtonProps) {
  const rewardText = rewardKg >= 0.01 ? rewardKg.toFixed(2) : rewardKg.toFixed(3);

  return (
    <button
      className={`onboarding-gold-button quest-victory-gold-button ${className}`.trim()}
      disabled={disabled || alreadyClaimed}
      type="button"
      onClick={onClaim}
    >
      <span>☕</span>
      <strong>{alreadyClaimed ? '보상 수령 완료' : '커피 보상 받기'}</strong>
      <small>+{rewardText}KG</small>
    </button>
  );
}

type GameVictoryOverlayProps = {
  title?: string;
  subtitle?: string;
  rewardKg: number;
  alreadyClaimed?: boolean;
  onClaim: () => void;
  hideClaimButton?: boolean;
};

export function GameVictoryOverlay({
  title = '승리!',
  subtitle,
  rewardKg,
  alreadyClaimed = false,
  onClaim,
  hideClaimButton = false,
}: GameVictoryOverlayProps) {
  const rewardText = rewardKg >= 0.01 ? rewardKg.toFixed(2) : rewardKg.toFixed(3);

  return (
    <div className="game-victory-overlay" role="dialog" aria-modal="true">
      <div className="game-victory-card">
        <span className="game-victory-icon">🏆</span>
        <strong>{title}</strong>
        {subtitle && <p>{subtitle}</p>}
        <small>
          {alreadyClaimed
            ? '오늘 보상은 이미 받았어요.'
            : hideClaimButton
              ? '옆 커피 보상 버튼으로 받으세요.'
              : '커피 보상 버튼으로 받으세요.'}
        </small>
        {!hideClaimButton && (
          <VictoryGoldButton
            alreadyClaimed={alreadyClaimed}
            className="game-victory-claim-button"
            rewardKg={rewardKg}
            onClaim={onClaim}
          />
        )}
        {hideClaimButton && !alreadyClaimed && (
          <p className="game-victory-reward-hint">+{rewardText}KG</p>
        )}
      </div>
    </div>
  );
}
