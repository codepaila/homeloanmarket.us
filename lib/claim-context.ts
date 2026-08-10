import crypto from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'hlm_claim_context'
const MAX_AGE_SECONDS = 30 * 60

export type ClaimContext = {
  claimId: string
  invitationId: string
  tokenHash: string
  expiresAt: number
  email?: string
  reauthenticatedAt?: number
  reauthenticatedVia?: 'google' | 'credentials'
}

function secret() {
  // AUTH_SECRET is the single canonical authentication secret, shared with
  // Auth.js and proxy.ts. The claim-context cookie is a session-adjacent
  // HMAC, so it must derive from the same source of truth.
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is required for claim context')
  return 'development-claim-context-secret'
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString()
}

function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export async function setClaimContext(context: Omit<ClaimContext, 'expiresAt'> & { expiresAt?: number }) {
  const value: ClaimContext = {
    ...context,
    expiresAt: context.expiresAt || Date.now() + MAX_AGE_SECONDS * 1000,
  }
  const payload = encode(JSON.stringify(value))
  const signed = `${payload}.${sign(payload)}`
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function getClaimContext() {
  const value = (await cookies()).get(COOKIE_NAME)?.value
  if (!value) return null

  const [payload, signature] = value.split('.')
  const expected = payload ? sign(payload) : ''
  if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  )) return null

  try {
    const context = JSON.parse(decode(payload)) as ClaimContext
    if (!context.claimId || !context.invitationId || !context.tokenHash || context.expiresAt <= Date.now()) return null
    return context
  } catch {
    return null
  }
}

export async function clearClaimContext() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export const CLAIM_CONTEXT_MAX_AGE_SECONDS = MAX_AGE_SECONDS
