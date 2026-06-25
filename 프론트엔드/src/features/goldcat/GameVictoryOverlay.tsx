type VictoryGoldButtonProps = {
  rewardCups?: number;
  alreadyClaimed?: boolean;
  disabled?: boolean;
  onClaim: () => void;
  className?: string;
};

export function VictoryGoldButton({
  rewardCups = 1,
  alreadyClaimed = false,
  disabled = false,
  onClaim,
  className = '',
}: VictoryGoldButtonProps) {
  return (
    <button
      className={`onboarding-gold-button quest-victory-gold-button ${className}`.trim()}
      disabled={disabled || alreadyClaimed}
      type="button"
      onClick={onClaim}
    >
      <span>☕</span>
      <strong>{alreadyClaimed ? '보상 수령 완료' : '커피 보상 받기'}</strong>
      <small>내린 커피 +{rewardCups}잔</small>
    </button>
  );
}

type VictoryReplayButtonProps = {
  onReplay: () => void;
  needsAd?: boolean;
  disabled?: boolean;
  exhausted?: boolean;
  compact?: boolean;
  className?: string;
};

export function VictoryReplayButton({
  onReplay,
  needsAd = false,
  disabled = false,
  exhausted = false,
  compact = false,
  className = '',
}: VictoryReplayButtonProps) {
  if (compact) {
    return (
      <button
        className={`victory-replay-button victory-replay-button--inline ${needsAd ? 'feed-ad-button' : ''} ${className}`.trim()}
        disabled={disabled || exhausted}
        type="button"
        onClick={onReplay}
      >
        한번 더
      </button>
    );
  }

  return (
    <button
      className={`victory-replay-button ${needsAd ? 'feed-ad-button' : ''} ${className}`.trim()}
      disabled={disabled || exhausted}
      type="button"
      onClick={onReplay}
    >
      <span>🔁</span>
      <strong>{exhausted ? '오늘 종료' : '한번 더'}</strong>
    </button>
  );
}

type GameVictoryOverlayProps = {
  title?: string;
  subtitle?: string;
  rewardCups?: number;
  alreadyClaimed?: boolean;
  onClaim: () => void;
  hideClaimButton?: boolean;
  canReplay?: boolean;
  replayNeedsAd?: boolean;
  replayExhausted?: boolean;
  onReplay?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
};

export function GameVictoryOverlay({
  title = '승리!',
  subtitle,
  rewardCups = 1,
  alreadyClaimed = false,
  onClaim,
  hideClaimButton = false,
  canReplay = false,
  replayNeedsAd = false,
  replayExhausted = false,
  onReplay,
  onDismiss,
  dismissLabel = '난이도 선택',
}: GameVictoryOverlayProps) {
  const showReplay = Boolean(onReplay) && canReplay;

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
        {(showReplay || !hideClaimButton || onDismiss) && (
          <div className="game-victory-actions">
            {!hideClaimButton && (
              <VictoryGoldButton
                alreadyClaimed={alreadyClaimed}
                className="game-victory-claim-button"
                rewardCups={rewardCups}
                onClaim={onClaim}
              />
            )}
            {showReplay && (
              <VictoryReplayButton
                className="game-victory-replay-button"
                needsAd={replayNeedsAd}
                onReplay={onReplay!}
              />
            )}
            {onDismiss && (alreadyClaimed || replayExhausted || !showReplay) && (
              <button className="game-victory-dismiss-button" type="button" onClick={onDismiss}>
                {dismissLabel}
              </button>
            )}
          </div>
        )}
        {hideClaimButton && !alreadyClaimed && !showReplay && !onDismiss && (
          <p className="game-victory-reward-hint">내린 커피 +{rewardCups}잔</p>
        )}
      </div>
    </div>
  );
}
