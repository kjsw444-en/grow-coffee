import { useEffect, useMemo, useRef, useState } from 'react';
import { useMinigameSound } from '../../audio/useMinigameSound';
import {
  BLACK,
  BOARD_SIZE,
  EMPTY,
  WHITE,
  checkWin,
  createEmptyBoard,
  getAiMove,
  isValidMove,
  placeStone,
  type Board,
  type Move,
  type OmokDifficulty,
} from '../../services/omokEngine';
import type { DailyMissions } from '../../services/dailyGameStorage';
import type { MissionKey, StatsUpdatePayload } from '../../hooks/useDailyGame';
import { VictoryGoldButton } from './GameVictoryOverlay';

const DIFFICULTIES = [
  {
    id: 'easy' as OmokDifficulty,
    label: '쉬움',
    emoji: '🌱',
    missionKey: 'mission1' as MissionKey,
    stage: 1,
    reward: 0.005,
    moveTimeLimit: 20,
    description: 'AI가 실수를 자주 해요 · 한 수 20초',
  },
  {
    id: 'medium' as OmokDifficulty,
    label: '중간',
    emoji: '⚡',
    missionKey: 'mission2' as MissionKey,
    stage: 2,
    reward: 0.01,
    moveTimeLimit: 15,
    description: '위협을 읽고 막아요 · 한 수 15초',
  },
  {
    id: 'hard' as OmokDifficulty,
    label: '어려움',
    emoji: '🔥',
    missionKey: 'mission3' as MissionKey,
    stage: 3,
    reward: 0.015,
    moveTimeLimit: 12,
    description: '강한 AI · 한 수 12초',
  },
  {
    id: 'nightmare' as OmokDifficulty,
    label: '불가능',
    emoji: '💀',
    missionKey: 'mission4' as MissionKey,
    stage: 4,
    reward: 0.02,
    moveTimeLimit: 8,
    description: '전설급 AI · 한 수 8초 · +0.02KG',
  },
];

const STAR_POINTS: [number, number][] = [
  [3, 3],
  [3, 7],
  [3, 11],
  [7, 3],
  [7, 7],
  [7, 11],
  [11, 3],
  [11, 7],
  [11, 11],
];

function MissionBadge({ done, reward }: { done: boolean; reward: number }) {
  if (done) {
    return <span className="ai-quest-badge done">완료</span>;
  }

  const rewardLabel = reward >= 0.01 ? `+${reward.toFixed(2)}KG` : `+${reward.toFixed(3)}KG`;
  return <span className="ai-quest-badge">{rewardLabel}</span>;
}

function OmokBoard({
  board,
  lastMove,
  disabled,
  onCellClick,
}: {
  board: Board;
  lastMove: Move | null;
  disabled: boolean;
  onCellClick: (row: number, col: number) => void;
}) {
  return (
    <div className="omok-board-wrap">
      <div className="omok-board-frame">
        <div className="omok-board-surface" style={{ ['--omok-span' as string]: BOARD_SIZE - 1 }}>
          <div className="omok-grid-layer" aria-hidden="true" />

          {STAR_POINTS.map(([row, col]) => (
            <span
              className="omok-star-point"
              key={`star-${row}-${col}`}
              style={{ ['--omok-x' as string]: col, ['--omok-y' as string]: row }}
            />
          ))}

          <div className="omok-intersections" role="grid" aria-label="오목판">
            {board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const isLast = lastMove?.row === rowIndex && lastMove?.col === colIndex;
                const stoneClass = cell === BLACK ? 'black' : cell === WHITE ? 'white' : null;

                return (
                  <button
                    className="omok-intersection"
                    disabled={disabled || cell !== EMPTY}
                    key={`${rowIndex}-${colIndex}`}
                    style={{ ['--omok-col' as string]: colIndex, ['--omok-row' as string]: rowIndex }}
                    type="button"
                    aria-label={`${rowIndex + 1}행 ${colIndex + 1}열`}
                    onClick={() => onCellClick(rowIndex, colIndex)}
                  >
                    {stoneClass && (
                      <span className={`omok-stone ${stoneClass}${isLast ? ' last-move' : ''}`} />
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type DailyQuestScreenProps = {
  daily: DailyMissions;
  farmerName?: string;
  onBack: () => void;
  onReward: (missionKey: MissionKey, reward: number, successMessage?: string) => void;
  onMessage?: (message: string) => void;
  onStatsUpdate?: (payload: StatsUpdatePayload) => void;
  onWatchAd?: () => Promise<boolean> | boolean;
};

export function DailyQuestScreen({
  daily,
  farmerName = '커피 농부',
  onBack,
  onReward,
  onMessage,
  onStatsUpdate,
  onWatchAd,
}: DailyQuestScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<OmokDifficulty | null>(null);
  const [board, setBoard] = useState(createEmptyBoard);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [gameStatus, setGameStatus] = useState<'playing' | 'win' | 'lose'>('playing');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [loseReason, setLoseReason] = useState<'timeout' | 'ai' | 'forfeit' | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(0);
  const [victoryPending, setVictoryPending] = useState<{
    missionKey: MissionKey;
    reward: number;
    successMessage: string;
    label: string;
  } | null>(null);
  const [rewardClaimedThisSession, setRewardClaimedThisSession] = useState(false);
  const aiTurnLockRef = useRef(false);
  const playMinigameSound = useMinigameSound();

  const completedCount = [daily.mission1, daily.mission2, daily.mission3, daily.mission4].filter(Boolean).length;
  const activeDifficulty = DIFFICULTIES.find((item) => item.id === selectedDifficulty);

  const statusText = useMemo(() => {
    if (!selectedDifficulty) return '난이도를 선택하고 AI와 오목 대결을 시작하세요.';
    if (isAiThinking) return 'AI가 다음 수를 계산 중이에요…';
    if (gameStatus === 'win') return '승리! 커피 농부가 기분 좋게 박수를 쳐요.';
    if (gameStatus === 'lose' && loseReason === 'timeout') return '시간 초과 패배… 한 수 안에 두지 못했어요.';
    if (gameStatus === 'lose' && loseReason === 'forfeit') return '기권 패배… 다시 도전해 보세요.';
    if (gameStatus === 'lose') return '패배… 다시 도전해서 AI를 이겨보세요.';
    return `흑돌(●) 먼저 · 한 수 ${activeDifficulty?.moveTimeLimit ?? 0}초 안에 두세요.`;
  }, [selectedDifficulty, isAiThinking, gameStatus, loseReason, activeDifficulty?.moveTimeLimit]);

  useEffect(() => {
    if (!selectedDifficulty || gameStatus !== 'playing' || aiTurnLockRef.current) return undefined;

    const blackCount = board.flat().filter((cell) => cell === BLACK).length;
    const whiteCount = board.flat().filter((cell) => cell === WHITE).length;

    if (blackCount === 0 || whiteCount >= blackCount) return undefined;

    aiTurnLockRef.current = true;
    setIsAiThinking(true);

    const thinkDelay = selectedDifficulty === 'nightmare' ? 950 : 450;

    const timer = window.setTimeout(() => {
      setBoard((currentBoard) => {
        const nextBoard = currentBoard.map((row) => [...row]);
        const [row, col] = getAiMove(nextBoard, selectedDifficulty);
        nextBoard[row][col] = WHITE;
        setLastMove({ row, col });

        if (checkWin(nextBoard, row, col, WHITE)) {
          setGameStatus('lose');
          setLoseReason('ai');
          void playMinigameSound('minigameLose');
          onMessage?.('AI가 5목을 완성했어요. 다시 도전해 보세요!');
        } else {
          void playMinigameSound('stonePlaceAi');
        }

        return nextBoard;
      });

      setIsAiThinking(false);
      aiTurnLockRef.current = false;
    }, thinkDelay);

    return () => window.clearTimeout(timer);
  }, [board, selectedDifficulty, gameStatus, onMessage, playMinigameSound]);

  useEffect(() => {
    if (!selectedDifficulty || gameStatus !== 'playing' || isAiThinking) return undefined;

    const limit = activeDifficulty?.moveTimeLimit ?? 15;
    let secondsLeft = limit;
    setTurnSecondsLeft(secondsLeft);

    const interval = window.setInterval(() => {
      secondsLeft -= 1;
      setTurnSecondsLeft(secondsLeft);

      if (secondsLeft <= 0) {
        window.clearInterval(interval);
        setLoseReason('timeout');
        setGameStatus('lose');
        void playMinigameSound('minigameLose');
        onMessage?.('시간 초과! AI에게 패배했어요.');
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [board, isAiThinking, gameStatus, selectedDifficulty, activeDifficulty, onMessage, playMinigameSound]);

  function resetToDifficultySelect() {
    setSelectedDifficulty(null);
    setBoard(createEmptyBoard());
    setLastMove(null);
    setGameStatus('playing');
    setIsAiThinking(false);
    setLoseReason(null);
    setTurnSecondsLeft(0);
    setVictoryPending(null);
    setRewardClaimedThisSession(false);
    aiTurnLockRef.current = false;
  }

  function startGame(difficultyId: OmokDifficulty) {
    const difficulty = DIFFICULTIES.find((item) => item.id === difficultyId);
    if (!difficulty) return;

    setSelectedDifficulty(difficultyId);
    setBoard(createEmptyBoard());
    setLastMove(null);
    setGameStatus('playing');
    setIsAiThinking(false);
    setLoseReason(null);
    setTurnSecondsLeft(difficulty.moveTimeLimit);
    setVictoryPending(null);
    setRewardClaimedThisSession(false);
    aiTurnLockRef.current = false;
    onStatsUpdate?.({
      clearedStage: difficulty.stage,
      completedAll: false,
      startedNewRun: true,
    });
    onMessage?.(`${difficulty.label} AI와 오목 대결 · 한 수 ${difficulty.moveTimeLimit}초`);
  }

  function resetGame() {
    if (!selectedDifficulty) return;
    startGame(selectedDifficulty);
  }

  function handleBack() {
    if (selectedDifficulty && gameStatus === 'playing') {
      void playMinigameSound('minigameLose');
      onMessage?.('기권 패배… 다시 도전해 보세요.');
      resetToDifficultySelect();
      return;
    }

    if (selectedDifficulty) {
      resetToDifficultySelect();
      return;
    }

    onBack();
  }

  function handleCellClick(row: number, col: number) {
    if (!selectedDifficulty || gameStatus !== 'playing' || isAiThinking) return;
    if (!isValidMove(board, row, col)) return;

    void playMinigameSound('stonePlace');

    const nextBoard = board.map((boardRow) => [...boardRow]);
    placeStone(nextBoard, row, col, BLACK);
    setLastMove({ row, col });

    if (checkWin(nextBoard, row, col, BLACK)) {
      setBoard(nextBoard);
      setGameStatus('win');
      void playMinigameSound('win');

      const difficulty = DIFFICULTIES.find((item) => item.id === selectedDifficulty)!;
      setVictoryPending({
        missionKey: difficulty.missionKey,
        reward: difficulty.reward,
        successMessage: `${difficulty.label} AI 오목 승리!`,
        label: difficulty.label,
      });

      onStatsUpdate?.({
        clearedStage: difficulty.stage,
        completedAll: true,
        startedNewRun: false,
      });
      return;
    }

    setBoard(nextBoard);
  }

  const victoryRewardClaimed =
    victoryPending && (rewardClaimedThisSession || daily[victoryPending.missionKey] >= 1);

  const needsAdForReplay = gameStatus === 'win' && victoryPending && Boolean(victoryRewardClaimed);

  function handleClaimVictory() {
    if (!victoryPending || victoryRewardClaimed) {
      onMessage?.('오늘 이 미션 보상은 이미 받았어요.');
      return;
    }

    onReward(victoryPending.missionKey, victoryPending.reward, victoryPending.successMessage);
    setRewardClaimedThisSession(true);
  }

  async function handleAdReplay() {
    if (!selectedDifficulty) return;

    const watched = await onWatchAd?.();
    if (watched === false) return;

    onMessage?.('같은 난이도로 다시 도전해요.');
    setVictoryPending(null);
    setRewardClaimedThisSession(false);
    startGame(selectedDifficulty);
  }

  return (
    <main className="goldcat-app">
      <section className="goldcat-phone sub-screen ai-quest-screen omok-screen">
        <header className="topbar app-style-header">
          <button className="header-icon-button" type="button" onClick={handleBack}>
            ‹
          </button>
          <div className="app-title">
            <span>⚫</span>
            <strong>1번 · AI 오목</strong>
          </div>
        </header>

        <section
          className={`ai-quest-hero${gameStatus === 'win' && victoryPending ? ' ai-quest-hero--victory' : ''}`}
        >
          <div className="ai-quest-cat-stage">
            <span className="ai-quest-farmer-avatar" aria-hidden="true">
              {gameStatus === 'win' ? '🎉☕' : '☕🌱'}
            </span>
            {gameStatus === 'win' && victoryPending && (
              <VictoryGoldButton
                alreadyClaimed={Boolean(victoryRewardClaimed)}
                rewardKg={victoryPending.reward}
                onClaim={handleClaimVictory}
              />
            )}
          </div>
          <div>
            <strong>{farmerName}와 함께하는 AI 오목</strong>
            <p>
              커피 농부 · {BOARD_SIZE}×{BOARD_SIZE} · 5목 승리
            </p>
            <small>
              {gameStatus === 'win' && victoryPending
                ? `${victoryPending.label} AI 승리! 옆 커피 보상 버튼으로 받으세요.`
                : '나무 바둑판 · 난이도마다 한 수 시간 제한'}
            </small>
          </div>
          <div className="ai-quest-meta">
            <span>{completedCount}/4 완료</span>
            <span>{selectedDifficulty ? activeDifficulty?.label : '난이도 선택'}</span>
          </div>
        </section>

        {!selectedDifficulty ? (
          <section className="ai-mission-select">
            <div className="ai-mission-select-title">
              <strong>AI 난이도 선택</strong>
              <small>승리하면 난이도마다 하루 1번 미션 보상을 받을 수 있어요.</small>
            </div>

            {DIFFICULTIES.map((difficulty) => {
              const done = daily[difficulty.missionKey] >= 1;

              return (
                <button
                  className={`ai-mission-select-button ${done ? 'done' : ''} ${
                    difficulty.id === 'nightmare' ? 'nightmare' : ''
                  }`}
                  key={difficulty.id}
                  type="button"
                  onClick={() => startGame(difficulty.id)}
                >
                  <span className="ai-mission-select-icon">{difficulty.emoji}</span>
                  <div className="ai-mission-select-copy">
                    <strong>{difficulty.label} AI</strong>
                    <small>{difficulty.description}</small>
                  </div>
                  <MissionBadge done={done} reward={difficulty.reward} />
                </button>
              );
            })}
          </section>
        ) : (
          <section className="tab-panel ai-quest-panel omok-panel">
            <div className="omok-status-bar">
              <strong>
                {activeDifficulty!.label} · {activeDifficulty!.emoji}
              </strong>
              <span>{statusText}</span>
            </div>

            <div className="omok-legend">
              <span className="omok-legend-item">
                <i className="omok-legend-stone black" aria-hidden="true" />
                나
              </span>
              <span className="omok-legend-item">
                <i className="omok-legend-stone white" aria-hidden="true" />
                AI
              </span>
            </div>

            <OmokBoard
              board={board}
              disabled={gameStatus !== 'playing' || isAiThinking}
              lastMove={lastMove}
              onCellClick={handleCellClick}
            />

            {gameStatus === 'win' && victoryPending && (
              <div className="omok-victory-banner" aria-live="polite">
                <span>🏆</span>
                <strong>{victoryPending.label} AI 승리!</strong>
                <small>
                  {victoryRewardClaimed
                    ? '오늘 보상은 받았어요. 한 번 더 도전해요.'
                    : '옆 커피 보상 버튼으로 받으세요.'}
                </small>
              </div>
            )}

            <div className="omok-actions">
              {needsAdForReplay ? (
                <button className="feed-ad-button omok-ad-replay-button" type="button" onClick={handleAdReplay}>
                  다시 도전
                </button>
              ) : (
                <button className="ai-primary-button" type="button" onClick={resetGame}>
                  다시 두기
                </button>
              )}
              <button className="omok-secondary-button" type="button" onClick={resetToDifficultySelect}>
                난이도 변경
              </button>
            </div>

            {gameStatus === 'playing' && !isAiThinking && (
              <div
                className={`omok-turn-timer ${turnSecondsLeft <= 3 ? 'urgent' : ''}`}
                aria-live="polite"
              >
                <div className="omok-turn-timer-head">
                  <strong>내 턴</strong>
                  <span>{turnSecondsLeft}초</span>
                </div>
                <div className="omok-turn-timer-bar">
                  <div
                    style={{
                      width: `${Math.max(
                        0,
                        (turnSecondsLeft / (activeDifficulty?.moveTimeLimit ?? 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {gameStatus === 'playing' && isAiThinking && (
              <div className="omok-turn-timer ai-turn">
                <strong>AI 생각 중…</strong>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
