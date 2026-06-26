export function formatRankingRewardDate(dayKey?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey ?? '');
  if (!match) return '어제';
  return `${Number(match[2])}월 ${Number(match[3])}일`;
}
