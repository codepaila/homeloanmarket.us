// Broker social media links — canonical shape + validation.
//
// The Broker model stores social links as a single dedicated JSON field
// (`socialLinks`) with the shape:
//
//   { facebook?: string | null, twitter?: string | null,
//     linkedin?: string | null, instagram?: string | null }
//
// This module is deliberately framework-free so it can be reused by the
// server route (authoritative validation) and the client form (inline errors).

export const SOCIAL_LINK_KEYS = ['facebook', 'twitter', 'linkedin', 'instagram'] as const
export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number]

export type BrokerSocialLinks = Partial<Record<SocialLinkKey, string | null>>

const SOCIAL_LINK_LABELS: Record<SocialLinkKey, string> = {
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
}

/**
 * Accepts only HTTP(S) URLs. Rejects dangerous schemes such as `javascript:`,
 * `data:`, `vbscript:` and any other non-HTTP protocol. HTTPS is preferred,
 * but plain HTTP is tolerated to preserve existing project conventions.
 */
export function isSafeHttpUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Normalize a single raw social link input:
 *  - whitespace is trimmed
 *  - empty/null/undefined become null (the "cleared" convention)
 *  - non-string or non-HTTP(S) values are invalid
 * Returns `{ ok: true, value: string | null }` or `{ ok: false, error }`.
 */
export function normalizeSocialLink(raw: unknown, key: SocialLinkKey) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true as const, value: null as string | null }
  }
  if (typeof raw !== 'string') {
    return { ok: false as const, error: `${SOCIAL_LINK_LABELS[key]} must be a valid URL` }
  }
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { ok: true as const, value: null as string | null }
  }
  if (!isSafeHttpUrl(trimmed)) {
    return {
      ok: false as const,
      error: `${SOCIAL_LINK_LABELS[key]} must be a valid https:// URL`,
    }
  }
  return { ok: true as const, value: trimmed }
}

export type NormalizeSocialLinksResult =
  | { ok: true; value: BrokerSocialLinks }
  | { ok: false; error: string }

/**
 * Validate and normalize a social-links payload.
 *
 * The social field is dedicated exclusively to social links, so when any key
 * is present in the input the whole object is rebuilt from the four keys
 * (missing keys are treated as cleared/null). Empty values are normalized to
 * null; they are never persisted as UI placeholder URLs.
 */
export function normalizeSocialLinks(input: Partial<Record<SocialLinkKey, unknown>>): NormalizeSocialLinksResult {
  const present = SOCIAL_LINK_KEYS.some((key) => input[key] !== undefined)
  if (!present) {
    return { ok: true, value: {} }
  }

  const value: BrokerSocialLinks = {}
  for (const key of SOCIAL_LINK_KEYS) {
    const result = normalizeSocialLink(input[key], key)
    if (!result.ok) return { ok: false, error: result.error }
    value[key] = result.value
  }
  return { ok: true, value }
}

/** True when the normalized social object contains at least one URL. */
export function hasAnySocialLink(value: BrokerSocialLinks | null | undefined): boolean {
  if (!value) return false
  return SOCIAL_LINK_KEYS.some((key) => Boolean(value[key]))
}
