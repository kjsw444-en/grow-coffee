import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import type { DailyGameId } from '../../services/dailyGamePick';
import { watchRewardedAd } from '../../services/rewardedAd';
import { useDailyGame } from '../../hooks/useDailyGame';
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
};

export function BonusFeatureHost({
  view,
  farmerName = '커피 농부',
  onClose,
  comicInitialTarget = null,
  onConsumeComicTarget,
  comicInlineEntry = false,
}: BonusFeatureHostProps) {
  const {
    daily,
    memory,
    pairMatch,
    message,
    setMessage,
    rewardMission,
    updateOmokStats,
    updateMemoryStats,
    updatePairMatchStats,
  } = useDailyGame();

  const [questGame, setQuestGame] = useState<DailyGameId | null>(null);
  const [adPending, setAdPending] = useState(false);
  const comicBackHandlerRef = useRef<(() => boolean) | null>(null);

  const watchAd = useCallback(async () => {
    if (adPending) return false;

    setAdPending(true);
    setMessage('광고를 준비하고 있어요...');

    try {
      const watched = await watchRewardedAd();
      if (!watched) {
        setMessage('광고 시청이 취소되었거나 완료되지 않았어요.');
        return false;
      }
      return true;
    } finally {
      setAdPending(false);
    }
  }, [adPending, setMessage]);

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
        onWatchAd={watchAd}
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
          onReward={rewardMission}
          onStatsUpdate={updateOmokStats}
          onWatchAd={() => void watchAd()}
        />
      );
    } else if (activeGame === 'sequence') {
      screen = (
        <TimedMemoryScreen
          daily={daily}
          memory={memory}
          onBack={handleQuestBack}
          onMessage={setMessage}
          onReward={rewardMission}
          onStatsUpdate={updateMemoryStats}
        />
      );
    } else if (activeGame === 'pair') {
      screen = (
        <CardMatchScreen
          daily={daily}
          pairMatch={pairMatch}
          onBack={handleQuestBack}
          onMessage={setMessage}
          onReward={rewardMission}
          onStatsUpdate={updatePairMatchStats}
        />
      );
    } else {
      screen = (
        <DailyQuestHubScreen
          daily={daily}
          farmerName={farmerName}
          memory={memory}
          onBack={handleCloseAll}
          onMessage={setMessage}
          onSelectGame={(gameId) => setQuestGame(gameId)}
        />
      );
    }
  }

  return (
    <div className="goldcat-feature-overlay" role="dialog" aria-modal="true">
      <Suspense fallback={null}>{screen}</Suspense>
      {message && (
        <p className="goldcat-toast" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
