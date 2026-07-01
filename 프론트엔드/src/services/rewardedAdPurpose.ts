/** 리워드 광고가 붙는 기능 구간 */
export type RewardedAdPurpose =
  | 'passive-reactivate'
  | 'recommend-coffee'
  | 'recommend-dinner'
  | 'comic'
  | 'minigame'
  | 'coffee-finish-bonus'
  | 'attendance-daily'
  | 'daily-roulette'
  | 'daily-roulette-respin';

export const REWARDED_AD_PURPOSE_COPY: Record<RewardedAdPurpose, string> = {
  'passive-reactivate': '리워드 광고 시청 후 방치 커피를 다시 충전할 수 있어요.',
  'recommend-coffee': '리워드 광고 시청 후 다른 커피 메뉴를 추천해 드려요.',
  'recommend-dinner': '리워드 광고 시청 후 다른 저녁 메뉴를 추천해 드려요.',
  comic: '리워드 광고 시청 후 썰 만화를 이어서 볼 수 있어요.',
  minigame: '리워드 광고 시청 후 1일 1게임을 시작할 수 있어요.',
  'coffee-finish-bonus': '리워드 광고 시청 후 내린 커피 마지막 부스트를 받을 수 있어요.',
  'attendance-daily': '리워드 광고 시청 후 출석 보상 내린 커피를 받을 수 있어요.',
  'daily-roulette': '리워드 광고 시청 후 오늘의 접속 룰렛을 돌릴 수 있어요.',
  'daily-roulette-respin': '리워드 광고 시청 후 룰렛을 한 번 더 돌릴 수 있어요.',
};

export function getRewardedAdPurposeCopy(purpose: RewardedAdPurpose) {
  return REWARDED_AD_PURPOSE_COPY[purpose];
}
