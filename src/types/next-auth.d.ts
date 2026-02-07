import { UserTier } from '@/generated/prisma/client'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      tier: UserTier
    } & DefaultSession['user']
  }

  interface User {
    tier?: UserTier
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string
    tier?: UserTier
  }
}
