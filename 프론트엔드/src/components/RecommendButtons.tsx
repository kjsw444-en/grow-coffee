import { useCallback, useEffect, useState } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import {
  RECOMMEND_BTN_HEIGHT,
  RECOMMEND_BTN_WIDTH,
  RECOMMEND_COFFEE_IMG,
  RECOMMEND_DINNER_IMG,
} from '../game/constants';
import {
  getActiveCoffeeRecommendation,
  rerollCoffeeRecommendation,
  type CoffeeRecommendation,
} from '../services/coffeeRecommendation';
import {
  getActiveDinnerRecommendation,
  rerollDinnerRecommendation,
  type DinnerRecommendation,
} from '../services/dinnerRecommendation';
import {
  getRecommendDailyState,
  saveRecommendReroll,
  type RecommendKind,
} from '../services/recommendDaily';
import { formatSceneDialogue } from '../game/sceneDialogue';
import { getTodayKey } from '../services/dailyGameStorage';
import { hasSeenShopHeartbeatToday, markShopHeartbeatSeenToday } from '../services/shopHeartbeat';
import { ComicSeriesInlineList } from './ComicSeriesInlineList';
import { DailyGameInlineList } from './DailyGameInlineList';
import { RecommendExpandPanel } from './RecommendExpandPanel';
import type { DailyGameId } from '../services/dailyGamePick';
import './RecommendButtons.css';

type ExpandKind = 'coffee' | 'dinner' | 'manga' | 'game' | null;

const SHOP_BUBBLE_INTERVAL_MS = 60_000;
const SHOP_BUBBLE_VISIBLE_MS = 3_000;

type RecommendButtonsProps = {
  placement?: 'overlay' | 'below';
  onOpenComicSeries?: (seriesId: string) => void;
  onOpenDailyGame?: (gameId: DailyGameId) => void;
  onOpenShop?: () => void;
};

export function RecommendButtons({
  placement = 'overlay',
  onOpenComicSeries,
  onOpenDailyGame,
  onOpenShop,
}: RecommendButtonsProps) {
  const [expandKind, setExpandKind] = useState<ExpandKind>(null);
  const [coffeeItem, setCoffeeItem] = useState<CoffeeRecommendation>(() => getActiveCoffeeRecommendation());
  const [dinnerItem, setDinnerItem] = useState<DinnerRecommendation>(() => getActiveDinnerRecommendation());
  const [shopCalm, setShopCalm] = useState(() => hasSeenShopHeartbeatToday());
  const [shopBubbleVisible, setShopBubbleVisible] = useState(false);
  const buttonSound = useButtonSound();

  useEffect(() => {
    if (!onOpenShop || shopCalm) return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const showBubble = () => {
      setShopBubbleVisible(true);
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        setShopBubbleVisible(false);
        hideTimer = null;
      }, SHOP_BUBBLE_VISIBLE_MS);
    };

    showBubble();
    const interval = setInterval(showBubble, SHOP_BUBBLE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (hideTimer !== null) clearTimeout(hideTimer);
      setShopBubbleVisible(false);
    };
  }, [onOpenShop, shopCalm]);

  const toggleExpand = async (kind: 'coffee' | 'dinner' | 'manga' | 'game') => {
    await buttonSound();

    if (expandKind === kind) {
      setExpandKind(null);
      return;
    }

    if (kind === 'coffee') {
      setCoffeeItem(getActiveCoffeeRecommendation());
    } else if (kind === 'dinner') {
      setDinnerItem(getActiveDinnerRecommendation());
    }

    setExpandKind(kind);
  };

  const handleReroll = useCallback(
    (kind: RecommendKind) => {
      void buttonSound();
      const dateKey = getTodayKey();

      if (kind === 'coffee') {
        const next = rerollCoffeeRecommendation(dateKey);
        saveRecommendReroll('coffee', next.id, dateKey);
        setCoffeeItem(next);
        return;
      }

      const next = rerollDinnerRecommendation(dateKey);
      saveRecommendReroll('dinner', next.id, dateKey);
      setDinnerItem(next);
    },
    [buttonSound],
  );

  const openDailyGame = async (gameId: DailyGameId) => {
    await buttonSound();
    setExpandKind(null);
    onOpenDailyGame?.(gameId);
  };

  const openComicSeries = async (seriesId: string) => {
    await buttonSound();
    setExpandKind(null);
    onOpenComicSeries?.(seriesId);
  };

  const openShop = async () => {
    await buttonSound();
    setExpandKind(null);
    setShopBubbleVisible(false);
    if (!shopCalm) {
      markShopHeartbeatSeenToday();
      setShopCalm(true);
    }
    onOpenShop?.();
  };

  return (
    <div
      className={`recommend-buttons${placement === 'below' ? ' recommend-buttons--below' : ''}`}
      aria-label="오늘의 추천"
    >
      <div className="recommend-buttons__col">
        <div className="recommend-buttons__stack">
          <button
            type="button"
            className={`recommend-buttons__btn recommend-buttons__btn--full${expandKind === 'coffee' ? ' recommend-buttons__btn--active' : ''}`}
            aria-expanded={expandKind === 'coffee'}
            onClick={() => void toggleExpand('coffee')}
          >
            <img
              className="recommend-buttons__full-img"
              src={RECOMMEND_COFFEE_IMG}
              alt="오늘의 커피 추천"
              width={RECOMMEND_BTN_WIDTH}
              height={RECOMMEND_BTN_HEIGHT}
              decoding="sync"
            />
          </button>

          {expandKind === 'coffee' && (
            <RecommendExpandPanel
              item={coffeeItem}
              label="오늘의 커피 추천"
              onReroll={() => handleReroll('coffee')}
            />
          )}
        </div>

        <div
          className={`recommend-buttons__sub-stack${expandKind === 'coffee' ? ' recommend-buttons__sub-stack--panel-open' : ''}`}
        >
          {onOpenShop && (
            <div
              className={`recommend-buttons__shop-wrap${shopBubbleVisible || !shopCalm ? ' recommend-buttons__shop-wrap--nudge' : ''}`}
            >
              {shopBubbleVisible && (
                <div className="recommend-buttons__shop-bubble" aria-hidden="true">
                  <p className="recommend-buttons__shop-bubble-text">
                    {formatSceneDialogue('커피를 구매하고 캐릭터를 추가해봐')}
                  </p>
                </div>
              )}
              <button
                type="button"
                className={`recommend-buttons__btn recommend-buttons__btn--sub recommend-buttons__btn--shop${shopCalm ? '' : ' recommend-buttons__btn--shop-pulse'}`}
                aria-label="커피 상점"
                onClick={() => void openShop()}
              >
                <span className="recommend-buttons__sub-label recommend-buttons__sub-label--shop">
                  <span className="recommend-buttons__shop-heart" aria-hidden="true">
                    💖
                  </span>
                  커피 상점
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="recommend-buttons__col">
        <div className="recommend-buttons__stack">
          <button
            type="button"
            className={`recommend-buttons__btn recommend-buttons__btn--full${expandKind === 'dinner' ? ' recommend-buttons__btn--active' : ''}`}
            aria-expanded={expandKind === 'dinner'}
            onClick={() => void toggleExpand('dinner')}
          >
            <img
              className="recommend-buttons__full-img"
              src={RECOMMEND_DINNER_IMG}
              alt="오늘의 저녁 추천"
              width={RECOMMEND_BTN_WIDTH}
              height={RECOMMEND_BTN_HEIGHT}
              decoding="sync"
            />
          </button>

          {expandKind === 'dinner' && (
            <RecommendExpandPanel
              item={dinnerItem}
              label="오늘의 저녁 추천"
              onReroll={() => handleReroll('dinner')}
            />
          )}
        </div>

        <div
          className={`recommend-buttons__sub-stack${expandKind === 'dinner' ? ' recommend-buttons__sub-stack--panel-open' : ''}`}
        >
          <button
            type="button"
            className={`recommend-buttons__btn recommend-buttons__btn--sub${expandKind === 'game' ? ' recommend-buttons__btn--active-sub' : ''}`}
            aria-expanded={expandKind === 'game'}
            onClick={() => void toggleExpand('game')}
          >
            <span className="recommend-buttons__sub-label">1일 1게임</span>
          </button>

          {expandKind === 'game' && (
            <DailyGameInlineList onSelect={(gameId) => void openDailyGame(gameId)} />
          )}

          <button
            type="button"
            className={`recommend-buttons__btn recommend-buttons__btn--sub recommend-buttons__btn--sub-after${expandKind === 'manga' ? ' recommend-buttons__btn--active-sub' : ''}`}
            aria-expanded={expandKind === 'manga'}
            onClick={() => void toggleExpand('manga')}
          >
            <span className="recommend-buttons__sub-label">무료 썰 만화</span>
          </button>

          {expandKind === 'manga' && (
            <ComicSeriesInlineList onSelect={(seriesId) => void openComicSeries(seriesId)} />
          )}
        </div>
      </div>
    </div>
  );
}
