import { formatTreeGrowthPercent, formatWon } from './utils';



/** 행동 후 대화창이 사라지기까지 대기(ms) */

export const SCENE_DIALOGUE_IDLE_MS = 2400;



/** 대화창 한 줄 최대 글자 수(가독성용 줄바꿈) */

const DIALOGUE_LINE_WIDTH = 16;



export function sceneDialogueForHoldStart(mode: import('./constants').HoldMode) {

  return mode === 'brew' ? '커피를 내리고 있어요...' : '물을 주고 있어요...';

}



export function sceneDialogueForHoldCancel() {

  return '물주기를 그만두었어요.';

}



export function sceneDialogueForGrowthComplete(mode: import('./constants').HoldMode, stageLabel: string, growth: number) {

  if (growth >= 100) {

    return formatSceneDialogue('커피가 완성됐어요! 커피 마시기를 눌러 주세요.');

  }



  if (mode === 'brew') {

    return formatSceneDialogue(`커피가 익어가요! ${stageLabel} · 성장 ${formatTreeGrowthPercent(growth)}`);

  }



  return formatSceneDialogue(`${stageLabel} 단계로 자라고 있어요! 성장 ${formatTreeGrowthPercent(growth)}`);

}



export function sceneDialogueForDrink(cups = 1) {

  return formatSceneDialogue(`커피를 마셨어요! 내린 커피 +${cups}`);

}



export function sceneDialogueForSellBatch(cupCount: number, reward: number) {

  return formatSceneDialogue(
    `내린 커피 ${cupCount.toLocaleString('ko-KR')}잔을 마셨어요! ${formatWon(reward)} 포인트를 받았어요.`,
  );

}

export function sceneDialogueForDailyPointCap() {
  return formatSceneDialogue(
    '오늘은 커피 한 잔 값(4,700원)만큼 받았어요! ☕\n내일도 커피나무와 함께 키워봐요.',
  );
}

export function sceneDialogueForHiddenCharacterUnlock(label: string) {
  return formatSceneDialogue(`히든 커플 ${label}을(를) 만났어요! 💕\n새 영상을 확인해 보세요.`);
}

export function sceneDialogueForBrewedSpent200(totalSpent: number) {
  return formatSceneDialogue(
    `내린 커피 ${totalSpent.toLocaleString('ko-KR')}잔! 진짜 커피 애호가네요 ☕`,
  );
}

export function sceneDialogueForShopPurchase2(purchaseCount: number) {
  return formatSceneDialogue(
    `커피 상점에서 ${purchaseCount.toLocaleString('ko-KR')}번째 캐릭터까지 모았어요! 🛍️`,
  );
}

export function sceneDialogueForReviewPreviewComplete() {
  return formatSceneDialogue('[테스트] 여기서 토스 리뷰 팝업이 뜹니다.');
}

export function sceneDialogueForAttendanceGoal(baseDialogue: string) {
  return formatSceneDialogue(`${baseDialogue}\n오늘 출석 목표를 달성했어요! 옆에서 보상을 받아 주세요.`);
}

export function sceneDialogueForAttendanceDailyClaim(rewardCups: number) {
  return formatSceneDialogue(
    `출석 보상! 내린 커피 ${rewardCups.toLocaleString('ko-KR')}잔을 받았어요.`,
  );
}

export function sceneDialogueForAttendanceStreakClaim(rewardCups: number) {
  return formatSceneDialogue(
    `7일 연속 출석! 내린 커피 ${rewardCups.toLocaleString('ko-KR')}잔을 받았어요.`,
  );
}

/** @deprecated reviewPrompt REVIEW_PRIMING_COPY 사용 */
export function sceneDialogueForReviewPriming(copy: string) {
  return formatSceneDialogue(copy);
}



export function sceneDialogueForAdReward() {

  return formatSceneDialogue('확인 완료! 이제 다시 꾹 눌러 물주기·내리기를 할 수 있어요.');

}



export function sceneDialogueForShareReward(amount: number) {

  return formatSceneDialogue(`친구에게 공유했어요! 내린 커피 ${amount.toLocaleString('ko-KR')}잔을 받았어요.`);

}



export function sceneDialogueForPassiveReady() {
  return formatSceneDialogue('방치 커피 한잔을 받으세요.');
}

export function sceneDialogueForPassiveClaim() {
  return formatSceneDialogue('방치 커피+1 = 내린 커피+1');
}

export function sceneDialogueForPassiveReactivate() {
  return formatSceneDialogue('방치 커피가 다시 충전돼요! 햇빛을 받으며 모아보세요.');
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



export function sceneDialogueForDailyRouletteNudge() {
  return formatSceneDialogue('나를 눌러라냥~\n1일 1룰렛을 돌려서\n오늘의 보상을 받을수 있다냥~');
}

export function sceneDialogueForBonusRouletteNudge() {
  return formatSceneDialogue('선물로 룰렛 +1!\n나를 눌러 한 번 더\n돌려보라냥~');
}

export function sceneDialogueForDailyRitualFortuneNudge() {
  return formatSceneDialogue('나를 누르면 오늘의 선물을\n받을 수 있다냥~');
}

export function sceneDialogueForRevealedFortune(copy: string) {
  return formatSceneDialogue(copy);
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

