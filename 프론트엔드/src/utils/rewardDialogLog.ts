export type RewardDialogLogType = 'roulette' | 'fortune';

export type RewardDialogLogPayload = {
  type: RewardDialogLogType | string;
  shouldOpen: boolean;
  mounted: boolean;
  rewardState: unknown;
  userAgent: string;
};

export function logRewardDialog(payload: RewardDialogLogPayload) {
  console.log('[reward-dialog]', payload);
}
