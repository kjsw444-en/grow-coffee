import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import {
  RECOMMEND_BTN_HEIGHT,
  RECOMMEND_BTN_WIDTH,
  RECOMMEND_COFFEE_IMG,
  RECOMMEND_DINNER_IMG,
} from '../game/constants';
import { COFFEE_RECOMMENDATIONS, type CoffeeRecommendation } from '../services/coffeeRecommendation';
import { DINNER_RECOMMENDATIONS, type DinnerRecommendation } from '../services/dinnerRecommendation';
import {
  loadRecommendToday,
  rerollRecommendToday,
  type RecommendKind,
} from '../services/recommendServer';
import { ApiRequestError } from '../services/api';
import { formatSceneDialogue } from '../game/sceneDialogue';
import { hasSeenShopHeartbeatToday, markShopHeartbeatSeenToday } from '../services/shopHeartbeat';
import { watchRewardedAd } from '../services/rewardedAd';
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
  slotBelowShop?: ReactNode;
};

function RecommendButtonsComponent({
  placement = 'overlay',
  onOpenComicSeries,
  onOpenDailyGame,
  onOpenShop,
  slotBelowShop,
}: RecommendButtonsProps) {
  const [expandKind, setExpandKind] = useState<ExpandKind>(null);
  const [coffeeItem, setCoffeeItem] = useState<CoffeeRecommendation>(COFFEE_RECOMMENDATIONS[0]);
  const [dinnerItem, setDinnerItem] = useState<DinnerRecommendation>(DINNER_RECOMMENDATIONS[0]);
  const [recommendLoading, setRecommendLoading] = useState<RecommendKind | null>(null);
  const [shopCalm, setShopCalm] = useState(() => hasSeenShopHeartbeatToday());
  const [shopBubbleVisible, setShopBubbleVisible] = useState(false);
  const [rerollLoading, setRerollLoading] = useState<RecommendKind | null>(null);
  const [rerollNotice, setRerollNotice] = useState<Partial<Record<RecommendKind, string>>>({});
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

  const loadRecommendPanel = useCallback(async (kind: RecommendKind) => {
    setRecommendLoading(kind);
    setRerollNotice((prev) => ({ ...prev, [kind]: undefined }));

    try {
      const result = await loadRecommendToday(kind);
      if (kind === 'coffee') {
        setCoffeeItem(result.item as CoffeeRecommendation);
      } else {
        setDinnerItem(result.item as DinnerRecommendation);
      }
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.message
          : '추천 메뉴를 불러오지 못했어요.';
      setRerollNotice((prev) => ({ ...prev, [kind]: message }));
    } finally {
      setRecommendLoading(null);
    }
  }, []);

  const toggleExpand = async (kind: 'coffee' | 'dinner' | 'manga' | 'game') => {
    await buttonSound();

    if (expandKind === kind) {
      setExpandKind(null);
      return;
    }

    setExpandKind(kind);

    if (kind === 'coffee' || kind === 'dinner') {
      await loadRecommendPanel(kind);
    }
  };

  const handleReroll = useCallback(
    async (kind: RecommendKind) => {
      if (rerollLoading) return;

      await buttonSound();
      setRerollNotice((prev) => ({ ...prev, [kind]: undefined }));
      setRerollLoading(kind);

      try {
        const watched = await watchRewardedAd(
          kind === 'coffee' ? 'recommend-coffee' : 'recommend-dinner',
        );
        if (!watched) {
          setRerollNotice((prev) => ({
            ...prev,
            [kind]: '광고 시청을 완료해야 다른 메뉴를 볼 수 있어요.',
          }));
          return;
        }

        const result = await rerollRecommendToday(kind);
        if (kind === 'coffee') {
          setCoffeeItem(result.item as CoffeeRecommendation);
        } else {
          setDinnerItem(result.item as DinnerRecommendation);
        }
      } catch (error) {
        const message =
          error instanceof ApiRequestError
            ? error.message
            : '다른 메뉴를 추천받지 못했어요.';
        setRerollNotice((prev) => ({ ...prev, [kind]: message }));
      } finally {
        setRerollLoading(null);
      }
    },
    [buttonSound, rerollLoading],
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
              rerollLoading={rerollLoading === 'coffee' || recommendLoading === 'coffee'}
              rerollNotice={rerollNotice.coffee ?? null}
              onReroll={() => void handleReroll('coffee')}
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
          {slotBelowShop ? (
            <div className="recommend-buttons__mission-dock">
              <div className="recommend-buttons__mission-dock-scale">{slotBelowShop}</div>
            </div>
          ) : null}
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
              rerollLoading={rerollLoading === 'dinner' || recommendLoading === 'dinner'}
              rerollNotice={rerollNotice.dinner ?? null}
              onReroll={() => void handleReroll('dinner')}
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

export const RecommendButtons = memo(RecommendButtonsComponent);
