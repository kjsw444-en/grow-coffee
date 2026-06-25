/** 1일 1게임 난이도 클리어 보상 — 내린 커피 (기본) */
export const MINIGAME_REWARD_COFFEE_CUPS = 1;

/** 극한 난이도(mission4 · memoryMission4 · pairMission4) 클리어 보상 */
export const MINIGAME_NIGHTMARE_REWARD_COFFEE_CUPS = 3;

export const MINIGAME_NIGHTMARE_MISSION_KEYS = ['mission4', 'memoryMission4', 'pairMission4'] as const;

export function getMinigameRewardCups(missionKey: string) {
  if ((MINIGAME_NIGHTMARE_MISSION_KEYS as readonly string[]).includes(missionKey)) {
    return MINIGAME_NIGHTMARE_REWARD_COFFEE_CUPS;
  }
  return MINIGAME_REWARD_COFFEE_CUPS;
}

export function formatMinigameRewardLabel(cups = MINIGAME_REWARD_COFFEE_CUPS) {
  return `+${cups}잔`;
}
