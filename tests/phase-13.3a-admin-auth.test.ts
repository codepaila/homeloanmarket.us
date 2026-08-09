import assert from 'node:assert/strict'
import test from 'node:test'
import { SEED_CONFIG } from '../prisma/seed/config'

const database = process.env.PHASE13_AUTH_DATABASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('seeded Admin credentials authorize through the real Credentials provider', { skip: !database }, async () => {
  const { authOptions } = await import('../lib/auth.config')
  const provider = authOptions.providers.find((candidate) => candidate.id === 'credentials') as typeof authOptions.providers[number] & {
    options: { authorize: (credentials: { email: string; password: string }) => Promise<{ role?: string } | null> }
  }

  const authorized = await provider.options.authorize({
    email: SEED_CONFIG.admin.email,
    password: SEED_CONFIG.admin.password,
  })
  assert.equal(authorized?.role, 'ADMIN')
})

test('wrong Admin password and unknown email are rejected by Credentials provider', { skip: !database }, async () => {
  const { authOptions } = await import('../lib/auth.config')
  const provider = authOptions.providers.find((candidate) => candidate.id === 'credentials') as typeof authOptions.providers[number] & {
    options: { authorize: (credentials: { email: string; password: string }) => Promise<{ role?: string } | null> }
  }

  assert.equal(await provider.options.authorize({ email: SEED_CONFIG.admin.email, password: 'not-the-seeded-password' }), null)
  assert.equal(await provider.options.authorize({ email: 'missing-admin@example.test', password: 'not-the-seeded-password' }), null)
})

test('inactive demo User cannot authenticate', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { authOptions } = await import('../lib/auth.config')
  const provider = authOptions.providers.find((candidate) => candidate.id === 'credentials') as typeof authOptions.providers[number] & {
    options: { authorize: (credentials: { email: string; password: string }) => Promise<{ role?: string } | null> }
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'hannah.moore@example.com' } })
  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })
  try {
    assert.equal(await provider.options.authorize({ email: 'hannah.moore@example.com', password: 'LocalDev!2026' }), null)
  } finally {
    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } })
  }
})
