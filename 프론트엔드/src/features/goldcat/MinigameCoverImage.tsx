import type { DailyGameId } from '../../services/dailyGamePick';
import { MINIGAME_COVERS } from './minigameCovers';

type MinigameCoverImageProps = {
  gameId: DailyGameId;
  variant?: 'hero' | 'thumb';
  className?: string;
};

export function MinigameCoverImage({
  gameId,
  variant = 'hero',
  className = '',
}: MinigameCoverImageProps) {
  const cover = MINIGAME_COVERS[gameId];
  const variantClass =
    variant === 'thumb' ? 'minigame-cover-image--thumb' : 'minigame-cover-image--hero';

  return (
    <img
      alt={cover.alt}
      className={`minigame-cover-image ${variantClass} ${className}`.trim()}
      decoding="async"
      draggable={false}
      height={858}
      loading="lazy"
      src={cover.src}
      width={1024}
    />
  );
}
