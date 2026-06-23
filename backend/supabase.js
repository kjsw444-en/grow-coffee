import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

let adminClient = null

function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function isSupabaseAdminConfigured() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseSecretKey())
}

export function getSupabaseAdmin() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error('SUPABASE_URL과 SUPABASE_SECRET_KEY가 필요합니다.')
  }

  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, getSupabaseSecretKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: ws,
      },
    })
  }

  return adminClient
}
