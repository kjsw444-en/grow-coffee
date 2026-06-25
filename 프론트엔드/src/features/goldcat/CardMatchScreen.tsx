import { useEffect, useMemo, useState } from 'react';
import { useMinigameSound } from '../../audio/useMinigameSound';
import {
  PAIR_DIFFICULTIES,
  createPairBoard,
  getPairDifficulty,
  type PairCard,
} from '../../services/pairMatchEngine';
import type { DailyMissions } from '../../services/dailyGameStorage';
import type { MinigameRewardSlot, MissionKey } from '../../services/dailyGamePlayQuota';
import { countMissionsCompleteFromStatus, isMissionCompleteFromStatus, PAIR_MISSION_KEYS } from '../../services/dailyGamePlayQuota';
import type { StatsUpdatePayload } from '../../hooks/useDailyGame';
import { formatMinigameRewardLabel, getMinigameRewardCups } from '../../services/minigameReward';
import { MissionSelectRow } from './MissionSelectRow';
import { GameVictoryOverlay } from './GameVictoryOverlay';
import { MinigameCoverMissionSelect, MinigameCoverPanel } from './MinigameCoverPanel';

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

type CardMatchScreenProps = {
  daily: DailyMissions;
  pairMatch: { plays: number; wins: number; bestStage: number };
  onBack: () => void;
  onMessage?: (message: string) => void;
  onReward: (missionKey: MissionKey, successMessage?: string, rewardSlot?: MinigameRewardSlot) => void;
  onStatsUpdate?: (payload: StatsUpdatePayload) => void;
  getMissionPlayStatus: (missionKey: MissionKey) => import('../../services/dailyGamePlayQuota').MissionPlayStatus;
  beginMissionAttempt: (missionKey: MissionKey) => Promise<boolean>;
  canClaimMissionReward: (missionKey: MissionKey, rewardSlot: MinigameRewardSlot) => boolean;
  getAttemptRewardSlot: (
    status: import('../../services/dailyGamePlayQuota').MissionPlayStatus,
  ) => MinigameRewardSlot;
};

export function CardMatchScreen({
  daily,
  pairMatch,
  onBack,
  onMessage,
  onReward,
  onStatsUpdate,
  getMissionPlayStatus,
  beginMissionAttempt,
  canClaimMissionReward,
  getAttemptRewardSlot,
}: CardMatchScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [attemptRewardSlot, setAttemptRewardSlot] = useState<MinigameRewardSlot>('free');
  const [rewardClaimedThisSession, setRewardClaimedThisSession] = useState(false);
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
  const completedCount = countMissionsCompleteFromStatus(daily, PAIR_MISSION_KEYS, getMissionPlayStatus);
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
  }, [phase, secondsLeft, onMessage, onStatsUpdate, playMinigameSound, activeDifficulty]);

  function startChallengeInternal(difficultyId: string, options: { trackNewRun?: boolean } = {}) {
    const { trackNewRun = false } = options;
    const difficulty = getPairDifficulty(difficultyId);

    if (trackNewRun) {
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
    setRewardClaimedThisSession(false);
    setSecondsLeft(difficulty.timeLimit);
    setPhase('playing');
    onMessage?.(`${difficulty.label} · ${difficulty.description}`);
  }

  async function tryStartChallenge(difficultyId: string, options: { trackNewRun?: boolean } = {}) {
    const difficulty = getPairDifficulty(difficultyId);
    const playStatus = getMissionPlayStatus(difficulty.missionKey);
    const rewardSlot = getAttemptRewardSlot(playStatus);
    const allowed = await beginMissionAttempt(difficulty.missionKey);
    if (!allowed) return;
    setAttemptRewardSlot(rewardSlot);
    startChallengeInternal(difficultyId, options);
  }

  async function handleReplayAfterVictory() {
    if (!selectedDifficulty) return;
    setVictoryPending(null);
    setRewardClaimedThisSession(false);
    await tryStartChallenge(selectedDifficulty, { trackNewRun: false });
  }

  async function handleRetry() {
    if (!selectedDifficulty) return;
    await tryStartChallenge(selectedDifficulty, { trackNewRun: false });
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
    setVictoryPending(null);
    setRewardClaimedThisSession(false);
    setSelectedDifficulty(null);
    setPhase('idle');
    setCards([]);
    setFlippedIds([]);
    setIsLocked(false);
  }

  function handleForfeit() {
    if (!activeDifficulty) return;

    void playMinigameSound('minigameLose');
    onMessage?.('기권했어요. 오늘 이 난이도 플레이는 완료 처리됐어요.');
    quitToMenu();
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

    quitToMenu();
  }

  function handleBack() {
    if (!selectedDifficulty) {
      onBack();
      return;
    }

    if (phase === 'playing') {
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

    quitToMenu();
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

  const activePlayStatus = activeDifficulty ? getMissionPlayStatus(activeDifficulty.missionKey) : null;
  const canRetryAfterResult = activePlayStatus?.state === 'ad_required';
  const showRetryActions = canRetryAfterResult && (phase === 'fail' || phase === 'complete');

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

        <MinigameCoverPanel
          className="card-match-hero"
          compact={Boolean(selectedDifficulty)}
          controls={
            !selectedDifficulty ? (
              <MinigameCoverMissionSelect
                hint="난이도마다 하루 1회 무료 · 광고 시청 시 1회 추가 · 게임 중 뒤로가기도 횟수 사용"
                title="카드 난이도 선택"
              >
                {PAIR_DIFFICULTIES.map((difficulty) => {
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
                      onStart={() => tryStartChallenge(difficulty.id, { trackNewRun: true })}
                    />
                  );
                })}
              </MinigameCoverMissionSelect>
            ) : null
          }
          gameId="pair"
          withControls={!selectedDifficulty}
          header={
            <>
              <div className="minigame-cover-hero__intro">
                <strong>기억력 카드 매칭</strong>
                <p>같은 그림 2장을 시간 안에 모두 찾으세요.</p>
                <small>4단계 난이도 · 극악버전 +3잔 · 그 외 +1잔</small>
              </div>
              <div className="card-match-meta">
                <span>최고 {pairMatch.bestStage ?? 0}단계</span>
                <span>{completedCount}/{PAIR_MISSION_KEYS.length} 완료</span>
              </div>
            </>
          }
          body={
            <div className="card-match-meta">
              <span>최고 {pairMatch.bestStage ?? 0}단계</span>
              <span>{completedCount}/{PAIR_MISSION_KEYS.length} 완료</span>
            </div>
          }
        />

        {selectedDifficulty ? (
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

            <div className="card-match-actions">
              {(phase === 'fail' || phase === 'complete') && (
                <>
                  {phase === 'fail' && (
                    showRetryActions ? (
                      <button
                        className="feed-ad-button card-match-primary"
                        type="button"
                        onClick={() => void handleRetry()}
                      >
                        한번 더
                      </button>
                    ) : (
                      <button className="card-match-primary" type="button" disabled>
                        오늘 횟수 소진
                      </button>
                    )
                  )}
                  <button
                    className="card-match-secondary"
                    type="button"
                    onClick={requestQuitToMenu}
                  >
                    난이도 변경
                  </button>
                </>
              )}

            </div>

            <p className="card-match-tip">
              {`${activeDifficulty.pairCount}쌍 · 제한 ${activeDifficulty.timeLimit}초 · 플레이 ${pairMatch.plays ?? 0}회`}
            </p>
          </section>
        ) : null}
      </section>

      {victoryPending && phase === 'complete' && (
        <GameVictoryOverlay
          alreadyClaimed={
            Boolean(victoryRewardClaimed)
          }
          canReplay={showRetryActions}
          replayExhausted={!showRetryActions}
          replayNeedsAd
          rewardCups={getMinigameRewardCups(victoryPending.missionKey)}
          subtitle={`${victoryPending.label} 카드 짝 맞추기에 성공했어요!`}
          title="승리!"
          onClaim={handleClaimVictory}
          onReplay={() => void handleReplayAfterVictory()}
          onDismiss={requestQuitToMenu}
        />
      )}
    </main>
  );
}
