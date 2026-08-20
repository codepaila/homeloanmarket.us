// Secure configuration helpers: encryption at rest for runtime secrets.
//
// Secrets (e.g. Stripe secret key, Stripe webhook signing secret) are never
// stored as plaintext in the database. They are encrypted with AES-256-GCM
// using a server-side key derived from STRIPE_ENCRYPTION_KEY (or AES_SECRET,
// then AUTH_SECRET as a fallback). Ciphertext is base64-encoded and stored in
// the `SecureConfig` model.
//
// Full secret values are NEVER returned to the browser, never logged, and
// never included in API responses, React props, error messages, or audit logs.
import crypto from 'crypto'
import prisma from '@/lib/prisma'

export type SecureConfigKey = 'stripe.secret_key' | 'stripe.webhook_secret'

function getEncryptionKey(): Buffer {
  const raw = process.env.STRIPE_ENCRYPTION_KEY || process.env.AES_SECRET || process.env.AUTH_SECRET
  if (!raw) {
    throw new Error('No encryption key configured for secure configuration')
  }
  // Derive a stable 32-byte key from the configured secret.
  return crypto.createHash('sha256').update(raw).digest()
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey()
  const raw = Buffer.from(ciphertext, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const data = raw.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export const SECURE_CONFIG_KEYS: Record<SecureConfigKey, string> = {
  'stripe.secret_key': 'Stripe Secret Key',
  'stripe.webhook_secret': 'Stripe Webhook Signing Secret',
}

// Reads and decrypts a stored secret. Returns null when not stored.
export async function getStoredSecret(key: SecureConfigKey): Promise<string | null> {
  const row = await prisma.secureConfig.findUnique({ where: { key } })
  if (!row?.value) return null
  try {
    return decryptSecret(row.value)
  } catch {
    // A corrupt/unreadable stored secret should never fail closed silently
    // into plaintext handling. Treat it as unset so the env fallback applies.
    return null
  }
}

// Encrypts and stores (create or update) a secret, recording an audit entry.
// `actorId` is the admin performing the change. Secrets are never written to
// the audit log.
export async function setStoredSecret(
  key: SecureConfigKey,
  plaintext: string,
  actorId: string | null,
  action: 'SET' | 'REPLACE' = 'SET',
  note?: string,
): Promise<void> {
  const value = encryptSecret(plaintext)
  await prisma.secureConfig.upsert({
    where: { key },
    update: { value, algorithm: 'aes-256-gcm', updatedById: actorId },
    create: { key, value, algorithm: 'aes-256-gcm', updatedById: actorId },
  })
  await prisma.secureConfigAudit.create({
    data: { configKey: key, action, actorId, note },
  })
}

// Returns whether a secret is currently stored (non-secret boolean).
export async function isStoredSecretSet(key: SecureConfigKey): Promise<boolean> {
  const row = await prisma.secureConfig.findUnique({ where: { key }, select: { key: true } })
  return Boolean(row)
}

// Returns the most recent audit entries for a config key (non-secret).
export async function getSecureConfigAudit(key: SecureConfigKey, limit = 20) {
  return prisma.secureConfigAudit.findMany({
    where: { configKey: key },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
