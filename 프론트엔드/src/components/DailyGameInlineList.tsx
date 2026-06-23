import { DAILY_GAMES, getDailyRecommendedGame, type DailyGameId } from '../services/dailyGamePick';
import './ComicSeriesInlineList.css';

type DailyGameInlineListProps = {
  onSelect: (gameId: DailyGameId) => void;
};

export function DailyGameInlineList({ onSelect }: DailyGameInlineListProps) {
  const recommendedId = getDailyRecommendedGame().id;

  return (
    <div className="recommend-comic-series-list" role="list" aria-label="1일 1게임">
      {DAILY_GAMES.map((game) => (
        <button
          key={game.id}
          type="button"
          className="recommend-comic-series-item"
          role="listitem"
          onClick={() => onSelect(game.id)}
        >
          <span className="recommend-comic-series-item__badge">
            {game.id === recommendedId ? '오늘 추천' : `${game.number}번`}
          </span>
          <strong>{game.title}</strong>
          <small>{game.subtitle}</small>
          <span className="recommend-comic-series-item__count">{game.reward}</span>
        </button>
      ))}
    </div>
  );
}
