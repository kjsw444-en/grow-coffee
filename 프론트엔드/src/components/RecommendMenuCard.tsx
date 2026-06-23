import type { RecommendMenuItem } from '../services/recommendTypes';
import './RecommendMenuCard.css';

type RecommendMenuCardProps = {
  item: RecommendMenuItem;
};

export function RecommendMenuCard({ item }: RecommendMenuCardProps) {
  if (item.imageSrc) {
    return (
      <figure className="recommend-menu-card recommend-menu-card--image" aria-label={`${item.name} 추천`}>
        <img
          className="recommend-menu-card__image"
          src={item.imageSrc}
          alt=""
          draggable={false}
          decoding="async"
        />
        <figcaption className="recommend-menu-card__text">
          <strong className="recommend-menu-card__name">{item.name}</strong>
          <p className="recommend-menu-card__desc">{item.description}</p>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="recommend-menu-card recommend-menu-card--text" aria-label={`${item.name} 추천`}>
      <figcaption className="recommend-menu-card__text-only">
        <strong className="recommend-menu-card__name">{item.name}</strong>
        <p className="recommend-menu-card__desc">{item.description}</p>
      </figcaption>
    </figure>
  );
}
