import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CELL_COUNT,
  GRID_COLS,
  MEMORY_DIFFICULTIES,
  createRandomSequence,
  getCellNumber,
  getMemoryDifficulty,
} from '../../services/timedMemoryEngine';
import type { DailyMissions, GameMemoryStats } from '../../services/dailyGameStorage';
import type { MissionKey, StatsUpdatePayload } from '../../hooks/useDailyGame';
import { GameVictoryOverlay } from './GameVictoryOverlay';

const HOW_TO_PLAY = [
  '① 시작하면 아래 12칸 중 특정 칸이 하나씩 노랗게 켜집니다.',
  '② 켜진 순서(1번째 칸 → 2번째 칸 → …)를 기억하세요.',
  '③ 표시가 끝나면 같은 칸을 그 순서대로 누르세요.',
];

function MissionBadge({ done, reward }: { done: boolean; reward: number }) {
  if (done) {
    return <span className="ai-quest-badge done">완료</span>;
  }

  const rewardLabel = reward >= 0.01 ? `+${reward.toFixed(2)}KG` : `+${reward.toFixed(3)}KG`;
  return <span className="ai-quest-badge">{rewardLabel}</span>;
}

function formatSeconds(seconds: number) {
  return `${Math.max(0, seconds)}초`;
}

function MemoryGuide({ emphasize = false }: { emphasize?: boolean }) {
  return (
    <div className={`timed-memory-guide ${emphasize ? 'emphasize' : ''}`}>
      <strong>📖 이렇게 하세요</strong>
      <ol>
        {HOW_TO_PLAY.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <p className="timed-memory-guide-warning">
        ⚠️ 상단 글/그림 순서가 아닙니다. <strong>아래 12칸 격자</strong>에서 번쩍인{' '}
        <strong>칸 위치</strong> 순서입니다!
      </p>
    </div>
  );
}

type TimedMemoryScreenProps = {
  memory: GameMemoryStats;
  daily: DailyMissions;
  onBack: () => void;
  onMessage?: (message: string) => void;
  onStatsUpdate?: (payload: StatsUpdatePayload) => void;
  onReward: (missionKey: MissionKey, reward: number, successMessage?: string) => void;
};

export function TimedMemoryScreen({
  memory,
  daily,
  onBack,
  onMessage,
  onStatsUpdate,
  onReward,
}: TimedMemoryScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'memorize' | 'recall' | 'complete' | 'fail'>('idle');
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIndex, setInputIndex] = useState(0);
  const [flashIndex, setFlashIndex] = useState(-1);
  const [flashStep, setFlashStep] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [wrongCell, setWrongCell] = useState(-1);
  const [victoryPending, setVictoryPending] = useState<{
    missionKey: MissionKey;
    reward: number;
    successMessage: string;
    label: string;
  } | null>(null);
  const timersRef = useRef<number[]>([]);

  const activeDifficulty = getMemoryDifficulty(selectedDifficulty);
  const completedCount = MEMORY_DIFFICULTIES.filter((item) => daily[item.missionKey] >= 1).length;

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (phase !== 'recall') return undefined;

    if (secondsLeft <= 0) {
      setPhase('fail');
      onMessage?.('시간 초과! 번쩍인 칸 순서를 다시 기억해 보세요.');
      finishRun({ success: false });
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, secondsLeft, onMessage]);

  function finishRun({ success }: { success: boolean }) {
    onStatsUpdate?.({
      clearedStage: success
        ? MEMORY_DIFFICULTIES.findIndex((item) => item.id === selectedDifficulty) + 1
        : 0,
      completedAll: success,
      startedNewRun: false,
    });
  }

  function startChallenge(difficultyId: string, options: { fromIdle?: boolean } = {}) {
    const { fromIdle = false } = options;
    const difficulty = getMemoryDifficulty(difficultyId);
    clearTimers();

    if (fromIdle) {
      onStatsUpdate?.({
        clearedStage: memory.bestStage ?? 0,
        completedAll: false,
        startedNewRun: true,
      });
    }

    const nextSequence = createRandomSequence(difficulty.count);
    const flashMs = difficulty.flashMs;

    setSelectedDifficulty(difficultyId);
    setSequence(nextSequence);
    setInputIndex(0);
    setFlashIndex(-1);
    setFlashStep(0);
    setWrongCell(-1);
    setSecondsLeft(difficulty.recallTime);
    setPhase('memorize');
    onMessage?.(`① ${difficulty.count}개 칸이 순서대로 켜집니다. 위치를 기억하세요!`);

    nextSequence.forEach((cellIndex, index) => {
      const showTimer = window.setTimeout(() => {
        setFlashIndex(cellIndex);
        setFlashStep(index + 1);
      }, index * flashMs + 150);

      const hideTimer = window.setTimeout(() => {
        setFlashIndex(-1);
      }, index * flashMs + flashMs);

      timersRef.current.push(showTimer, hideTimer);
    });

    const recallTimer = window.setTimeout(() => {
      setFlashStep(0);
      setPhase('recall');
      onMessage?.(`② 번쩍였던 칸을 1번째부터 순서대로 누르세요! (총 ${difficulty.count}칸)`);
    }, nextSequence.length * flashMs + 550);

    timersRef.current.push(recallTimer);
  }

  function handleCellClick(cellIndex: number) {
    if (phase !== 'recall') return;

    const expected = sequence[inputIndex];
    if (cellIndex !== expected) {
      setWrongCell(cellIndex);
      setPhase('fail');
      onMessage?.(
        `순서가 틀렸어요! ${inputIndex + 1}번째는 ${getCellNumber(expected)}번 칸이었어요.`,
      );
      finishRun({ success: false });
      return;
    }

    const nextInput = inputIndex + 1;
    setInputIndex(nextInput);

    if (nextInput < sequence.length) {
      onMessage?.(`${nextInput + 1}번째 칸을 누르세요. (${nextInput}/${sequence.length} 완료)`);
      return;
    }

    setPhase('complete');
    onMessage?.(`${activeDifficulty.label} 클리어! 훌륭한 기억력이에요.`);
    finishRun({ success: true });
    setVictoryPending({
      missionKey: activeDifficulty.missionKey,
      reward: activeDifficulty.reward,
      successMessage: `${activeDifficulty.label} 순서 기억 성공!`,
      label: activeDifficulty.label,
    });
  }

  function handleRetry() {
    clearTimers();
    if (selectedDifficulty) startChallenge(selectedDifficulty);
  }

  function handleQuitToMenu() {
    clearTimers();
    setSelectedDifficulty(null);
    setPhase('idle');
    setSequence([]);
    setInputIndex(0);
    setFlashIndex(-1);
    setFlashStep(0);
    setWrongCell(-1);
  }

  const phaseBanner = useMemo(() => {
    if (phase === 'memorize' && flashStep > 0) {
      return {
        tone: 'watch',
        title: `👀 지금 ${flashStep}번째로 켜진 칸`,
        text: `총 ${activeDifficulty.count}칸 중 ${flashStep}번째 · 노란 칸 위치를 기억하세요.`,
      };
    }

    if (phase === 'recall') {
      return {
        tone: 'tap',
        title: `👆 ${inputIndex + 1}번째 칸을 누르세요`,
        text: `${inputIndex}/${sequence.length} 완료 · 남은 시간 ${formatSeconds(secondsLeft)}`,
      };
    }

    if (phase === 'memorize') {
      return {
        tone: 'watch',
        title: '👀 곧 순서가 표시됩니다',
        text: '아래 12칸을 주목하세요. 상단이 아니라 격자 칸 순서입니다.',
      };
    }

    return null;
  }, [phase, flashStep, activeDifficulty.count, inputIndex, sequence.length, secondsLeft]);

  const statusText = useMemo(() => {
    if (!selectedDifficulty) return '난이도를 선택하고 순서 기억 챌린지를 시작하세요.';
    if (phase === 'idle') return '준비 중…';
    if (phase === 'complete') return '클리어! 오늘 보상을 확인하세요.';
    if (phase === 'fail') return '실패 · 다시 도전해 보세요.';
    return phaseBanner?.text ?? '';
  }, [selectedDifficulty, phase, phaseBanner]);

  function getClickOrder(cellIndex: number) {
    const orderIndex = sequence.slice(0, inputIndex).indexOf(cellIndex);
    return orderIndex >= 0 ? orderIndex + 1 : null;
  }

  return (
    <main className="goldcat-app">
      <section className="goldcat-phone sub-screen timed-memory-screen">
        <header className="topbar app-style-header">
          <button className="header-icon-button" type="button" onClick={onBack}>
            ‹
          </button>
          <div className="app-title">
            <span>🧠</span>
            <strong>2번 · 순서 기억</strong>
          </div>
        </header>

        <section className="timed-memory-hero">
          <div className="timed-memory-avatar">🧠⏱️☕</div>
          <div>
            <strong>12칸 위치 순서 기억</strong>
            <p>격자에서 번쩍인 칸을 순서대로 누르는 게임입니다.</p>
            <small>3단계 난이도 · 최고 +0.015KG</small>
          </div>
          <div className="timed-memory-meta">
            <span>최고 {memory.bestStage ?? 0}단계</span>
            <span>{completedCount}/3 보상</span>
          </div>
        </section>

        {!selectedDifficulty ? (
          <section className="ai-mission-select">
            <div className="ai-mission-select-title">
              <strong>기억력 난이도 선택</strong>
              <small>클리어하면 난이도마다 하루 1번 미션 보상을 받을 수 있어요.</small>
            </div>

            {MEMORY_DIFFICULTIES.map((difficulty) => {
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
          <section className="timed-memory-panel">
            {(phase === 'memorize' || phase === 'recall') && (
              <MemoryGuide emphasize={phase === 'memorize' || phase === 'recall'} />
            )}

            {phaseBanner && (
              <div className={`timed-memory-phase-banner ${phaseBanner.tone}`}>
                <strong>{phaseBanner.title}</strong>
                <span>{phaseBanner.text}</span>
              </div>
            )}

            <div className="timed-memory-status">
              <strong>
                {activeDifficulty.label} · {activeDifficulty.emoji}
              </strong>
              <span>{statusText}</span>
            </div>

            {phase !== 'idle' && (
              <div className="timed-memory-progress">
                <div
                  className="timed-memory-progress-fill"
                  style={{
                    width:
                      phase === 'recall' && sequence.length > 0
                        ? `${(inputIndex / sequence.length) * 100}%`
                        : phase === 'complete'
                          ? '100%'
                          : phase === 'memorize' && flashStep > 0
                            ? `${(flashStep / activeDifficulty.count) * 100}%`
                            : '0%',
                  }}
                />
              </div>
            )}

            <div className="timed-memory-grid-label">아래 12칸 격자 (4×3)</div>

            <div
              className="timed-memory-grid"
              role="grid"
              aria-label="12칸 기억력 순서 그리드"
              style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
            >
              {Array.from({ length: CELL_COUNT }, (_, cellIndex) => {
                const cellNumber = getCellNumber(cellIndex);
                const isFlashing = flashIndex === cellIndex;
                const isWrong = wrongCell === cellIndex;
                const clickOrder = getClickOrder(cellIndex);

                const classNames = ['timed-memory-cell'];
                if (isFlashing) classNames.push('flash');
                if (clickOrder) classNames.push('done');
                if (isWrong) classNames.push('wrong');

                return (
                  <button
                    className={classNames.join(' ')}
                    disabled={phase !== 'recall'}
                    key={cellIndex}
                    type="button"
                    aria-label={`${cellNumber}번 칸`}
                    onClick={() => handleCellClick(cellIndex)}
                  >
                    {isFlashing && <em className="timed-memory-flash-badge">{flashStep}번째</em>}
                    {clickOrder && <em className="timed-memory-done-badge">✓{clickOrder}</em>}
                    <strong>{cellNumber}</strong>
                    <small>{isFlashing ? '기억!' : clickOrder ? '완료' : '칸'}</small>
                  </button>
                );
              })}
            </div>

            <div className="timed-memory-stage-list">
              {MEMORY_DIFFICULTIES.map((item, index) => (
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

            <div className="timed-memory-actions">
              {(phase === 'fail' || phase === 'complete') && (
                <>
                  <button className="timed-memory-primary" type="button" onClick={handleRetry}>
                    다시 도전
                  </button>
                  <button className="timed-memory-secondary" type="button" onClick={handleQuitToMenu}>
                    난이도 변경
                  </button>
                </>
              )}

              {phase === 'recall' && (
                <button className="timed-memory-secondary" type="button" onClick={handleRetry}>
                  순서 다시 보기
                </button>
              )}

              {phase === 'memorize' && (
                <button className="timed-memory-secondary" disabled type="button">
                  순서 표시 중…
                </button>
              )}
            </div>

            <p className="timed-memory-tip">
              {`${activeDifficulty.count}칸 순서 · 제한 ${activeDifficulty.recallTime}초 · 플레이 ${memory.plays ?? 0}회`}
            </p>
          </section>
        )}
      </section>

      {victoryPending && phase === 'complete' && (
        <GameVictoryOverlay
          alreadyClaimed={daily[victoryPending.missionKey] >= 1}
          rewardKg={victoryPending.reward}
          subtitle={`${victoryPending.label} 순서 기억에 성공했어요!`}
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
