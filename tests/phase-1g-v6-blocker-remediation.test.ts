import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('Phase 1G: Stripe customer creation requires current authenticated identity', () => {
  const source = read('actions/subscription.ts')
  assert.ok(source.includes('const user = await getCurrentUser()'))
  assert.ok(source.includes("if (!user?.email) throw new Error('Unauthorized')"))
  assert.ok(source.includes('email: user.email'))
  assert.ok(source.includes('userId: user.id'))
  assert.equal(source.includes('email,\n    name,'), false)
})

test('Phase 1G: alternate login helper requires IP rate limiting and generic errors', () => {
  const source = read('actions/auth.action.ts')
  const block = source.slice(source.indexOf('export async function loginCheckUser'), source.indexOf('// export async function loginCheckUser'))
  assert.ok(block.includes('ip: string'))
  assert.ok(block.includes('loginRateLimit.limit(`login:${ip}`)'))
  assert.equal(block.includes('if (ip)'), false)
  assert.ok(block.includes('Invalid email or password.'))
  assert.equal(block.includes('EmailNotVerified'), false)
  assert.equal(block.includes('AccountInactive'), false)
})

test('Phase 1G: generic current user explicitly excludes credential/token scalars', () => {
  const source = read('lib/currentUser.ts')
  assert.ok(source.includes('select:'))
  for (const field of ['password: true', 'emailVerificationToken: true', 'resetPasswordToken: true', 'accounts: true', 'contactMessages: true']) {
    assert.equal(source.includes(field), false, `${field} must not be selected by generic currentUser`)
  }
  assert.ok(source.includes('Credentials and token fields are never'))
})

test('Phase 1G: reset tokens require a non-null future expiry', () => {
  const source = read('app/api/auth/reset-password/route.ts')
  assert.ok(source.includes('!user.resetPasswordTokenExpiry'))
  assert.ok(source.includes('resetPasswordToken: null'))
  assert.ok(source.includes("createHash('sha256')"))
})

test('Phase 1G: alternate checkout action uses server-derived idempotency', () => {
  const source = read('actions/subscription.ts')
  assert.ok(source.includes('stripe.checkout.sessions.create'))
  assert.ok(source.includes('idempotencyKey: `checkout_${user.id}_${customerId}_${plan}_${priceId}`'))
  assert.ok(source.includes('validatePlanPrice(plan, priceId)'))
  assert.ok(source.includes('user.id !== userId'))
})
