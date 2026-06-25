import { comicSeriesList } from '../features/goldcat/data/storyComics';

const ONBOARDING_IMAGE_VERSION = 3;

function onboardingImage(path: string) {
  return `${path}?v=${ONBOARDING_IMAGE_VERSION}`;
}

const scamSeries = comicSeriesList.find((series) => series.id === 'scam-course');
const scamFinaleEpisode = scamSeries?.episodes.find((episode) => episode.isFinale);

export const ONBOARDING_SLIDES = [
  {
    title: '커피나무를 키워요',
    body: '커피나무를 키워서 커피값 벌어가세요!',
    image: onboardingImage('/images/onboarding/slide-1-pot.png'),
    imageAlt: '웃는 화분에서 커피 새싹이 자라는 모습',
    imageFit: 'transparent',
    emoji: '🌱',
  },
  {
    title: '매력적인 캐릭터 영상',
    body: '다양한 커피를 구매해 매력적인 커피 캐릭터 영상을 획득할 수 있어요!',
    image: onboardingImage('/images/onboarding/slide-2-character.png'),
    imageAlt: '카페에서 아이스 아메리카노를 건네는 캐릭터',
    imageFit: 'contain',
    emoji: '☕',
  },
  {
    title: '히든 영상 발굴',
    body: '여러 커피를 조합해 히든 영상을 발굴해 보세요!',
    image: onboardingImage('/images/onboarding/slide-3-hidden.png'),
    imageAlt: '카페에서 대화하는 히든 캐릭터들',
    imageFit: 'contain',
    emoji: '✨',
  },
  {
    title: '1일 1게임',
    body: '1일 1게임으로 빠르게 보상을 받아요.',
    image: onboardingImage('/images/onboarding/slide-4-minigame.png'),
    imageAlt: '고양이가 짝 맞추기 게임을 하는 모습',
    imageFit: 'contain',
    emoji: '🎮',
  },
  {
    title: '무료 썰만화',
    body: '무료 썰만화도 볼 수 있어요!',
    image: scamFinaleEpisode?.thumbnail ?? '/comics/scam-4/01.png',
    imageAlt: '강의팔이에게 사기당한 썰 완결 표지',
    imageFit: 'contain',
    emoji: '📖',
  },
] as const;
