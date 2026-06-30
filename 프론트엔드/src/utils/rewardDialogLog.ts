export type RewardDialogLogType = 'roulette' | 'fortune' | 'brewed';

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
