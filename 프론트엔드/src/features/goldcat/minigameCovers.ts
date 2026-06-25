import type { DailyGameId } from '../../services/dailyGamePick';

const MINIGAME_COVER_VERSION = 2;

export type MinigameCoverMeta = {
  src: string;
  alt: string;
};

export const MINIGAME_COVERS: Record<DailyGameId, MinigameCoverMeta> = {
  omok: {
    src: `/images/minigames/omok-cover.png?v=${MINIGAME_COVER_VERSION}`,
    alt: '고양이와 AI 오목 대전 표지',
  },
  sequence: {
    src: `/images/minigames/sequence-cover.png?v=${MINIGAME_COVER_VERSION}`,
    alt: '순서 기억 미니게임 표지',
  },
  pair: {
    src: `/images/minigames/pair-cover.png?v=${MINIGAME_COVER_VERSION}`,
    alt: '카드 짝 맞추기 미니게임 표지',
  },
};
