import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const source = () => read('prisma/seed/index.ts')

test('canonical seed requires the runtime DATABASE_URL', () => {
  const code = source()
  assert.ok(code.includes('process.env.DATABASE_URL'))
  assert.ok(code.includes('DATABASE_URL is required'))
  assert.ok(code.includes('mongodb+srv:'))
  assert.ok(code.includes('mongodb:'))
})

test('canonical seed does not rewrite or expose the target database', () => {
  const code = source()
  assert.equal(code.includes('DATABASE_URL.replace'), false)
  assert.equal(code.includes('databaseName'), false)
  assert.ok(code.includes('Seed target:'))
  assert.equal(code.includes('console.log(process.env.DATABASE_URL'), false)
})

test('yarn seed is the only seed command', () => {
  const packageSource = read('package.json')
  assert.ok(packageSource.includes('prisma/seed/index.ts'))
  assert.equal(packageSource.includes('seed:demo'), false)
  assert.equal(packageSource.includes('seed:production'), false)
})

test('canonical seed writes real models and has no dry-run branch', () => {
  const code = source()
  for (const model of ['user', 'broker', 'brokerSubscription', 'mediaAsset', 'advertisement', 'setting']) {
    assert.ok(code.includes(`prisma.${model}.`), `${model} must be written`)
  }
  assert.equal(code.includes('SEED_DRY_RUN'), false)
  assert.equal(code.includes('no writes performed'), false)
})

test('broker fixture contains six profiles with an unowned claim candidate', () => {
  const code = source()
  const fixture = code.slice(code.indexOf('const brokerSpecs'), code.indexOf('const userSpecs'))
  assert.equal((fixture.match(/key: '[a-z-]+', first:/g) || []).length, 6)
  assert.ok(code.includes('userId: spec.owned ? users[spec.key].id : null'))
  assert.ok(fixture.includes("owned: false"))
  assert.ok(code.includes('serviceCities: [spec.city]'))
  assert.ok(code.includes('profileSlug: slug'))
})

test('users use hashed deterministic seed passwords', () => {
  const code = source()
  assert.ok(code.includes('hashPassword(SEED_PASSWORD)'))
  assert.ok(code.includes('comparePassword(SEED_PASSWORD'))
  assert.equal(code.includes('console.log(SEED_PASSWORD)'), false)
  assert.equal(code.includes('password: SEED_PASSWORD'), false)
})

test('reset clears every Prisma model before fixture creation', () => {
  const code = source()
  const models = ['adEvent', 'advertisementCreative', 'advertisement', 'mediaAsset', 'mediaFolder', 'supportMessage', 'supportTicket', 'message', 'notification', 'review', 'contactMessage', 'brokerBank', 'brokerClaimEvent', 'brokerClaimInvitation', 'brokerClaim', 'brokerSubscription', 'account', 'broker', 'loanProduct', 'bank', 'property', 'blogPost', 'fAQ', 'testimonial', 'setting', 'stripeWebhookEvent', 'user']
  for (const model of models) assert.ok(code.includes(`prisma.${model}.deleteMany()`), `${model} must be reset`)
  assert.ok(code.includes('resetTargetDatabase'))
  assert.ok(code.indexOf('const reset = await resetTargetDatabase()') < code.indexOf('await seedCanonicalData()'))
  assert.equal(code.includes('migrate reset'), false)
  assert.equal(code.includes('dropDatabase'), false)
})

test('destructive reset requires explicit production confirmation', () => {
  const code = source()
  assert.ok(code.includes("process.env.NODE_ENV === 'production'"))
  assert.ok(code.includes("process.env.SEED_ALLOW_DESTRUCTIVE !== 'true'"))
})

test('advertisement creatives use validation and deterministic remote metadata', () => {
  const code = source()
  assert.ok(code.includes('validateCreativeDimensions'))
  assert.ok(read('prisma/seed/demo-images.ts').includes('images.unsplash.com'))
  assert.ok(code.includes('advertisementId_format'))
  assert.ok(code.includes('tags: [\'seed-owned\']'))
})

test('seed creates claims through the schema and does not call Stripe', () => {
  const code = source()
  for (const forbidden of ['stripe.', 'access_token', 'resetPasswordToken']) {
    assert.equal(code.includes(forbidden), false, `${forbidden} must not be seeded`)
  }
  assert.ok(code.includes('brokerClaim.upsert'))
  assert.ok(code.includes('BrokerClaimStatus.COMPLETED'))
  assert.ok(code.includes('BrokerClaimStatus.INVITED'))
  assert.ok(code.includes('hashClaimToken'))
})

test('advertisements and media are owned by the configured admin', () => {
  const code = source()
  assert.ok(code.includes('const admin = await ensureAdmin()'))
  assert.ok(code.includes('seedMedia(admin.id)'))
  assert.ok(code.includes('seedAdvertisements(admin.id, assets)'))
  assert.ok(code.includes('createdById: adminId'))
  assert.equal(code.includes('seedAdvertisements(seedOwner.id'), false)
})

test('admin and claim relationships can be verified against a configured seed database', { skip: !process.env.SEED_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.SEED_TEST_DATABASE_URL!
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@homeloanmarket.com' } })
    assert.equal(admin.role, 'ADMIN')
    const ads = await prisma.advertisement.findMany({ where: { internalNotes: 'SEED_OWNED' }, select: { createdById: true, desktopMediaId: true } })
    assert.ok(ads.length >= 1)
    assert.ok(ads.every((ad) => ad.createdById === admin.id))
    const assets = await prisma.mediaAsset.findMany({ where: { tags: { has: 'seed-owned' } }, select: { uploaderId: true } })
    assert.ok(assets.length >= 1)
    assert.ok(assets.every((asset) => asset.uploaderId === admin.id))
    const claims = await prisma.brokerClaim.findMany({ include: { broker: true, invitations: true } })
    assert.ok(claims.some((claim) => claim.status === 'COMPLETED' && claim.broker.userId === claim.completedByUserId))
    assert.ok(claims.some((claim) => claim.status === 'INVITED' && claim.broker.userId === null && claim.invitations.some((invitation) => invitation.status === 'ACTIVE')))
  } finally {
    await prisma.$disconnect()
  }
})

test('seed is allowed to run for any intentionally configured MongoDB target', () => {
  const code = source()
  assert.equal(code.includes('localhost'), false)
  assert.equal(code.includes('Atlas'), false)
  assert.equal(code.includes('assertDemoDatabase'), false)
})
