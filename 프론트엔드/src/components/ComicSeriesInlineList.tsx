import { comicSeriesList, getComicSeriesDisplayTitle } from '../features/goldcat/data/storyComics';
import './ComicSeriesInlineList.css';

type ComicSeriesInlineListProps = {
  onSelect: (seriesId: string) => void;
};

export function ComicSeriesInlineList({ onSelect }: ComicSeriesInlineListProps) {
  return (
    <div className="recommend-comic-series-list" role="list" aria-label="썰만화 시리즈">
      {comicSeriesList.map((series) => (
        <button
          key={series.id}
          type="button"
          className="recommend-comic-series-item"
          role="listitem"
          onClick={() => onSelect(series.id)}
        >
          <span className="recommend-comic-series-item__badge">
            {series.isOngoing ? '미완' : '시리즈'}
          </span>
          <strong>{getComicSeriesDisplayTitle(series)}</strong>
          <small>{series.summary}</small>
          <span className="recommend-comic-series-item__count">{series.episodes.length}편</span>
        </button>
      ))}
    </div>
  );
}
