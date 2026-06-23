/** 토스 리워드 광고 연동 전까지 개발용 모의 광고 */

export async function showRewardedAd(): Promise<boolean> {
  const confirmed = window.confirm('광고를 시청하면 물주기 1회가 열려요.\n(개발용 모의 광고)');

  if (!confirmed) {
    return false;
  }

  await new Promise((resolve) => window.setTimeout(resolve, 900));
  return true;
}
