import { describe, it, expect, beforeEach, afterEach } from 'vitest'

function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS
  if (raw && raw.trim().length > 0) {
    const parts = raw.split(',').map((v) => v.trim().toLowerCase())
    const valid = parts.filter((v) => v.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    const unique = Array.from(new Set(valid))
    if (unique.length > 0) return unique
  }

  const legacy = process.env.ADMIN_EMAIL
  if (legacy && legacy.trim().length > 0) {
    const normalized = legacy.trim().toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return [normalized]
    }
  }

  return []
}

describe('platformConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('resolves adminEmails from ADMIN_EMAILS env var', async () => {
    process.env.ADMIN_EMAILS = 'admin@test.com, ops@test.com'
    delete process.env.ADMIN_EMAIL
    expect(parseAdminEmails()).toEqual(['admin@test.com', 'ops@test.com'])
  })

  it('trims whitespace and removes invalid entries', async () => {
    process.env.ADMIN_EMAILS = '  admin@test.com  , invalid, , ops@test.com  '
    delete process.env.ADMIN_EMAIL
    expect(parseAdminEmails()).toEqual(['admin@test.com', 'ops@test.com'])
  })

  it('removes duplicates', async () => {
    process.env.ADMIN_EMAILS = 'admin@test.com, ADMIN@TEST.COM'
    delete process.env.ADMIN_EMAIL
    expect(parseAdminEmails()).toEqual(['admin@test.com'])
  })

  it('falls back to legacy ADMIN_EMAIL when ADMIN_EMAILS is missing', async () => {
    delete process.env.ADMIN_EMAILS
    process.env.ADMIN_EMAIL = 'legacy@test.com'
    expect(parseAdminEmails()).toEqual(['legacy@test.com'])
  })

  it('returns empty array when neither ADMIN_EMAILS nor ADMIN_EMAIL is set', async () => {
    delete process.env.ADMIN_EMAILS
    delete process.env.ADMIN_EMAIL
    expect(parseAdminEmails()).toEqual([])
  })
})
