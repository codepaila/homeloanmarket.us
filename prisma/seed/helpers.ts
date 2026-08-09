import { PrismaClient } from '@prisma/client'
import { comparePassword, hashPassword } from '@/lib/aes'
import { SEED_CONFIG } from './config'

const prisma = new PrismaClient()

export { prisma, hashPassword }

export const DEMO_SEED_DATE = (() => {
  const configured = process.env.SEED_REFERENCE_DATE
  return configured ? new Date(configured) : new Date('2026-01-15T12:00:00.000Z')
})()

export function assertDemoDatabase() {
  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) throw new Error('DATABASE_URL is required for the isolated demo seed')

  const url = new URL(rawUrl)
  const databaseName = url.pathname.replace(/^\//, '')
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  const isDemoDatabase = /(^|[-_])(demo|phase13)([-_]|$)/i.test(databaseName)
  if (!isLocalHost || !isDemoDatabase) {
    throw new Error('Refusing to seed: DATABASE_URL must target a local database named with demo or phase13')
  }
}

export const ensureAdmin = async () => {
  const existing = await prisma.user.findUnique({ where: { email: SEED_CONFIG.admin.email } })
  if (existing) {
    const passwordIsValid = existing.password
      ? await comparePassword(SEED_CONFIG.admin.password, existing.password)
      : false
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: SEED_CONFIG.admin.name,
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
        ...(passwordIsValid ? {} : { password: await hashPassword(SEED_CONFIG.admin.password) }),
      },
    })
  }

  return prisma.user.create({
    data: {
      name: SEED_CONFIG.admin.name,
      email: SEED_CONFIG.admin.email,
      password: await hashPassword(SEED_CONFIG.admin.password),
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
    },
  })
}
