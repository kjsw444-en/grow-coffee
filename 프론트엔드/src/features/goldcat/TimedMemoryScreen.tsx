import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMinigameSound } from '../../audio/useMinigameSound';
import {
  CELL_COUNT,
  GRID_COLS,
  MEMORY_DIFFICULTIES,
  createRandomSequence,
  getCellNumber,
  getMemoryDifficulty,
} from '../../services/timedMemoryEngine';
import type { DailyMissions, GameMemoryStats } from '../../services/dailyGameStorage';
import type { MinigameRewardSlot, MissionKey } from '../../services/dailyGamePlayQuota';
import { countMissionsCompleteFromStatus, isMissionCompleteFromStatus, MEMORY_MISSION_KEYS } from '../../services/dailyGamePlayQuota';
import type { StatsUpdatePayload } from '../../hooks/useDailyGame';
import { formatMinigameRewardLabel, getMinigameRewardCups } from '../../services/minigameReward';
import { MissionSelectRow } from './MissionSelectRow';
import { VictoryGoldButton, VictoryReplayButton } from './GameVictoryOverlay';
import { MinigameCoverMissionSelect, MinigameCoverPanel } from './MinigameCoverPanel';

const HOW_TO_PLAY = [
  '① 시작하면 아래 12칸 중 특정 칸이 하나씩 노랗게 켜집니다.',
  '② 켜진 순서(1번째 칸 → 2번째 칸 → …)를 기억하세요.',
  '③ 표시가 끝나면 같은 칸을 그 순서대로 누르세요.',
];

function MissionBadge({
  rewardClaimed,
  attempted,
  missionKey,
}: {
  rewardClaimed: boolean;
  attempted: boolean;
  missionKey: MissionKey;
}) {
  if (rewardClaimed || attempted) {
    return <span className="ai-quest-badge done">완료</span>;
  }

  return <span className="ai-quest-badge">{formatMinigameRewardLabel(getMinigameRewardCups(missionKey))}</span>;
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
  onReward: (missionKey: MissionKey, successMessage?: string, rewardSlot?: MinigameRewardSlot) => void;
  getMissionPlayStatus: (missionKey: MissionKey) => import('../../services/dailyGamePlayQuota').MissionPlayStatus;
  beginMissionAttempt: (missionKey: MissionKey) => Promise<boolean>;
  canClaimMissionReward: (missionKey: MissionKey, rewardSlot: MinigameRewardSlot) => boolean;
  getAttemptRewardSlot: (
    status: import('../../services/dailyGamePlayQuota').MissionPlayStatus,
  ) => MinigameRewardSlot;
};

export function TimedMemoryScreen({
  memory,
  daily,
  onBack,
  onMessage,
  onStatsUpdate,
  onReward,
  getMissionPlayStatus,
  beginMissionAttempt,
  canClaimMissionReward,
  getAttemptRewardSlot,
}: TimedMemoryScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [attemptRewardSlot, setAttemptRewardSlot] = useState<MinigameRewardSlot>('free');
  const [rewardClaimedThisSession, setRewardClaimedThisSession] = useState(false);
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
  const runIdRef = useRef(0);
  const sequenceRef = useRef<number[]>([]);
  const onMessageRef = useRef(onMessage);
  const finishRunRef = useRef<(payload: { success: boolean }) => void>(() => {});
  const overlayScrollSnapshotRef = useRef(0);
  const playMinigameSound = useMinigameSound();

  const activeDifficulty = getMemoryDifficulty(selectedDifficulty);
  const completedCount = countMissionsCompleteFromStatus(daily, MEMORY_MISSION_KEYS, getMissionPlayStatus);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence]);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  useEffect(() => () => clearTimers(), []);

  const finishRun = useCallback(
    ({ success }: { success: boolean }) => {
      onStatsUpdate?.({
        clearedStage: success
          ? MEMORY_DIFFICULTIES.findIndex((item) => item.id === selectedDifficulty) + 1
          : 0,
        completedAll: success,
        startedNewRun: false,
      });
    },
    [onStatsUpdate, selectedDifficulty],
  );

  useEffect(() => {
    finishRunRef.current = finishRun;
  }, [finishRun]);

  useEffect(() => {
    if (phase !== 'recall' || !selectedDifficulty) return undefined;

    const recallSeconds = getMemoryDifficulty(selectedDifficulty).recallTime;
    const deadline = Date.now() + recallSeconds * 1000;
    let expired = false;

    const syncCountdown = () => {
      if (expired) return;

      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);

      if (left <= 0) {
        expired = true;
        setPhase('fail');
        void playMinigameSound('minigameLose');
        onMessageRef.current?.('시간 초과! 번쩍인 칸 순서를 다시 기억해 보세요.');
        finishRunRef.current({ success: false });
      }
    };

    syncCountdown();
    const interval = window.setInterval(syncCountdown, 250);

    return () => window.clearInterval(interval);
  }, [phase, selectedDifficulty, playMinigameSound]);

  useEffect(() => {
    if (phase === 'memorize' && flashIndex >= 0) {
      void playMinigameSound('memoryFlash');
    }
  }, [flashIndex, phase, playMinigameSound]);

  const prevPhaseRef = useRef(phase);

  useLayoutEffect(() => {
    if (prevPhaseRef.current === phase) return;
    prevPhaseRef.current = phase;

    const overlay = document.querySelector('.goldcat-feature-overlay');
    if (!(overlay instanceof HTMLElement)) return;

    const savedScrollTop = overlayScrollSnapshotRef.current;
    overlay.scrollTop = savedScrollTop;
    requestAnimationFrame(() => {
      overlay.scrollTop = savedScrollTop;
    });
  }, [phase]);

  useEffect(() => {
    const overlay = document.querySelector('.goldcat-feature-overlay');
    if (!(overlay instanceof HTMLElement)) return;

    const saveScroll = () => {
      overlayScrollSnapshotRef.current = overlay.scrollTop;
    };

    overlay.addEventListener('scroll', saveScroll, { passive: true });
    return () => overlay.removeEventListener('scroll', saveScroll);
  }, [selectedDifficulty]);

  function prepareDifficulty(difficultyId: string) {
    runIdRef.current += 1;
    clearTimers();
    setVictoryPending(null);
    setRewardClaimedThisSession(false);
    setSelectedDifficulty(difficultyId);
    setPhase('idle');
    setSequence([]);
    setInputIndex(0);
    setFlashIndex(-1);
    setFlashStep(0);
    setWrongCell(-1);
    setSecondsLeft(0);
    sequenceRef.current = [];
  }

  function startChallengeInternal(difficultyId: string, options: { trackNewRun?: boolean } = {}) {
    const { trackNewRun = false } = options;
    const difficulty = getMemoryDifficulty(difficultyId);
    clearTimers();

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    if (trackNewRun) {
      onStatsUpdate?.({
        clearedStage: memory.bestStage ?? 0,
        completedAll: false,
        startedNewRun: true,
      });
    }

    const nextSequence = createRandomSequence(difficulty.count);
    const flashMs = difficulty.flashMs;

    sequenceRef.current = nextSequence;
    setSequence(nextSequence);
    setInputIndex(0);
    setFlashIndex(-1);
    setFlashStep(0);
    setWrongCell(-1);
    setRewardClaimedThisSession(false);
    setSecondsLeft(difficulty.recallTime);
    setPhase('memorize');

    nextSequence.forEach((cellIndex, index) => {
      const showTimer = window.setTimeout(() => {
        if (runIdRef.current !== runId) return;
        setFlashIndex(cellIndex);
        setFlashStep(index + 1);
      }, index * flashMs + 150);

      const hideTimer = window.setTimeout(() => {
        if (runIdRef.current !== runId) return;
        setFlashIndex(-1);
      }, index * flashMs + flashMs);

      timersRef.current.push(showTimer, hideTimer);
    });

    const recallTimer = window.setTimeout(() => {
      if (runIdRef.current !== runId) return;
      setFlashIndex(-1);
      setFlashStep(0);
      setPhase('recall');
      setSecondsLeft(difficulty.recallTime);
    }, nextSequence.length * flashMs + 550);

    timersRef.current.push(recallTimer);
  }

  async function handleStartGame() {
    if (!selectedDifficulty || phase !== 'idle') return;
    await tryStartChallenge(selectedDifficulty, { trackNewRun: true });
  }

  async function tryStartChallenge(difficultyId: string, options: { trackNewRun?: boolean } = {}) {
    const difficulty = getMemoryDifficulty(difficultyId);
    const playStatus = getMissionPlayStatus(difficulty.missionKey);
    const rewardSlot = getAttemptRewardSlot(playStatus);
    const allowed = await beginMissionAttempt(difficulty.missionKey);
    if (!allowed) return;
    setAttemptRewardSlot(rewardSlot);
    startChallengeInternal(difficultyId, options);
  }

  async function handleReplayAfterVictory() {
    clearTimers();
    if (!selectedDifficulty) return;
    setVictoryPending(null);
    setRewardClaimedThisSession(false);
    await tryStartChallenge(selectedDifficulty, { trackNewRun: false });
  }

  async function handleRetry() {
    clearTimers();
    if (!selectedDifficulty) return;
    await tryStartChallenge(selectedDifficulty, { trackNewRun: false });
  }

  function handleCellClick(cellIndex: number) {
    if (phase !== 'recall') return;

    const activeSequence = sequenceRef.current;
    const expected = activeSequence[inputIndex];
    if (cellIndex !== expected) {
      setWrongCell(cellIndex);
      setPhase('fail');
      void playMinigameSound('memoryWrong');
      onMessage?.(
        `순서가 틀렸어요! ${inputIndex + 1}번째는 ${getCellNumber(expected)}번 칸이었어요.`,
      );
      finishRun({ success: false });
      return;
    }

    void playMinigameSound('memoryTap');

    const nextInput = inputIndex + 1;
    setInputIndex(nextInput);

    if (nextInput < activeSequence.length) {
      return;
    }

    setPhase('complete');
    void playMinigameSound('win');
    onMessage?.(`${activeDifficulty.label} 클리어! 훌륭한 기억력이에요.`);
    finishRun({ success: true });
    setVictoryPending({
      missionKey: activeDifficulty.missionKey,
      reward: activeDifficulty.reward,
      successMessage: `${activeDifficulty.label} 순서 기억 성공!`,
      label: activeDifficulty.label,
    });
  }

  function handleQuitToMenu() {
    runIdRef.current += 1;
    setVictoryPending(null);
    setRewardClaimedThisSession(false);
    clearTimers();
    setSelectedDifficulty(null);
    setPhase('idle');
    setSequence([]);
    setInputIndex(0);
    setFlashIndex(-1);
    setFlashStep(0);
    setWrongCell(-1);
    sequenceRef.current = [];
  }

  function handleForfeit() {
    if (!activeDifficulty) return;

    clearTimers();
    finishRun({ success: false });
    void playMinigameSound('minigameLose');
    onMessage?.('기권했어요. 오늘 이 난이도 플레이는 완료 처리됐어요.');
    handleQuitToMenu();
  }

  const victoryRewardClaimed =
    victoryPending &&
    (rewardClaimedThisSession ||
      !canClaimMissionReward(victoryPending.missionKey, attemptRewardSlot));

  function handleClaimVictory() {
    if (!victoryPending || victoryRewardClaimed) {
      onMessage?.('오늘 이 미션 보상은 이미 받았어요.');
      return;
    }

    onReward(victoryPending.missionKey, victoryPending.successMessage, attemptRewardSlot);
    setRewardClaimedThisSession(true);
  }

  function requestQuitToMenu() {
    if (phase === 'complete' && victoryPending && !victoryRewardClaimed) {
      onMessage?.('커피 보상을 먼저 받아 주세요.');
      return;
    }

    handleQuitToMenu();
  }

  function handleBack() {
    if (!selectedDifficulty) {
      onBack();
      return;
    }

    if (phase === 'memorize' || phase === 'recall') {
      handleForfeit();
      return;
    }

    if (phase === 'complete' && victoryPending && !victoryRewardClaimed) {
      onMessage?.('커피 보상을 먼저 받아 주세요.');
      return;
    }

    if (phase !== 'idle') {
      requestQuitToMenu();
      return;
    }

    handleQuitToMenu();
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
    if (phase === 'idle') return '준비 완료 · 시작 버튼을 누르면 순서 표시가 시작됩니다.';
    if (phase === 'complete') return '클리어! 오늘 보상을 확인하세요.';
    if (phase === 'fail') return '실패 · 다시 도전해 보세요.';
    return phaseBanner?.text ?? '';
  }, [selectedDifficulty, phase, phaseBanner]);

  function getClickOrder(cellIndex: number) {
    const orderIndex = sequence.slice(0, inputIndex).indexOf(cellIndex);
    return orderIndex >= 0 ? orderIndex + 1 : null;
  }

  const activePlayStatus = activeDifficulty ? getMissionPlayStatus(activeDifficulty.missionKey) : null;
  const canRetryAfterResult = activePlayStatus?.state === 'ad_required';
  const showRetryActions = canRetryAfterResult && (phase === 'fail' || phase === 'complete');

  return (
    <main className="goldcat-app">
      <section className="goldcat-phone sub-screen timed-memory-screen">
        <header className="topbar app-style-header">
          <button className="header-icon-button" type="button" onClick={handleBack}>
            ‹
          </button>
          <div className="app-title">
            <span>🧠</span>
            <strong>2번 · 순서 기억</strong>
          </div>
        </header>

        <MinigameCoverPanel
          className="timed-memory-hero"
          compact={Boolean(selectedDifficulty)}
          controls={
            !selectedDifficulty ? (
              <MinigameCoverMissionSelect
                hint="난이도마다 하루 1회 무료 · 광고 시청 시 1회 추가 · 게임 중 뒤로가기도 횟수 사용"
                title="기억력 난이도 선택"
              >
                {MEMORY_DIFFICULTIES.map((difficulty) => {
                  const rewardClaimed = daily[difficulty.missionKey] >= 1;
                  const playStatus = getMissionPlayStatus(difficulty.missionKey);
                  const attempted = playStatus.state !== 'free_available';

                  return (
                    <MissionSelectRow
                      key={difficulty.id}
                      description={difficulty.description}
                      icon={difficulty.emoji}
                      playStatus={playStatus}
                      rewardBadge={
                        <MissionBadge
                          attempted={attempted}
                          missionKey={difficulty.missionKey}
                          rewardClaimed={rewardClaimed}
                        />
                      }
                      rewardClaimed={rewardClaimed}
                      title={difficulty.label}
                      onStart={() => prepareDifficulty(difficulty.id)}
                    />
                  );
                })}
              </MinigameCoverMissionSelect>
            ) : null
          }
          gameId="sequence"
          overlay={
            phase === 'complete' && victoryPending ? (
              <>
                <VictoryGoldButton
                  alreadyClaimed={Boolean(victoryRewardClaimed)}
                  className="timed-memory-victory-claim"
                  rewardCups={getMinigameRewardCups(victoryPending.missionKey)}
                  onClaim={handleClaimVictory}
                />
                <VictoryReplayButton
                  className="timed-memory-victory-replay"
                  exhausted={!showRetryActions}
                  needsAd
                  onReplay={() => void handleReplayAfterVictory()}
                />
              </>
            ) : null
          }
          victory={phase === 'complete' && Boolean(victoryPending)}
          withControls={!selectedDifficulty}
          header={
            <>
              <div className="minigame-cover-hero__intro">
                <strong>12칸 위치 순서 기억</strong>
                <p>격자에서 번쩍인 칸을 순서대로 누르는 게임입니다.</p>
                <small>
                  {phase === 'complete' && victoryPending
                    ? `${victoryPending.label} 클리어! 표지 위 커피 보상 버튼으로 받으세요.`
                    : '4단계 난이도 · 극악버전 +3잔 · 그 외 +1잔'}
                </small>
              </div>
              <div className="timed-memory-meta">
                <span>최고 {memory.bestStage ?? 0}단계</span>
                <span>{completedCount}/{MEMORY_MISSION_KEYS.length} 완료</span>
              </div>
            </>
          }
          body={
            <div className="timed-memory-meta">
              <span>최고 {memory.bestStage ?? 0}단계</span>
              <span>{completedCount}/{MEMORY_MISSION_KEYS.length} 완료</span>
            </div>
          }
        />

        {selectedDifficulty ? (
          <section className="timed-memory-panel">
            {(phase === 'idle' || phase === 'memorize' || phase === 'recall') && (
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
                    isMissionCompleteFromStatus(daily, item.missionKey, getMissionPlayStatus(item.missionKey))
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

            <div className={`timed-memory-actions ${phase === 'idle' ? 'timed-memory-actions--prep' : ''}`}>
              {phase === 'idle' && (
                <>
                  <button
                    className="timed-memory-primary timed-memory-primary--start"
                    type="button"
                    onClick={() => void handleStartGame()}
                  >
                    시작
                  </button>
                  <button className="timed-memory-secondary" type="button" onClick={requestQuitToMenu}>
                    난이도 변경
                  </button>
                </>
              )}

              {(phase === 'fail' || phase === 'complete') && (
                <>
                  {phase === 'fail' && (
                    showRetryActions ? (
                      <button
                        className="feed-ad-button timed-memory-primary"
                        type="button"
                        onClick={() => void handleRetry()}
                      >
                        한번 더
                      </button>
                    ) : (
                      <button className="timed-memory-primary" type="button" disabled>
                        오늘 횟수 소진
                      </button>
                    )
                  )}
                  <button className="timed-memory-secondary" type="button" onClick={requestQuitToMenu}>
                    난이도 변경
                  </button>
                </>
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
        ) : null}
      </section>
    </main>
  );
}
