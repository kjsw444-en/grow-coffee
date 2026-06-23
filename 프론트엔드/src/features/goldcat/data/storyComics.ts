type Panel = { src: string; alt: string };

type Episode = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  panels: Panel[];
  isFinale?: boolean;
};

export type ComicSeries = {
  id: string;
  title: string;
  summary: string;
  isOngoing: boolean;
  episodes: Episode[];
};

function buildPanels(episodeId: string, count: number, ext = 'png'): Panel[] {
  return Array.from({ length: count }, (_, index) => {
    const order = String(index + 1).padStart(2, '0');
    return {
      src: `/comics/${episodeId}/${order}.${ext}`,
      alt: `${index + 1}컷`,
    };
  });
}

function buildEpisode(
  episodeId: string,
  seriesTitle: string,
  subtitle: string,
  description: string,
  count = 10,
  options: { ext?: string; isFinale?: boolean } = {},
): Episode {
  const { ext = 'png', isFinale = false } = options;

  return {
    id: episodeId,
    title: seriesTitle,
    subtitle,
    description,
    thumbnail: `/comics/${episodeId}/01.${ext}`,
    panels: buildPanels(episodeId, count, ext),
    isFinale,
  };
}

export const comicSeriesList: ComicSeries[] = [
  {
    id: 'japan-zero',
    title: '일본 여행 다녀왔는데 0원 나옴',
    summary: '0원 일본 여행 팸투어 썰만화',
    isOngoing: false,
    episodes: [
      buildEpisode('episode-1', '일본 여행 다녀왔는데 0원 나옴', '1편 · 10컷', '0원 일본 여행이 어떻게 시작됐는지 알아보세요.'),
      buildEpisode('episode-2', '일본 여행 다녀왔는데 0원 나옴', '2편 · 10컷', '출국 전 준비와 팸투어 현실, 그리고 일정 공개까지.'),
      buildEpisode('episode-3', '일본 여행 다녀왔는데 0원 나옴', '3편 · 10컷', '일본 도착, 멤버 합류, 가이드 류상과 식폭행 일정.'),
      buildEpisode('episode-4', '일본 여행 다녀왔는데 0원 나옴', '완결 · 10컷', '식폭행 끝, 귀국 후 포스팅 퀘스트와 여행의 결말.', 10, { isFinale: true }),
    ],
  },
  {
    id: 'scam-course',
    title: '강의팔이에게 사기당한 썰',
    summary: '직장인 루틴에서 부업 강의 사기까지',
    isOngoing: false,
    episodes: [
      buildEpisode('scam-1', '강의팔이에게 사기당한 썰', '1편 · 11컷', '퇴사 고민, 지옥철, 그리고 무료 강의 광고를 만나다.', 11),
      buildEpisode('scam-2', '강의팔이에게 사기당한 썰', '2편 · 11컷', '무료 강의, 300만원 결제, 1~4주차까지.', 11),
      buildEpisode('scam-3', '강의팔이에게 사기당한 썰', '3편 · 10컷', '거짓 커리어 조사, DM 대면, 환불 신청까지.', 10),
      buildEpisode('scam-4', '강의팔이에게 사기당한 썰', '완결 · 10컷', '환불 거절, 300만원 손실, 체크리스트와 후기까지.', 10, { isFinale: true }),
    ],
  },
  {
    id: 'cooking-shorts',
    title: '요리 쇼츠로 인플루언서 실험',
    summary: '진짜! 돈 될까? 요리 쇼츠 부업 실험기',
    isOngoing: true,
    episodes: [
      buildEpisode('cooking-shorts-1', '요리 쇼츠로 인플루언서 실험', '1편 · 10컷', '부업과 쇼츠, 그리고 요리 채널을 시작하기까지.', 10),
      buildEpisode('cooking-shorts-2', '요리 쇼츠로 인플루언서 실험', '2편 · 10컷', '쇼츠 시작, 3가지 셋팅법, 그리고 두 번째 영상의 현실.', 10),
    ],
  },
];

export const storyComics = comicSeriesList[0].episodes;

export function getComicSeriesDisplayTitle(series: ComicSeries | null | undefined) {
  if (!series) return '공짜 썰만화';
  return series.isOngoing ? `${series.title} (미완)` : series.title;
}
