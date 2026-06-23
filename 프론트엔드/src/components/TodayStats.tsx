import { SELL_BATCH_REWARD, SELL_BATCH_SIZE } from '../game/constants';
import { formatWon } from '../game/utils';
import './TodayStats.css';

type TodayStatsProps = {
  totalWaters: number;
  totalCoffees: number;
  money: number;
  lastEarned: number | null;
};

export function TodayStats({ totalWaters, totalCoffees, money, lastEarned }: TodayStatsProps) {
  return (
    <section className="today-stats">
      <h3 className="today-stats__title">오늘 기록</h3>
      <dl className="today-stats__grid">
        <div>
          <dt>물 준 횟수</dt>
          <dd>{totalWaters}회</dd>
        </div>
        <div>
          <dt>내린 커피</dt>
          <dd>{totalCoffees}잔</dd>
        </div>
        <div>
          <dt>누적 수익</dt>
          <dd>{formatWon(money)}</dd>
        </div>
        <div>
          <dt>{SELL_BATCH_SIZE}잔 판매</dt>
          <dd>{formatWon(SELL_BATCH_REWARD)}</dd>
        </div>
      </dl>
      {lastEarned !== null && (
        <p className="today-stats__earn">방금 +{formatWon(lastEarned)} 판매!</p>
      )}
    </section>
  );
}
