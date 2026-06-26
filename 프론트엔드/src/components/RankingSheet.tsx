import { useButtonSound } from '../audio/SoundProvider';
import { COFFEE_RANKING_SIZE, type CoffeeRankingView } from '../services/coffeeRanking';
import type { RankingTop3RewardStatus } from '../services/api';
import { formatRankingRewardDate } from '../game/rankingRewardUi';
import {
  formatRankingTop3PromotionAmount,
  getRankingTop3AlreadyClaimedMessage,
  getRankingTop3ClaimPromptMessage,
} from '../services/rankingTop3Promotion';
import './RankingSheet.css';

type RankingSheetProps = {
  ranking: CoffeeRankingView | null;
  loading?: boolean;
  error?: string | null;
  rewardStatus?: RankingTop3RewardStatus | null;
  claimingReward?: boolean;
  onClaimTop3Reward?: () => void;
  onClose: () => void;
};

export function RankingSheet({
  ranking,
  loading = false,
  error = null,
  rewardStatus = null,
  claimingReward = false,
  onClaimTop3Reward,
  onClose,
}: RankingSheetProps) {
  const buttonSound = useButtonSound();
  const canClaimTop3Reward = Boolean(rewardStatus?.canClaim && onClaimTop3Reward);
  const rewardAlreadyClaimed = Boolean(rewardStatus?.claimed);

  const handleClose = async () => {
    await buttonSound();
    onClose();
  };

  const handleClaimReward = async () => {
    await buttonSound();
    onClaimTop3Reward?.();
  };

  return (
    <div className="ranking-sheet" role="dialog" aria-modal="true" aria-labelledby="ranking-sheet-title">
      <button type="button" className="ranking-sheet__backdrop" onClick={() => void handleClose()} aria-label="닫기" />
      <div className="ranking-sheet__panel">
        <div className="ranking-sheet__head">
          <h2 id="ranking-sheet-title">오늘의 커피 랭킹 TOP{COFFEE_RANKING_SIZE}</h2>
          <button type="button" className="ranking-sheet__close" onClick={() => void handleClose()}>
            닫기
          </button>
        </div>

        <p className="ranking-sheet__note">
          매일 0시에 초기화 · 오늘 받은 내린 커피 기준
          {ranking && (
            <>
              {' · '}
              {ranking.live ? '실시간 전국 랭킹' : '오프라인 미리보기'}
              {ranking.dayKey ? ` · ${ranking.dayKey}` : ''}
            </>
          )}
        </p>

        <section className="ranking-sheet__promo" aria-label="랭킹 프로모션 안내">
          <div className="ranking-sheet__promo-head">
            <span className="ranking-sheet__promo-badge">PROMOTION</span>
            <strong>1위~3위 매일 토스 포인트 지급</strong>
          </div>
          <p className="ranking-sheet__promo-copy">
            8월 1일까지 매일 랭킹 마감 후 상위 3명에게 토스 포인트{' '}
            <strong>{formatRankingTop3PromotionAmount()}원</strong>을 지급해요. 게임 상단 커피값과는
            별개예요.
          </p>
          <ul className="ranking-sheet__promo-list">
            <li>대상: 전날 밤 12시 마감 랭킹 1위~3위</li>
            <li>수령: 마감 다음날 「토스로 받기」 버튼</li>
            <li>지급: 토스 앱 → 포인트로 {formatRankingTop3PromotionAmount()}원</li>
            <li>당일 실시간 TOP3는 경쟁용이며, 보상은 마감 순위 기준</li>
          </ul>
        </section>

        {canClaimTop3Reward && rewardStatus?.playerRank && (
          <section className="ranking-sheet__reward" aria-label="랭킹 보상">
            <p className="ranking-sheet__reward-copy">
              {formatRankingRewardDate(rewardStatus.rewardDayKey)} 마감{' '}
              {getRankingTop3ClaimPromptMessage(rewardStatus.playerRank)}
            </p>
            <button
              type="button"
              className="ranking-sheet__reward-button ranking-sheet__reward-button--pulse"
              disabled={claimingReward}
              onClick={() => void handleClaimReward()}
            >
              {claimingReward
                ? '토스 지급 중...'
                : `토스로 ${formatRankingTop3PromotionAmount()}원 받기`}
            </button>
          </section>
        )}

        {error && !loading && (
          <p className="ranking-sheet__error" role="status">
            {error}
          </p>
        )}

        {loading || !ranking ? (
          <p className="ranking-sheet__status">랭킹을 불러오는 중...</p>
        ) : (
          <>
            <p className="ranking-sheet__mine">
              내 순위 <strong>{ranking.playerRank}위</strong> · 오늘 받은 내린 커피{' '}
              <strong>{ranking.playerSpentCoffeeCups}잔</strong>
              {!ranking.inTop50 && ' · TOP50 밖'}
            </p>

            {rewardAlreadyClaimed && rewardStatus?.playerRank && (
              <p className="ranking-sheet__claimed" role="status">
                {formatRankingRewardDate(rewardStatus.rewardDayKey)}{' '}
                {getRankingTop3AlreadyClaimedMessage(rewardStatus.playerRank)}
              </p>
            )}

            <ol className="ranking-sheet__list">
              {ranking.top50.map((entry) => (
                <li
                  key={entry.id}
                  className={`ranking-sheet__row ${entry.isPlayer ? 'ranking-sheet__row--player' : ''}`}
                >
                  <span className="ranking-sheet__rank">{entry.rank}</span>
                  <strong className="ranking-sheet__name">
                    {entry.isPlayer ? `${entry.name} (나)` : entry.name}
                  </strong>
                  <em className="ranking-sheet__score">{entry.spentCoffeeCups}잔</em>
                </li>
              ))}
            </ol>

            <p className="ranking-sheet__total">참여 {ranking.totalPlayers}명</p>
          </>
        )}
      </div>
    </div>
  );
}
