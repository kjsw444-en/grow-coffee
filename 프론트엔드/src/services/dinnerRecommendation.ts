export type DinnerMenuId =
  | 'jeyuk-bokkeum'
  | 'samgyeopsal'
  | 'dak-galbi'
  | 'so-bulgogi'
  | 'shabu-shabu'
  | 'salmon-donburi'
  | 'hoe-deopbap'
  | 'kimchi-jjigae'
  | 'doenjang-jjigae'
  | 'sundubu-jjigae'
  | 'bibimbap'
  | 'ojingeo-bokkeum';

export type DinnerRecommendation = {
  id: DinnerMenuId;
  name: string;
  description: string;
  imageSrc: string;
};

export const DINNER_RECOMMENDATIONS: DinnerRecommendation[] = [
  {
    id: 'jeyuk-bokkeum',
    name: '제육볶음',
    description: '단백질이 풍부해 든든한 한 끼예요.',
    imageSrc: '/images/recommend/dinner/jeyuk-bokkeum.png?v=3',
  },
  {
    id: 'samgyeopsal',
    name: '삼겹살 구이',
    description: '포만감이 높아 만족도가 좋아요.',
    imageSrc: '/images/recommend/dinner/samgyeopsal.png?v=3',
  },
  {
    id: 'dak-galbi',
    name: '닭갈비',
    description: '단백질과 채소를 함께 즐길 수 있어요.',
    imageSrc: '/images/recommend/dinner/dak-galbi.png?v=3',
  },
  {
    id: 'so-bulgogi',
    name: '소불고기',
    description: '기력 보충에 도움이 될 수 있어요.',
    imageSrc: '/images/recommend/dinner/so-bulgogi.png?v=3',
  },
  {
    id: 'shabu-shabu',
    name: '샤브샤브',
    description: '고기와 채소의 균형이 좋아요.',
    imageSrc: '/images/recommend/dinner/shabu-shabu.png?v=3',
  },
  {
    id: 'salmon-donburi',
    name: '연어덮밥',
    description: '오메가3가 풍부한 메뉴예요.',
    imageSrc: '/images/recommend/dinner/salmon-donburi.png?v=3',
  },
  {
    id: 'hoe-deopbap',
    name: '회덮밥',
    description: '신선하고 부담 없이 즐기기 좋아요.',
    imageSrc: '/images/recommend/dinner/hoe-deopbap.png?v=3',
  },
  {
    id: 'kimchi-jjigae',
    name: '김치찌개',
    description: '얼큰하고 든든한 국민 메뉴예요.',
    imageSrc: '/images/recommend/dinner/kimchi-jjigae.png?v=3',
  },
  {
    id: 'doenjang-jjigae',
    name: '된장찌개',
    description: '구수한 맛으로 속을 편안하게 해줘요.',
    imageSrc: '/images/recommend/dinner/doenjang-jjigae.png?v=3',
  },
  {
    id: 'sundubu-jjigae',
    name: '순두부찌개',
    description: '부드럽고 소화 부담이 적어요.',
    imageSrc: '/images/recommend/dinner/sundubu-jjigae.png?v=3',
  },
  {
    id: 'bibimbap',
    name: '비빔밥',
    description: '다양한 영양소를 한 번에 챙겨요.',
    imageSrc: '/images/recommend/dinner/bibimbap.png?v=3',
  },
  {
    id: 'ojingeo-bokkeum',
    name: '오징어볶음',
    description: '매콤한 맛으로 입맛을 돋워줘요.',
    imageSrc: '/images/recommend/dinner/ojingeo-bokkeum.png?v=3',
  },
];

export function getDinnerRecommendationById(id: DinnerMenuId) {
  return DINNER_RECOMMENDATIONS.find((item) => item.id === id) ?? DINNER_RECOMMENDATIONS[0];
}
