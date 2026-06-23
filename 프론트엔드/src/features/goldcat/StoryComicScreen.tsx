import { useEffect, useMemo, useState } from 'react';
import { comicSeriesList, getComicSeriesDisplayTitle } from './data/storyComics';

type ComicPanelData = { src: string; alt?: string };

type ComicInitialTarget = { seriesId: string; episodeId?: string };

export type { ComicInitialTarget };

type StoryComicScreenProps = {
  onBack: () => void;
  onWatchAd?: () => Promise<boolean> | boolean;
  onMessage?: (message: string) => void;
  initialTarget?: ComicInitialTarget | null;
  onConsumeInitialTarget?: () => void;
  comicBackHandlerRef?: React.MutableRefObject<(() => boolean) | null>;
  inlineEntry?: boolean;
};

function findSeriesIndex(seriesId: string) {
  return comicSeriesList.findIndex((series) => series.id === seriesId);
}

function ComicPanel({ panel, index }: { panel: ComicPanelData | null; index: number }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [panel?.src]);

  if (!panel?.src || hasError) {
    return (
      <div className="comic-panel-placeholder">
        <span>📖</span>
        <strong>{index + 1}컷</strong>
        <p>이미지를 불러오지 못했어요.</p>
      </div>
    );
  }

  return (
    <img
      alt={panel.alt ?? `${index + 1}컷`}
      className="comic-panel-image"
      draggable={false}
      src={panel.src}
      onError={() => setHasError(true)}
    />
  );
}

function EpisodeCard({
  episode,
  onSelect,
  isFinale,
  disabled,
}: {
  episode: (typeof comicSeriesList)[number]['episodes'][number];
  onSelect: () => void;
  isFinale?: boolean;
  disabled?: boolean;
}) {
  const episodeLabel = episode.subtitle.split(' · ')[0];

  return (
    <button
      className={`comic-episode-button ${isFinale ? 'finale' : ''}`}
      disabled={disabled}
      type="button"
      onClick={onSelect}
    >
      <div className="comic-episode-thumb">
        <img alt={`${episode.subtitle} 썸네일`} draggable={false} loading="lazy" src={episode.thumbnail} />
        <span className="comic-episode-label">{episodeLabel}</span>
        <span className="comic-episode-play">▶</span>
      </div>
      <div className="comic-episode-copy">
        <strong>{episode.subtitle}</strong>
        <small>{episode.description}</small>
        <span className="comic-episode-cta">잠깐 후 보기</span>
      </div>
    </button>
  );
}

export function StoryComicScreen({
  onBack,
  onWatchAd,
  onMessage,
  initialTarget = null,
  onConsumeInitialTarget,
  comicBackHandlerRef,
  inlineEntry = false,
}: StoryComicScreenProps) {
  const [seriesIndex, setSeriesIndex] = useState<number | null>(null);
  const [episodeIndex, setEpisodeIndex] = useState<number | null>(null);
  const [panelIndex, setPanelIndex] = useState(0);
  const [adLoading, setAdLoading] = useState(false);

  const currentSeries = seriesIndex === null ? null : comicSeriesList[seriesIndex];
  const episodes = currentSeries?.episodes ?? [];
  const episode = episodeIndex === null ? null : episodes[episodeIndex];

  const panels = useMemo(() => episode?.panels ?? [], [episode]);
  const totalPanels = Math.max(panels.length, 1);
  const currentPanel = panels[panelIndex] ?? null;
  const isFirst = panelIndex === 0;
  const isLast = panelIndex >= totalPanels - 1;
  const hasNextEpisode = episodeIndex !== null && episodeIndex < episodes.length - 1;
  const nextEpisode = hasNextEpisode ? episodes[episodeIndex + 1] : null;

  function goPrev() {
    setPanelIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    setPanelIndex((current) => Math.min(totalPanels - 1, current + 1));
  }

  function openSeries(index: number) {
    setSeriesIndex(index);
    setEpisodeIndex(null);
    setPanelIndex(0);
  }

  function openEpisode(index: number) {
    setEpisodeIndex(index);
    setPanelIndex(0);
  }

  async function watchComicAd() {
    return (await onWatchAd?.()) === true;
  }

  async function enterEpisode(index: number) {
    if (adLoading) return;

    const targetEpisode = episodes[index];
    if (!targetEpisode) return;

    setAdLoading(true);
    const watched = await watchComicAd();
    setAdLoading(false);

    if (!watched) return;

    openEpisode(index);
    onMessage?.(`${targetEpisode.subtitle}을 열었어요.`);
  }

  useEffect(() => {
    if (!initialTarget) return;

    const nextSeriesIndex = findSeriesIndex(initialTarget.seriesId);
    if (nextSeriesIndex < 0) {
      onConsumeInitialTarget?.();
      return;
    }

    setSeriesIndex(nextSeriesIndex);
    setEpisodeIndex(null);
    setPanelIndex(0);
    onConsumeInitialTarget?.();
  }, [initialTarget, onConsumeInitialTarget]);

  function goToNextEpisode() {
    if (!hasNextEpisode || adLoading || episodeIndex === null) return;
    void enterEpisode(episodeIndex + 1);
  }

  function handleHeaderBack() {
    if (episodeIndex !== null) {
      setEpisodeIndex(null);
      setPanelIndex(0);
      return true;
    }

    if (seriesIndex !== null) {
      if (inlineEntry) {
        onBack();
        return true;
      }

      setSeriesIndex(null);
      setPanelIndex(0);
      return true;
    }

    onBack();
    return true;
  }

  useEffect(() => {
    if (!comicBackHandlerRef) return undefined;

    comicBackHandlerRef.current = () => handleHeaderBack();

    return () => {
      comicBackHandlerRef.current = null;
    };
  });

  function handlePanelTap(event: React.MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const tapX = event.clientX - bounds.left;
    const isLeftTap = tapX < bounds.width / 2;

    if (isLeftTap) {
      goPrev();
      return;
    }

    goNext();
  }

  function handleTouchStart(event: React.TouchEvent<HTMLButtonElement>) {
    event.currentTarget.dataset.touchX = String(event.changedTouches[0].clientX);
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLButtonElement>) {
    const startX = Number(event.currentTarget.dataset.touchX);
    const endX = event.changedTouches[0].clientX;
    const diff = endX - startX;

    if (Math.abs(diff) < 40) return;

    if (diff < 0) {
      goNext();
      return;
    }

    goPrev();
  }

  const headerTitle =
    episode?.subtitle ??
    (currentSeries ? getComicSeriesDisplayTitle(currentSeries) : '공짜 썰만화');

  return (
    <main className="goldcat-app">
      <section className="goldcat-phone sub-screen comic-screen">
        <header className="topbar app-style-header">
          <button className="header-icon-button" type="button" onClick={handleHeaderBack}>
            ‹
          </button>
          <div className="app-title">
            <span>📖</span>
            <strong>{headerTitle}</strong>
          </div>
        </header>

        {seriesIndex === null && (
          <>
            <section className="comic-hero">
              <strong>공짜 썰만화</strong>
              <p>시리즈를 선택하세요</p>
              <small>시리즈·편 목록까지는 무료, 편을 고르면 잠깐 멈춤 후 볼 수 있어요.</small>
            </section>

            <section className="comic-episode-select">
              {comicSeriesList.map((series, index) => (
                <button
                  className="comic-series-button"
                  key={series.id}
                  type="button"
                  onClick={() => openSeries(index)}
                >
                  <div className="comic-episode-thumb">
                    <img
                      alt={`${series.title} 썸네일`}
                      draggable={false}
                      loading="lazy"
                      src={series.episodes[0]?.thumbnail}
                    />
                    <span className="comic-episode-label">{series.isOngoing ? '미완' : '시리즈'}</span>
                    <span className="comic-episode-play">▶</span>
                  </div>
                  <div className="comic-episode-copy">
                    <strong>{getComicSeriesDisplayTitle(series)}</strong>
                    <small>{series.summary}</small>
                    <span className="comic-episode-cta">{series.episodes.length}편 보기</span>
                  </div>
                </button>
              ))}
            </section>
          </>
        )}

        {seriesIndex !== null && episodeIndex === null && (
          <>
            <section className="comic-hero">
              <strong>{getComicSeriesDisplayTitle(currentSeries!)}</strong>
              <p>{currentSeries!.summary}</p>
              <small>원하는 편을 고르면 잠깐 멈춤 후 볼 수 있어요.</small>
            </section>

            <section className="comic-episode-select">
              {episodes.map((item, index) => (
                <EpisodeCard
                  disabled={adLoading}
                  episode={item}
                  isFinale={item.isFinale}
                  key={item.id}
                  onSelect={() => void enterEpisode(index)}
                />
              ))}
            </section>
            {adLoading && <p className="comic-help-text">잠시만 기다려 주세요...</p>}
          </>
        )}

        {seriesIndex !== null && episodeIndex !== null && episode && (
          <>
            <section className="comic-hero">
              <strong>{episode.title}</strong>
              <p>{episode.subtitle}</p>
              <small>{episode.description}</small>
            </section>

            <section className="comic-viewer">
              <div className="comic-progress">
                <span>
                  {panelIndex + 1} / {totalPanels}
                </span>
                <div className="comic-progress-bar">
                  <div style={{ width: `${((panelIndex + 1) / totalPanels) * 100}%` }} />
                </div>
              </div>

              <button
                className="comic-panel-frame"
                type="button"
                onClick={handlePanelTap}
                onTouchEnd={handleTouchEnd}
                onTouchStart={handleTouchStart}
              >
                <ComicPanel key={currentPanel?.src ?? panelIndex} index={panelIndex} panel={currentPanel} />
              </button>
              <p className="comic-help-text">왼쪽/오른쪽을 누르거나 옆으로 밀어서 컷을 넘길 수 있어요.</p>

              <div className="comic-nav-actions">
                <button disabled={isFirst} type="button" onClick={goPrev}>
                  이전 컷
                </button>
                <button disabled={isLast} type="button" onClick={goNext}>
                  다음 컷
                </button>
              </div>

              {isLast && hasNextEpisode && (
                <button
                  className="comic-next-episode-button"
                  disabled={adLoading}
                  type="button"
                  onClick={goToNextEpisode}
                >
                  <strong>{adLoading ? '잠시만 기다려 주세요...' : '다음편 보러가기'}</strong>
                  <small>{nextEpisode?.subtitle}</small>
                </button>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
