import { useButtonSound } from '../audio/SoundProvider';
import { COFFEE_RANKING_SIZE, type CoffeeRankingView } from '../services/coffeeRanking';
import './RankingSheet.css';

type RankingSheetProps = {
  ranking: CoffeeRankingView | null;
  loading?: boolean;
  onClose: () => void;
};

export function RankingSheet({ ranking, loading = false, onClose }: RankingSheetProps) {
  const buttonSound = useButtonSound();

  const handleClose = async () => {
    await buttonSound();
    onClose();
  };

  return (
    <div className="ranking-sheet" role="dialog" aria-modal="true" aria-labelledby="ranking-sheet-title">
      <button type="button" className="ranking-sheet__backdrop" onClick={() => void handleClose()} aria-label="닫기" />
      <div className="ranking-sheet__panel">
        <div className="ranking-sheet__head">
          <h2 id="ranking-sheet-title">비운 커피잔 랭킹 TOP{COFFEE_RANKING_SIZE}</h2>
          <button type="button" className="ranking-sheet__close" onClick={() => void handleClose()}>
            닫기
          </button>
        </div>

        <p className="ranking-sheet__note">
          상점에서 사용한 커피잔 누적 기준
          {ranking && (
            <>
              {' · '}
              {ranking.live ? '실시간 전국 랭킹' : '오프라인 미리보기'}
            </>
          )}
        </p>

        {loading || !ranking ? (
          <p className="ranking-sheet__status">랭킹을 불러오는 중...</p>
        ) : (
          <>
            <p className="ranking-sheet__mine">
              내 순위 <strong>{ranking.playerRank}위</strong> · 비운 커피잔{' '}
              <strong>{ranking.playerSpentCoffeeCups}잔</strong>
              {!ranking.inTop50 && ' · TOP50 밖'}
            </p>

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
