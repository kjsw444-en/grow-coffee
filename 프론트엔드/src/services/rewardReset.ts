import { canSpinDailyLoginRouletteToday } from '../game/dailyLoginRoulette';
import { getTodayKey } from '../game/attendance';
import { initialState, type GameState } from '../game/types';
import { isRitualFortunePending } from './dailyRitual';
import {
  hasClaimedDailyLoginRouletteLocal,
  hasSeenDailyLoginRouletteLocal,
  isDailyLoginRouletteDismissedForSession,
  resetDailyLoginRouletteStorage,
} from './dailyLoginRouletteStorage';
import {
  hasSeenCatFortuneGuideToday,
  hasSeenCatRouletteGuideToday,
  resetCatGuideStorage,
} from './catGuideStorage';

export type RewardResetUiSnapshot = {
  catFortuneGuideSeen?: boolean;
  catRouletteGuideSeen?: boolean;
  rewardDialogOpen?: boolean;
};

export type RewardResetLogSnapshot = {
  fortuneRewardClaimed: boolean;
  rouletteRewardClaimed: boolean;
  fortuneDialogShown: boolean;
  rouletteDialogShown: boolean;
};

export function getRouletteRewardResetStatePatch() {
  return {
    dailyLoginRouletteDayKey: initialState.dailyLoginRouletteDayKey,
    dailyLoginRouletteRewardCups: initialState.dailyLoginRouletteRewardCups,
    dailyLoginRouletteRespinDayKey: initialState.dailyLoginRouletteRespinDayKey,
    ritualBonusRouletteSpins: initialState.ritualBonusRouletteSpins,
  };
}

export function getDailyFortuneRewardResetStatePatch() {
  return {
    ritualDayKey: initialState.ritualDayKey,
    ritualFortuneId: initialState.ritualFortuneId,
    ritualFortuneRevealed: initialState.ritualFortuneRevealed,
    ritualFortuneProgress: initialState.ritualFortuneProgress,
    ritualFortuneClaimed: initialState.ritualFortuneClaimed,
    ritualGiftOpened: initialState.ritualGiftOpened,
    ritualGiftId: initialState.ritualGiftId,
    ritualMission1Done: initialState.ritualMission1Done,
    ritualMission2Done: initialState.ritualMission2Done,
    ritualMission3Done: initialState.ritualMission3Done,
    ritualMissionClaimed: initialState.ritualMissionClaimed,
    ritualMissionHarvestCount: initialState.ritualMissionHarvestCount,
    ritualMissionMinigameDone: initialState.ritualMissionMinigameDone,
    ritualMissionRouletteDone: initialState.ritualMissionRouletteDone,
    ritualFertilizerCharges: initialState.ritualFertilizerCharges,
    ritualBonusRouletteSpins: initialState.ritualBonusRouletteSpins,
  };
}

/** localStorage/sessionStorage — 고양이 넛지·룰렛 표시 기록 */
export function clearRewardDialogShownState() {
  resetCatGuideStorage();
  resetDailyLoginRouletteStorage();
}

export function buildRewardResetLogSnapshot(
  state: GameState,
  ui: RewardResetUiSnapshot = {},
): RewardResetLogSnapshot {
  const today = getTodayKey();
  const rouletteClaimedOnServer =
    String(state.dailyLoginRouletteDayKey ?? '') === today &&
    !canSpinDailyLoginRouletteToday(state, today) &&
    Math.max(0, Number(state.ritualBonusRouletteSpins ?? 0)) === 0;

  return {
    fortuneRewardClaimed:
      state.ritualFortuneClaimed === true ||
      (!isRitualFortunePending(state) && state.ritualFortuneRevealed === true),
    rouletteRewardClaimed:
      rouletteClaimedOnServer || hasClaimedDailyLoginRouletteLocal(today),
    fortuneDialogShown:
      ui.catFortuneGuideSeen !== undefined
        ? ui.catFortuneGuideSeen
        : hasSeenCatFortuneGuideToday(today),
    rouletteDialogShown:
      (ui.catRouletteGuideSeen !== undefined
        ? ui.catRouletteGuideSeen
        : hasSeenCatRouletteGuideToday(today)) ||
      hasSeenDailyLoginRouletteLocal(today) ||
      isDailyLoginRouletteDismissedForSession(today),
  };
}

export function logRewardResetPhase(phase: 'before' | 'after', snapshot: RewardResetLogSnapshot) {
  console.log(`[reset-${phase}]`, snapshot);
}
