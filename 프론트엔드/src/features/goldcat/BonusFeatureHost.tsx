import { lazy, Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MissionKey, MinigameRewardSlot } from '../../services/dailyGamePlayQuota';
import type { DailyGameId } from '../../services/dailyGamePick';
import { watchRewardedAd } from '../../services/rewardedAd';
import { useDailyGame } from '../../hooks/useDailyGame';
import { getMinigameRewardCups } from '../../services/minigameReward';
import type { ComicInitialTarget } from './StoryComicScreen';
import './goldcat-features.css';

const StoryComicScreen = lazy(() =>
  import('./StoryComicScreen').then((module) => ({ default: module.StoryComicScreen })),
);
const DailyQuestHubScreen = lazy(() =>
  import('./DailyQuestHubScreen').then((module) => ({ default: module.DailyQuestHubScreen })),
);
const DailyQuestScreen = lazy(() =>
  import('./DailyQuestScreen').then((module) => ({ default: module.DailyQuestScreen })),
);
const TimedMemoryScreen = lazy(() =>
  import('./TimedMemoryScreen').then((module) => ({ default: module.TimedMemoryScreen })),
);
const CardMatchScreen = lazy(() =>
  import('./CardMatchScreen').then((module) => ({ default: module.CardMatchScreen })),
);

export type BonusFeatureView = 'comic' | 'questHub' | 'omok' | 'sequence' | 'pair' | null;

type BonusFeatureHostProps = {
  view: BonusFeatureView;
  farmerName?: string;
  onClose: () => void;
  comicInitialTarget?: ComicInitialTarget | null;
  onConsumeComicTarget?: () => void;
  comicInlineEntry?: boolean;
  onGrantMinigameReward?: (missionKey: MissionKey, rewardSlot: MinigameRewardSlot) => Promise<boolean>;
};

export function BonusFeatureHost({
  view,
  farmerName = '커피 농부',
  onClose,
  comicInitialTarget = null,
  onConsumeComicTarget,
  comicInlineEntry = false,
  onGrantMinigameReward,
}: BonusFeatureHostProps) {
  const {
    daily,
    memory,
    pairMatch,
    playQuotas,
    message,
    setMessage,
    rewardMission,
    canClaimMissionRewardFor,
    getAttemptRewardSlot,
    getMissionPlayStatusFor,
    beginMissionAttempt,
    updateOmokStats,
    updateMemoryStats,
    updatePairMatchStats,
  } = useDailyGame();

  const [questGame, setQuestGame] = useState<DailyGameId | null>(null);
  const [adPending, setAdPending] = useState(false);
  const comicBackHandlerRef = useRef<(() => boolean) | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayScrollRef = useRef(0);

  const watchMinigameAd = useCallback(async () => {
    if (adPending) return false;

    setAdPending(true);
    setMessage(null);

    try {
      const watched = await watchRewardedAd('minigame');
      if (!watched) {
        setMessage('광고 시청이 완료되지 않았어요. 다시 시도해 주세요.');
        return false;
      }
      return true;
    } finally {
      setAdPending(false);
    }
  }, [adPending, setMessage]);

  const watchComicAd = useCallback(async () => {
    if (adPending) return false;

    setAdPending(true);
    setMessage(null);

    try {
      const watched = await watchRewardedAd('comic');
      if (!watched) {
        setMessage('광고 시청이 완료되지 않았어요. 다시 시도해 주세요.');
        return false;
      }
      return true;
    } finally {
      setAdPending(false);
    }
  }, [adPending, setMessage]);

  const requestMissionAttempt = useCallback(
    (missionKey: Parameters<typeof beginMissionAttempt>[0]) =>
      beginMissionAttempt(missionKey, watchMinigameAd),
    [beginMissionAttempt, watchMinigameAd],
  );

  const missionPlayProps = {
    getMissionPlayStatus: getMissionPlayStatusFor,
    beginMissionAttempt: requestMissionAttempt,
    canClaimMissionReward: canClaimMissionRewardFor,
    getAttemptRewardSlot,
  };

  const handleRewardMission = useCallback(
    (
      missionKey: Parameters<typeof rewardMission>[0],
      successMessage?: string,
      rewardSlot: MinigameRewardSlot = 'free',
    ) =>
      rewardMission(
        missionKey,
        getMinigameRewardCups(missionKey),
        successMessage,
        onGrantMinigameReward
          ? (key, slot) => onGrantMinigameReward(key, slot)
          : undefined,
        rewardSlot,
      ),
    [onGrantMinigameReward, rewardMission],
  );

  useLayoutEffect(() => {
    if (!view) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.scrollTop = overlayScrollRef.current;
  }, [message, view]);

  if (!view) return null;

  function handleCloseAll() {
    setQuestGame(null);
    onClose();
  }

  function handleQuestBack() {
    if (questGame) {
      setQuestGame(null);
      return;
    }
    handleCloseAll();
  }

  let screen: React.ReactNode = null;

  if (view === 'comic') {
    screen = (
      <StoryComicScreen
        comicBackHandlerRef={comicBackHandlerRef}
        inlineEntry={comicInlineEntry}
        initialTarget={comicInitialTarget}
        onBack={handleCloseAll}
        onConsumeInitialTarget={onConsumeComicTarget}
        onMessage={setMessage}
        onWatchAd={watchComicAd}
      />
    );
  } else if (view === 'questHub' || view === 'omok' || view === 'sequence' || view === 'pair') {
    const activeGame = questGame ?? (view !== 'questHub' ? view : null);

    if (activeGame === 'omok') {
      screen = (
        <DailyQuestScreen
          daily={daily}
          farmerName={farmerName}
          onBack={handleQuestBack}
          onMessage={setMessage}
          onReward={handleRewardMission}
          onStatsUpdate={updateOmokStats}
          {...missionPlayProps}
        />
      );
    } else if (activeGame === 'sequence') {
      screen = (
        <TimedMemoryScreen
          daily={daily}
          memory={memory}
          onBack={handleQuestBack}
          onMessage={setMessage}
          onReward={handleRewardMission}
          onStatsUpdate={updateMemoryStats}
          {...missionPlayProps}
        />
      );
    } else if (activeGame === 'pair') {
      screen = (
        <CardMatchScreen
          daily={daily}
          pairMatch={pairMatch}
          onBack={handleQuestBack}
          onMessage={setMessage}
          onReward={handleRewardMission}
          onStatsUpdate={updatePairMatchStats}
          {...missionPlayProps}
        />
      );
    } else {
      screen = (
        <DailyQuestHubScreen
          daily={daily}
          farmerName={farmerName}
          memory={memory}
          playQuotas={playQuotas}
          onBack={handleCloseAll}
          onMessage={setMessage}
          onSelectGame={(gameId) => setQuestGame(gameId)}
        />
      );
    }
  }

  return (
    <div
      ref={overlayRef}
      className="goldcat-feature-overlay"
      role="dialog"
      aria-modal="true"
      onScroll={(event) => {
        overlayScrollRef.current = event.currentTarget.scrollTop;
      }}
    >
      <Suspense fallback={null}>{screen}</Suspense>
      <p
        className={`goldcat-toast ${message ? 'goldcat-toast--visible' : ''}`}
        aria-live="off"
      >
        {message ?? ''}
      </p>
    </div>
  );
}
