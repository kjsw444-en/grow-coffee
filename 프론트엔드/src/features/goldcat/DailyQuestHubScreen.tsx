import { DAILY_GAMES, getDailyRecommendedGame, getGameRecordLabel } from '../../services/dailyGamePick';
import type { DailyMissions, GameMemoryStats } from '../../services/dailyGameStorage';
import type { DailyGameId } from '../../services/dailyGamePick';

type DailyQuestHubScreenProps = {
  daily: DailyMissions;
  memory: GameMemoryStats;
  farmerName?: string;
  onBack: () => void;
  onSelectGame: (gameId: DailyGameId) => void;
  onMessage?: (message: string) => void;
};

export function DailyQuestHubScreen({
  daily,
  memory,
  farmerName = '커피 농부',
  onBack,
  onSelectGame,
  onMessage,
}: DailyQuestHubScreenProps) {
  const recommendedGame = getDailyRecommendedGame();

  const completedRewards = [
    [daily.mission1, daily.mission2, daily.mission3, daily.mission4].some((value) => value >= 1),
    [daily.memoryMission1, daily.memoryMission2, daily.memoryMission3].some((value) => value >= 1),
    [daily.pairMission1, daily.pairMission2, daily.pairMission3].some((value) => value >= 1),
  ].filter(Boolean).length;

  function handleSelect(gameId: DailyGameId) {
    onMessage?.('미션을 시작합니다.');
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
            <small>추천 게임부터 시작하면 오늘 루틴이 더 쉬워져요.</small>
          </div>
          <div className="daily-quest-hub-meta">
            <span>보상 {completedRewards}/3</span>
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
              className={`daily-quest-game-button ${recommendedGame.id === game.id ? 'recommended' : ''}`}
              key={game.id}
              type="button"
              onClick={() => handleSelect(game.id)}
            >
              {recommendedGame.id === game.id && (
                <span className="daily-quest-recommended-badge">오늘의 추천</span>
              )}
              <span className="daily-quest-game-number">{game.number}</span>
              <span className="daily-quest-game-icon">{game.icon}</span>
              <div className="daily-quest-game-copy">
                <strong>
                  {game.number}번 · {game.title}
                </strong>
                <small>{game.subtitle}</small>
                <small className="daily-quest-game-reward">{game.reward}</small>
              </div>
              <span className="daily-quest-game-badge">{game.progress(daily)}</span>
            </button>
          ))}
        </section>
      </section>
    </main>
  );
}
