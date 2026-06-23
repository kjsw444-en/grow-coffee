import { useEffect, useMemo, useState } from 'react';
import { useMinigameSound } from '../../audio/useMinigameSound';
import {
  PAIR_DIFFICULTIES,
  createPairBoard,
  getPairDifficulty,
  type PairCard,
} from '../../services/pairMatchEngine';
import type { DailyMissions } from '../../services/dailyGameStorage';
import type { MissionKey, StatsUpdatePayload } from '../../hooks/useDailyGame';
import { GameVictoryOverlay } from './GameVictoryOverlay';

function MissionBadge({ done, reward }: { done: boolean; reward: number }) {
  if (done) {
    return <span className="ai-quest-badge done">완료</span>;
  }

  const rewardLabel = reward >= 0.01 ? `+${reward.toFixed(2)}KG` : `+${reward.toFixed(3)}KG`;
  return <span className="ai-quest-badge">{rewardLabel}</span>;
}

type CardMatchScreenProps = {
  daily: DailyMissions;
  pairMatch: { plays: number; wins: number; bestStage: number };
  onBack: () => void;
  onMessage?: (message: string) => void;
  onReward: (missionKey: MissionKey, reward: number, successMessage?: string) => void;
  onStatsUpdate?: (payload: StatsUpdatePayload) => void;
};

export function CardMatchScreen({
  daily,
  pairMatch,
  onBack,
  onMessage,
  onReward,
  onStatsUpdate,
}: CardMatchScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'complete' | 'fail'>('idle');
  const [cards, setCards] = useState<PairCard[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [victoryPending, setVictoryPending] = useState<{
    missionKey: MissionKey;
    reward: number;
    successMessage: string;
    label: string;
  } | null>(null);
  const [moves, setMoves] = useState(0);
  const playMinigameSound = useMinigameSound();

  const activeDifficulty = getPairDifficulty(selectedDifficulty);
  const completedCount = PAIR_DIFFICULTIES.filter((item) => daily[item.missionKey] >= 1).length;
  const matchedCount = cards.filter((card) => card.matched).length;
  const totalPairs = activeDifficulty.pairCount;
  const boardCols = Math.min(4, Math.ceil(cards.length / 3) || 3);

  useEffect(() => {
    if (phase !== 'playing') return undefined;

    if (secondsLeft <= 0) {
      setPhase('fail');
      void playMinigameSound('minigameLose');
      onMessage?.('시간 초과! 카드 위치를 기억하는 연습을 다시 해보세요.');
      onStatsUpdate?.({
        clearedStage: 0,
        completedAll: false,
        startedNewRun: false,
      });
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, secondsLeft, onMessage, onStatsUpdate, playMinigameSound]);

  function startChallenge(difficultyId: string, options: { fromIdle?: boolean } = {}) {
    const { fromIdle = false } = options;
    const difficulty = getPairDifficulty(difficultyId);

    if (fromIdle) {
      onStatsUpdate?.({
        clearedStage: pairMatch.bestStage ?? 0,
        completedAll: false,
        startedNewRun: true,
      });
    }

    setSelectedDifficulty(difficultyId);
    setCards(createPairBoard(difficulty.pairCount));
    setFlippedIds([]);
    setIsLocked(false);
    setMoves(0);
    setSecondsLeft(difficulty.timeLimit);
    setPhase('playing');
    onMessage?.(`${difficulty.label} · ${difficulty.description}`);
  }

  function finishChallenge({ success }: { success: boolean }) {
    onStatsUpdate?.({
      clearedStage: success
        ? PAIR_DIFFICULTIES.findIndex((item) => item.id === selectedDifficulty) + 1
        : 0,
      completedAll: success,
      startedNewRun: false,
    });

    if (success) {
      setVictoryPending({
        missionKey: activeDifficulty.missionKey,
        reward: activeDifficulty.reward,
        successMessage: `${activeDifficulty.label} 카드 짝 맞추기 성공!`,
        label: activeDifficulty.label,
      });
    }
  }

  function handleCardClick(cardId: string) {
    if (phase !== 'playing' || isLocked) return;

    const selected = cards.find((card) => card.id === cardId);
    if (!selected || selected.matched || flippedIds.includes(cardId)) return;

    const nextFlipped = [...flippedIds, cardId];
    setFlippedIds(nextFlipped);
    void playMinigameSound('cardFlip');

    if (nextFlipped.length < 2) return;

    setIsLocked(true);
    const nextMoves = moves + 1;
    setMoves(nextMoves);

    const [firstId, secondId] = nextFlipped;
    const firstCard = cards.find((card) => card.id === firstId)!;
    const secondCard = cards.find((card) => card.id === secondId)!;

    if (firstCard.icon === secondCard.icon) {
      const nextCards = cards.map((card) =>
        card.icon === firstCard.icon ? { ...card, matched: true } : card,
      );
      setCards(nextCards);
      setFlippedIds([]);
      setIsLocked(false);

      if (nextCards.every((card) => card.matched)) {
        setPhase('complete');
        void playMinigameSound('win');
        onMessage?.(`${activeDifficulty.label} 클리어! 기억력이 훌륭해요.`);
        finishChallenge({ success: true });
      } else {
        void playMinigameSound('cardMatch');
        onMessage?.('짝을 맞췄어요!');
      }

      return;
    }

    void playMinigameSound('cardMismatch');
    onMessage?.('다른 카드예요. 위치를 기억해보세요.');
    window.setTimeout(() => {
      setFlippedIds([]);
      setIsLocked(false);
    }, 650);
  }

  function quitToMenu() {
    setSelectedDifficulty(null);
    setPhase('idle');
    setCards([]);
    setFlippedIds([]);
    setIsLocked(false);
  }

  function handleBack() {
    if (selectedDifficulty && phase === 'playing') {
      onStatsUpdate?.({
        clearedStage: 0,
        completedAll: false,
        startedNewRun: false,
      });
      void playMinigameSound('minigameLose');
      onMessage?.('기권 패배…');
      quitToMenu();
      return;
    }

    if (selectedDifficulty) {
      quitToMenu();
      return;
    }

    onBack();
  }

  const statusText = useMemo(() => {
    if (!selectedDifficulty) return '난이도를 선택하고 카드 짝 맞추기를 시작하세요.';
    if (phase === 'playing') {
      return `${matchedCount / 2}/${totalPairs}쌍 · ${moves}번 뒤집음 · ${secondsLeft}초`;
    }
    if (phase === 'complete') return '클리어! 오늘 보상을 확인하세요.';
    if (phase === 'fail') return '실패 · 다시 도전해 보세요.';
    return '';
  }, [selectedDifficulty, phase, matchedCount, totalPairs, moves, secondsLeft]);

  return (
    <main className="goldcat-app">
      <section className="goldcat-phone sub-screen card-match-screen">
        <header className="topbar app-style-header">
          <button className="header-icon-button" type="button" onClick={handleBack}>
            ‹
          </button>
          <div className="app-title">
            <span>🃏</span>
            <strong>3번 · 카드 짝 맞추기</strong>
          </div>
        </header>

        <section className="card-match-hero">
          <div className="card-match-avatar">🃏⏱️☕</div>
          <div>
            <strong>기억력 카드 매칭</strong>
            <p>같은 그림 2장을 시간 안에 모두 찾으세요.</p>
            <small>3단계 난이도 · 최고 +0.015KG</small>
          </div>
          <div className="card-match-meta">
            <span>최고 {pairMatch.bestStage ?? 0}단계</span>
            <span>{completedCount}/3 보상</span>
          </div>
        </section>

        {!selectedDifficulty ? (
          <section className="ai-mission-select">
            <div className="ai-mission-select-title">
              <strong>카드 난이도 선택</strong>
              <small>클리어하면 난이도마다 하루 1번 미션 보상을 받을 수 있어요.</small>
            </div>

            {PAIR_DIFFICULTIES.map((difficulty) => {
              const done = daily[difficulty.missionKey] >= 1;

              return (
                <button
                  className={`ai-mission-select-button ${done ? 'done' : ''}`}
                  key={difficulty.id}
                  type="button"
                  onClick={() => startChallenge(difficulty.id, { fromIdle: true })}
                >
                  <span className="ai-mission-select-icon">{difficulty.emoji}</span>
                  <div className="ai-mission-select-copy">
                    <strong>{difficulty.label}</strong>
                    <small>{difficulty.description}</small>
                  </div>
                  <MissionBadge done={done} reward={difficulty.reward} />
                </button>
              );
            })}
          </section>
        ) : (
          <section className="card-match-panel">
            <div className="card-match-status">
              <strong>
                {activeDifficulty.label} · {activeDifficulty.emoji}
              </strong>
              <span>{statusText}</span>
            </div>

            {phase === 'playing' && (
              <div className="card-match-progress">
                <div
                  className="card-match-progress-fill"
                  style={{ width: `${totalPairs > 0 ? (matchedCount / 2 / totalPairs) * 100 : 0}%` }}
                />
              </div>
            )}

            {cards.length > 0 ? (
              <div className={`card-match-board cols-${boardCols}`}>
                {cards.map((card) => {
                  const isOpen = card.matched || flippedIds.includes(card.id);

                  return (
                    <button
                      className={`card-match-tile ${isOpen ? 'open' : ''} ${card.matched ? 'matched' : ''}`}
                      disabled={phase !== 'playing' || card.matched || isLocked}
                      key={card.id}
                      type="button"
                      onClick={() => handleCardClick(card.id)}
                    >
                      <span>{isOpen ? card.icon : '❔'}</span>
                      <strong>{card.matched ? '완료' : isOpen ? '확인' : '뒤집기'}</strong>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="card-match-empty">게임 시작을 누르면 카드가 펼쳐집니다</div>
            )}

            <div className="card-match-stage-list">
              {PAIR_DIFFICULTIES.map((item, index) => (
                <span
                  className={
                    daily[item.missionKey] >= 1
                      ? 'done'
                      : item.id === selectedDifficulty && phase !== 'idle'
                        ? 'active'
                        : ''
                  }
                  key={item.id}
                  title={item.label}
                >
                  {index + 1}
                </span>
              ))}
            </div>

            <div className="card-match-actions">
              {(phase === 'fail' || phase === 'complete') && (
                <>
                  <button
                    className="card-match-primary"
                    type="button"
                    onClick={() => startChallenge(selectedDifficulty)}
                  >
                    다시 도전
                  </button>
                  <button
                    className="card-match-secondary"
                    type="button"
                    onClick={quitToMenu}
                  >
                    난이도 변경
                  </button>
                </>
              )}

              {phase === 'playing' && (
                <button
                  className="card-match-secondary"
                  type="button"
                  onClick={() => startChallenge(selectedDifficulty)}
                >
                  이 난이도 다시
                </button>
              )}
            </div>

            <p className="card-match-tip">
              {`${activeDifficulty.pairCount}쌍 · 제한 ${activeDifficulty.timeLimit}초 · 플레이 ${pairMatch.plays ?? 0}회`}
            </p>
          </section>
        )}
      </section>

      {victoryPending && phase === 'complete' && (
        <GameVictoryOverlay
          alreadyClaimed={daily[victoryPending.missionKey] >= 1}
          rewardKg={victoryPending.reward}
          subtitle={`${victoryPending.label} 카드 짝 맞추기에 성공했어요!`}
          title="승리!"
          onClaim={() => {
            if (daily[victoryPending.missionKey] < 1) {
              onReward(
                victoryPending.missionKey,
                victoryPending.reward,
                victoryPending.successMessage,
              );
            }
            setVictoryPending(null);
          }}
        />
      )}
    </main>
  );
}
