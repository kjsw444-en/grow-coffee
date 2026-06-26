import { useButtonSound } from '../audio/SoundProvider';
import { formatRankingRewardDate } from '../game/rankingRewardUi';
import {
  formatRankingTop3PromotionAmount,
  getRankingTop3ClaimPromptMessage,
} from '../services/rankingTop3Promotion';
import type { RankingTop3RewardStatus } from '../services/api';
import './RankingRewardAlertModal.css';

type RankingRewardAlertModalProps = {
  status: RankingTop3RewardStatus;
  claiming?: boolean;
  onClaim: () => void;
  onOpenRanking: () => void;
  onDismiss: () => void;
};

export function RankingRewardAlertModal({
  status,
  claiming = false,
  onClaim,
  onOpenRanking,
  onDismiss,
}: RankingRewardAlertModalProps) {
  const buttonSound = useButtonSound();
  const rankLabel = status.playerRank ?? 0;

  const handleClaim = async () => {
    await buttonSound();
    onClaim();
  };

  const handleOpenRanking = async () => {
    await buttonSound();
    onOpenRanking();
  };

  const handleDismiss = async () => {
    await buttonSound();
    onDismiss();
  };

  return (
    <div
      className="ranking-reward-alert"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ranking-reward-alert-title"
    >
      <div className="ranking-reward-alert__card">
        <span className="ranking-reward-alert__badge">RANKING REWARD</span>
        <h2 id="ranking-reward-alert-title" className="ranking-reward-alert__title">
          토스 랭킹 보상이 도착했어요!
        </h2>
        <p className="ranking-reward-alert__body">
          {formatRankingRewardDate(status.rewardDayKey)} 마감 랭킹 <strong>{rankLabel}위</strong> 축하해요.
          <br />
          {getRankingTop3ClaimPromptMessage(rankLabel)}
        </p>
        <p className="ranking-reward-alert__hint">
          받기를 누르면 토스 앱으로{' '}
          <span className="ranking-reward-alert__amount">{formatRankingTop3PromotionAmount()}원</span>이 지급돼요.
        </p>
        <button
          type="button"
          className="ranking-reward-alert__claim"
          disabled={claiming}
          onClick={() => void handleClaim()}
        >
          {claiming ? '토스 지급 중...' : `토스로 ${formatRankingTop3PromotionAmount()}원 받기`}
        </button>
        <button type="button" className="ranking-reward-alert__secondary" onClick={() => void handleOpenRanking()}>
          랭킹에서 확인하기
        </button>
        <button type="button" className="ranking-reward-alert__dismiss" onClick={() => void handleDismiss()}>
          닫기
        </button>
      </div>
    </div>
  );
}
