export type AuthUser = {
  name: string
  rank: number | null
  source: 'mock' | 'guest' | 'toss' | 'offline'
  userId: string
}
