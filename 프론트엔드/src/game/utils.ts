import { COFFEE_STAGE_MIN, DRINK_STAGE_MIN, STAGES } from '../game/constants';

export function getStage(growth: number) {
  return [...STAGES].reverse().find((stage) => growth >= stage.min) ?? STAGES[0];
}

export function isCoffeeStage(growth: number) {
  return growth >= COFFEE_STAGE_MIN;
}

export function isDrinkStage(growth: number) {
  return growth >= DRINK_STAGE_MIN;
}

export function formatWon(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`;
}
