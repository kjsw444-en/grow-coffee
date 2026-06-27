export type CoffeeMenuId =
  | 'iced-americano'
  | 'cafe-latte'
  | 'vanilla-latte'
  | 'caramel-macchiato'
  | 'dolce-latte'
  | 'hazelnut-latte'
  | 'cold-brew'
  | 'cold-brew-latte'
  | 'cafe-mocha'
  | 'einspanner'
  | 'brown-sugar-coffee'
  | 'decaf-latte';

export type CoffeeRecommendation = {
  id: CoffeeMenuId;
  name: string;
  description: string;
  imageSrc: string;
};

export const COFFEE_RECOMMENDATIONS: CoffeeRecommendation[] = [
  {
    id: 'iced-americano',
    name: '아이스 아메리카노',
    description: '활력 충전에 도움을 줄 수 있어요.',
    imageSrc: '/images/recommend/coffee/iced-americano.png?v=5',
  },
  {
    id: 'cafe-latte',
    name: '카페라떼',
    description: '칼슘과 커피를 함께 즐겨보세요.',
    imageSrc: '/images/recommend/coffee/cafe-latte.png?v=5',
  },
  {
    id: 'vanilla-latte',
    name: '바닐라 라떼',
    description: '달콤한 향으로 기분 전환해보세요.',
    imageSrc: '/images/recommend/coffee/vanilla-latte.png?v=5',
  },
  {
    id: 'caramel-macchiato',
    name: '카라멜 마키아토',
    description: '에너지 충전에 좋은 선택이에요.',
    imageSrc: '/images/recommend/coffee/caramel-macchiato.png?v=5',
  },
  {
    id: 'dolce-latte',
    name: '돌체 라떼',
    description: '피로한 하루에 달콤한 휴식을 선물해요.',
    imageSrc: '/images/recommend/coffee/dolce-latte.png?v=5',
  },
  {
    id: 'hazelnut-latte',
    name: '헤이즐넛 라떼',
    description: '고소한 향이 마음을 편안하게 해줘요.',
    imageSrc: '/images/recommend/coffee/hazelnut-latte.png?v=5',
  },
  {
    id: 'cold-brew',
    name: '콜드브루',
    description: '깔끔한 풍미로 부담 없이 즐겨보세요.',
    imageSrc: '/images/recommend/coffee/cold-brew.png?v=5',
  },
  {
    id: 'cold-brew-latte',
    name: '콜드브루 라떼',
    description: '부드러운 휴식을 위한 한 잔이에요.',
    imageSrc: '/images/recommend/coffee/cold-brew-latte.png?v=5',
  },
  {
    id: 'cafe-mocha',
    name: '카페모카',
    description: '달콤함으로 기분을 밝게 만들어줘요.',
    imageSrc: '/images/recommend/coffee/cafe-mocha.png?v=5',
  },
  {
    id: 'einspanner',
    name: '아인슈페너',
    description: '풍부한 만족감을 느껴보세요.',
    imageSrc: '/images/recommend/coffee/einspanner.png?v=5',
  },
  {
    id: 'brown-sugar-coffee',
    name: '흑당 커피',
    description: '빠른 에너지 보충에 도움을 줄 수 있어요.',
    imageSrc: '/images/recommend/coffee/brown-sugar-coffee.png?v=5',
  },
  {
    id: 'decaf-latte',
    name: '디카페인 라떼',
    description: '카페인 부담 없이 즐겨보세요.',
    imageSrc: '/images/recommend/coffee/decaf-latte.png?v=5',
  },
];

export function getCoffeeRecommendationById(id: CoffeeMenuId) {
  return COFFEE_RECOMMENDATIONS.find((item) => item.id === id) ?? COFFEE_RECOMMENDATIONS[0];
}
