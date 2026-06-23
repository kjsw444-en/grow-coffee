import { SELL_PRICE, type HoldMode } from './constants';
import { formatWon } from './utils';

/** 행동 후 대화창이 사라지기까지 대기(ms) */
export const SCENE_DIALOGUE_IDLE_MS = 3500;

/** 대화창 한 줄 최대 글자 수(가독성용 줄바꿈) */
const DIALOGUE_LINE_WIDTH = 16;

export function sceneDialogueForHoldStart(mode: HoldMode) {
  return mode === 'brew' ? '커피를 내리고 있어요...' : '물을 주고 있어요...';
}

export function sceneDialogueForHoldCancel() {
  return '물주기를 그만두었어요.';
}

export function sceneDialogueForGrowthComplete(mode: HoldMode, stageLabel: string, growth: number) {
  if (growth >= 100) {
    return formatSceneDialogue('커피가 완성됐어요! 커피 마시기를 눌러 주세요.');
  }

  if (mode === 'brew') {
    return formatSceneDialogue(`커피가 익어가요! ${stageLabel} · 성장 ${growth}%`);
  }

  return formatSceneDialogue(`${stageLabel} 단계로 자라고 있어요! 성장 ${growth}%`);
}

export function sceneDialogueForDrink() {
  return formatSceneDialogue(`커피 한 잔을 마셨어요! ${formatWon(SELL_PRICE)}을 벌었어요.`);
}

export function sceneDialogueForAdReward() {
  return formatSceneDialogue('광고를 보고 물주기 기회를 얻었어요!');
}

const CAT_NUDGE_DIALOGUES = [
  '커피냥이 1일 1게임 하자고 애교부리네요~',
  '커피냥이 무료 썰만화 보러 가자고 졸라요!',
  '커피냥이 물 좀 더 주래요. 씨앗이 목말라 보인대요~',
  '커피냥이 오늘의 커피 추천이 궁금하대요!',
  '커피냥이 오늘 저녁 뭐 먹을지 같이 고르자고 해요~',
  '커피냥이 창가 햇빛 쬐며 기다리고 있어요. 물 줄까요?',
  '커피냥이 씨앗 키우면 칭찬해 줄 것 같아요!',
  '커피냥이 오늘의 추천 버튼을 눌러보라고 살짝 낚시 중이에요~',
  '커피냥이 커피 상점에 가자고 졸라요! 구매하면 캐릭터가 추가된대요~',
  '커피냥이 마신 커피로 새 캐릭터를 살 수 있다고 알려줘요!',
  '커피냥이 커피를 구매하면 해당 캐릭터가 추가된다고 설명해요~',
  '커피냥이 커피 상점에서 캐릭터를 모아보자고 손짓해요!',
] as const;

export function formatSceneDialogue(text: string, lineWidth = DIALOGUE_LINE_WIDTH) {
  if (text.includes('\n')) return text;

  const sentenceParts = text
    .split(/(?<=[.?!~])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentenceParts.length > 1) {
    return sentenceParts.map((part) => wrapDialogueLine(part, lineWidth)).join('\n');
  }

  return wrapDialogueLine(text, lineWidth);
}

function wrapDialogueLine(text: string, lineWidth: number) {
  if (text.length <= lineWidth) return text;

  const lines: string[] = [];
  let current = '';

  for (const char of text) {
    if (current.length >= lineWidth) {
      lines.push(current);
      current = char;
      continue;
    }
    current += char;
  }

  if (current) lines.push(current);
  return lines.join('\n');
}

export function randomCatNudgeDialogue(excludeRaw?: string) {
  const pool =
    excludeRaw && CAT_NUDGE_DIALOGUES.length > 1
      ? CAT_NUDGE_DIALOGUES.filter((line) => line !== excludeRaw)
      : CAT_NUDGE_DIALOGUES;
  const index = Math.floor(Math.random() * pool.length);
  const raw = pool[index] ?? CAT_NUDGE_DIALOGUES[0];
  return { raw, text: formatSceneDialogue(raw) };
}
