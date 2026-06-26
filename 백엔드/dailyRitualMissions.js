/** @typedef {'M_HARVEST_2' | 'M_MINIGAME_ANY' | 'M_ROULETTE'} RitualMissionId */

export const RITUAL_MISSION_REWARD_CUPS = 10

export const RITUAL_MISSION_DEFINITIONS = {
  M_HARVEST_2: {
    label: '커피 수확 2번',
    shortLabel: '수확 2번',
    description: '오늘 커피를 2번 수확하세요.',
    goal: 2,
    trackField: 'ritualMissionHarvestCount',
  },
  M_MINIGAME_ANY: {
    label: '미니게임 1번',
    shortLabel: '미니게임',
    description: '미니게임을 1번 플레이하세요.',
    goal: 1,
    trackField: 'ritualMissionMinigameDone',
  },
  M_ROULETTE: {
    label: '룰렛 1번',
    shortLabel: '룰렛',
    description: '오늘의 룰렛을 1번 돌리세요.',
    goal: 1,
    trackField: 'ritualMissionRouletteDone',
  },
}

export const RITUAL_MISSION_IDS = Object.keys(RITUAL_MISSION_DEFINITIONS)

/** MVP: 고정 3개 미션 (매일 동일) */
export const RITUAL_DAILY_MISSION_SET = ['M_HARVEST_2', 'M_MINIGAME_ANY', 'M_ROULETTE']

export function getRitualMissionDefinition(missionId) {
  return RITUAL_MISSION_DEFINITIONS[missionId] ?? null
}

export function isRitualMissionComplete(state, missionId, slotIndex) {
  const def = getRitualMissionDefinition(missionId)
  if (!def) {
    return false
  }

  switch (missionId) {
    case 'M_HARVEST_2': {
      const count = Math.max(0, Number(state?.ritualMissionHarvestCount ?? 0))
      return count >= def.goal
    }
    case 'M_MINIGAME_ANY': {
      const slotDone = readMissionSlotDone(state, slotIndex)
      return slotDone || Boolean(state?.ritualMissionMinigameDone)
    }
    case 'M_ROULETTE': {
      const slotDone = readMissionSlotDone(state, slotIndex)
      return slotDone || Boolean(state?.ritualMissionRouletteDone)
    }
    default:
      return false
  }
}

function readMissionSlotDone(state, slotIndex) {
  const key = `ritualMission${slotIndex + 1}Done`
  return Boolean(state?.[key])
}

export function markRitualMissionSlotDone(state, slotIndex) {
  const key = `ritualMission${slotIndex + 1}Done`
  return { ...state, [key]: true }
}

export function allRitualMissionsComplete(state) {
  for (let i = 0; i < RITUAL_DAILY_MISSION_SET.length; i++) {
    const missionId = readMissionIdForSlot(state, i)
    if (!isRitualMissionComplete(state, missionId, i)) {
      return false
    }
  }
  return true
}

export function readMissionIdForSlot(state, slotIndex) {
  const key = `ritualMission${slotIndex + 1}Id`
  const stored = String(state?.[key] ?? '').trim()
  if (stored && RITUAL_MISSION_DEFINITIONS[stored]) {
    return stored
  }
  return RITUAL_DAILY_MISSION_SET[slotIndex] ?? RITUAL_DAILY_MISSION_SET[0]
}

export function buildMissionProgress(state) {
  return RITUAL_DAILY_MISSION_SET.map((fallbackId, index) => {
    const missionId = readMissionIdForSlot(state, index) || fallbackId
    const def = getRitualMissionDefinition(missionId)
    let current = 0
    let goal = def?.goal ?? 1

    if (missionId === 'M_HARVEST_2') {
      current = Math.min(goal, Math.max(0, Number(state?.ritualMissionHarvestCount ?? 0)))
    } else if (missionId === 'M_MINIGAME_ANY') {
      current = isRitualMissionComplete(state, missionId, index) ? 1 : 0
    } else if (missionId === 'M_ROULETTE') {
      current = isRitualMissionComplete(state, missionId, index) ? 1 : 0
    }

    return {
      slot: index + 1,
      missionId,
      label: def?.label ?? missionId,
      shortLabel: def?.shortLabel ?? missionId,
      description: def?.description ?? '',
      current,
      goal,
      done: isRitualMissionComplete(state, missionId, index),
    }
  })
}

export function onRitualHarvest(state) {
  const count = Math.max(0, Number(state?.ritualMissionHarvestCount ?? 0)) + 1
  let next = { ...state, ritualMissionHarvestCount: count }

  const harvestSlot = RITUAL_DAILY_MISSION_SET.indexOf('M_HARVEST_2')
  if (harvestSlot >= 0 && count >= RITUAL_MISSION_DEFINITIONS.M_HARVEST_2.goal) {
    next = markRitualMissionSlotDone(next, harvestSlot)
  }

  return next
}

export function onRitualMinigamePlayed(state) {
  let next = { ...state, ritualMissionMinigameDone: true }
  const slot = RITUAL_DAILY_MISSION_SET.indexOf('M_MINIGAME_ANY')
  if (slot >= 0) {
    next = markRitualMissionSlotDone(next, slot)
  }
  return next
}

export function onRitualRouletteSpun(state) {
  let next = { ...state, ritualMissionRouletteDone: true }
  const slot = RITUAL_DAILY_MISSION_SET.indexOf('M_ROULETTE')
  if (slot >= 0) {
    next = markRitualMissionSlotDone(next, slot)
  }
  return next
}
