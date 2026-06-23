import { isSupabaseAdminConfigured } from './supabase.js'

export function getStorageMode() {
  return isSupabaseAdminConfigured() ? 'supabase' : 'local-file'
}

/** goldcat처럼 운영(production)에서는 Supabase 필수, 로컬 개발은 파일 저장 허용 */
export function isStorageReady() {
  if (isSupabaseAdminConfigured()) {
    return true
  }

  return process.env.NODE_ENV !== 'production'
}

export function storageUnavailableMessage() {
  return 'Supabase가 설정되지 않았습니다. Railway Variables에 SUPABASE_URL / SUPABASE_SECRET_KEY를 등록하세요.'
}
