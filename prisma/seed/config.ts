export const SEED_CONFIG = {
  admin: {
    name: 'HomeLoanMarket Administrator',
    email: 'admin@homeloanmarket.com',
    username: 'admin',
    password: 'Admin@123456',
  },
} as const

export type SeedConfig = typeof SEED_CONFIG
