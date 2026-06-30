import { getTodayKey } from '../game/attendance';

const STORAGE_KEY = 'grow-coffee-cat-guide-v1';

type CatGuideRecord = {
  dateKey: string;
  fortuneGuideSeen: boolean;
  rouletteGuideSeen: boolean;
  /** 오늘 룰렛 안내 말풍선(나를 눌러라냥~) 표시 여부 */
  rouletteSceneDialogueSeen?: boolean;
};

function readRecord(): CatGuideRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CatGuideRecord;
  } catch {
    return null;
  }
}

function writeRecord(record: CatGuideRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

export function hasSeenCatFortuneGuideToday(dateKey = getTodayKey()) {
  const record = readRecord();
  return record?.dateKey === dateKey && record.fortuneGuideSeen === true;
}

export function hasSeenCatRouletteGuideToday(dateKey = getTodayKey()) {
  const record = readRecord();
  return record?.dateKey === dateKey && record.rouletteGuideSeen === true;
}

export function hasSeenDailyRouletteSceneDialogueToday(dateKey = getTodayKey()) {
  const record = readRecord();
  return record?.dateKey === dateKey && record.rouletteSceneDialogueSeen === true;
}

export function markDailyRouletteSceneDialogueSeenToday(dateKey = getTodayKey()) {
  const record = readRecord();
  writeRecord({
    dateKey,
    fortuneGuideSeen: record?.dateKey === dateKey ? record.fortuneGuideSeen : false,
    rouletteGuideSeen: record?.dateKey === dateKey ? record.rouletteGuideSeen : false,
    rouletteSceneDialogueSeen: true,
  });
}

export function markCatFortuneGuideSeenToday(dateKey = getTodayKey()) {
  const record = readRecord();
  writeRecord({
    dateKey,
    fortuneGuideSeen: true,
    rouletteGuideSeen: record?.dateKey === dateKey ? record.rouletteGuideSeen : false,
    rouletteSceneDialogueSeen:
      record?.dateKey === dateKey ? record.rouletteSceneDialogueSeen : false,
  });
}

export function markCatRouletteGuideSeenToday(dateKey = getTodayKey()) {
  const record = readRecord();
  writeRecord({
    dateKey,
    fortuneGuideSeen: record?.dateKey === dateKey ? record.fortuneGuideSeen : false,
    rouletteGuideSeen: true,
    rouletteSceneDialogueSeen:
      record?.dateKey === dateKey ? record.rouletteSceneDialogueSeen : false,
  });
}

export function resetCatRouletteGuideForToday(dateKey = getTodayKey()) {
  const record = readRecord();
  if (record?.dateKey !== dateKey) return;
  writeRecord({
    dateKey,
    fortuneGuideSeen: record.fortuneGuideSeen,
    rouletteGuideSeen: false,
    rouletteSceneDialogueSeen: false,
  });
}

/** 고양이 선물 보너스 룰렛 — 넛지·세션 dismiss를 다시 켜기 */
export function primeBonusRouletteNudge(dateKey = getTodayKey()) {
  resetCatRouletteGuideForToday(dateKey);
}

export function resetCatGuideStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
