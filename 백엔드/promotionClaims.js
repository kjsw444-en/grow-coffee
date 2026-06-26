import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabase.js'
import { patchLocalDb, readLocalDb } from './store.js'
import { getTodayKey } from './waterQuota.js'

export const COFFEE_VALUE_CLAIM_TYPE = 'coffee-value'
export const RANKING_TOP3_CLAIM_TYPE = 'ranking-top3'

function localClaimKey(userId, claimType, dayKey) {
  return `${userId}:${claimType}:${dayKey}`
}

function isMissingPromotionClaimsTable(error) {
  const message = String(error?.message ?? '')
  return message.includes('promotion_claims') || message.includes('claim_type')
}

export async function getPromotionClaim(userId, claimType = COFFEE_VALUE_CLAIM_TYPE, dayKey = getTodayKey()) {
  if (!userId) return null

  if (!isSupabaseAdminConfigured()) {
    const db = readLocalDb()
    return db.promotionClaims?.[localClaimKey(userId, claimType, dayKey)] ?? null
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('promotion_claims')
    .select('user_id, claim_type, day_key, reward_key, claimed_at')
    .eq('user_id', userId)
    .eq('claim_type', claimType)
    .eq('day_key', dayKey)
    .maybeSingle()

  if (error) {
    if (isMissingPromotionClaimsTable(error)) return null
    throw error
  }

  return data
}

export async function recordPromotionClaim({
  userId,
  claimType = COFFEE_VALUE_CLAIM_TYPE,
  dayKey = getTodayKey(),
  rewardKey,
}) {
  if (!userId) {
    throw new Error('userId is required')
  }

  const safeRewardKey = String(rewardKey || '').trim()
  if (!safeRewardKey) {
    throw new Error('rewardKey is required')
  }

  const claimedAt = new Date().toISOString()

  if (!isSupabaseAdminConfigured()) {
    patchLocalDb((db) => {
      db.promotionClaims ??= {}
      db.promotionClaims[localClaimKey(userId, claimType, dayKey)] = {
        userId,
        claimType,
        dayKey,
        rewardKey: safeRewardKey,
        claimedAt,
      }
    })
    return { userId, claimType, dayKey, rewardKey: safeRewardKey, claimedAt }
  }

  const supabase = getSupabaseAdmin()
  const row = {
    user_id: userId,
    claim_type: claimType,
    day_key: dayKey,
    reward_key: safeRewardKey,
    claimed_at: claimedAt,
  }
  const { data, error } = await supabase
    .from('promotion_claims')
    .upsert(row, { onConflict: 'user_id,claim_type,day_key' })
    .select('user_id, claim_type, day_key, reward_key, claimed_at')
    .single()

  if (error) {
    if (isMissingPromotionClaimsTable(error)) return row
    throw error
  }

  return data
}

export async function deletePromotionClaim(
  userId,
  claimType = COFFEE_VALUE_CLAIM_TYPE,
  dayKey = getTodayKey(),
) {
  if (!userId) return

  if (!isSupabaseAdminConfigured()) {
    patchLocalDb((db) => {
      if (!db.promotionClaims) return
      delete db.promotionClaims[localClaimKey(userId, claimType, dayKey)]
    })
    return
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('promotion_claims')
    .delete()
    .eq('user_id', userId)
    .eq('claim_type', claimType)
    .eq('day_key', dayKey)

  if (error && !isMissingPromotionClaimsTableError(error)) {
    throw error
  }
}
