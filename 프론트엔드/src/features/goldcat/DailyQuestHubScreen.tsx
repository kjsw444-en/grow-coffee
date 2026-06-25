import {
  DAILY_GAMES,
  getDailyRecommendedGame,
  getGameRecordLabel,
  type DailyGameId,
} from '../../services/dailyGamePick';
import type { DailyMissions, GameMemoryStats } from '../../services/dailyGameStorage';
import type { DailyPlayQuotas } from '../../services/dailyGamePlayQuota';
import {
  countMissionsCompleteToday,
  MEMORY_MISSION_KEYS,
  OMOK_MISSION_KEYS,
  PAIR_MISSION_KEYS,
} from '../../services/dailyGamePlayQuota';
import { MinigameCoverImage } from './MinigameCoverImage';

type DailyQuestHubScreenProps = {
  daily: DailyMissions;
  memory: GameMemoryStats;
  playQuotas: DailyPlayQuotas;
  farmerName?: string;
  onBack: () => void;
  onSelectGame: (gameId: DailyGameId) => void;
  onMessage?: (message: string) => void;
};

export function DailyQuestHubScreen({
  daily,
  memory,
  playQuotas,
  farmerName = '커피 농부',
  onBack,
  onSelectGame,
}: DailyQuestHubScreenProps) {
  const recommendedGame = getDailyRecommendedGame();

  const completedMissions =
    countMissionsCompleteToday(daily, playQuotas, OMOK_MISSION_KEYS) +
    countMissionsCompleteToday(daily, playQuotas, MEMORY_MISSION_KEYS) +
    countMissionsCompleteToday(daily, playQuotas, PAIR_MISSION_KEYS);
  const totalMissions = OMOK_MISSION_KEYS.length + MEMORY_MISSION_KEYS.length + PAIR_MISSION_KEYS.length;

  function handleSelect(gameId: DailyGameId) {
    onSelectGame(gameId);
  }

  return (
    <main className="goldcat-app">
      <section className="goldcat-phone sub-screen daily-quest-hub">
        <header className="topbar app-style-header">
          <button className="header-icon-button" type="button" onClick={onBack}>
            ‹
          </button>
          <div className="app-title">
            <span>🎯</span>
            <strong>1일1게임</strong>
          </div>
        </header>

        <section className="daily-quest-hub-hero">
          <div className="daily-quest-hub-avatar">🎯☕</div>
          <div>
            <strong>
              오늘의 추천 · {recommendedGame.number}번 {recommendedGame.title}
            </strong>
            <p>
              {farmerName} · 커피 농부 · 두뇌 훈련
            </p>
            <small>난이도마다 하루 1회 무료 · 광고 1회 추가 · 매일 갱신</small>
          </div>
          <div className="daily-quest-hub-meta">
            <span>{completedMissions}/{totalMissions} 완료</span>
            <span>매일 갱신</span>
          </div>
        </section>

        <section className="daily-quest-records">
          <strong>내 기록</strong>
          {DAILY_GAMES.map((game) => (
            <article key={game.id}>
              <span>{game.icon}</span>
              <div>
                <strong>
                  {game.number}번 {game.title}
                </strong>
                <small>{getGameRecordLabel(game.id, memory)}</small>
              </div>
            </article>
          ))}
        </section>

        <section className="daily-quest-game-list">
          {DAILY_GAMES.map((game) => (
            <button
              className={`daily-quest-game-button daily-quest-game-button--overlay ${recommendedGame.id === game.id ? 'recommended' : ''}`}
              key={game.id}
              type="button"
              onClick={() => handleSelect(game.id)}
            >
              <div className="daily-quest-game-cover-wrap daily-quest-game-cover-wrap--overlay">
                <MinigameCoverImage gameId={game.id} variant="thumb" />
                <div className="daily-quest-game-overlay">
                  {recommendedGame.id === game.id && (
                    <span className="daily-quest-recommended-badge">오늘의 추천</span>
                  )}
                  <span className="daily-quest-game-number">{game.number}</span>
                  <div className="daily-quest-game-top">
                    <div className="daily-quest-game-copy">
                      <strong>
                        {game.number}번 · {game.title}
                      </strong>
                      <small>{game.subtitle}</small>
                      <small className="daily-quest-game-reward">{game.reward}</small>
                    </div>
                    <span className="daily-quest-game-badge">{game.progress(daily, playQuotas)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </section>
      </section>
    </main>
  );
}
