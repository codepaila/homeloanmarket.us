type PublicObject = Record<string, unknown>

export type PublicBrokerOptions = {
  /** Include protected contact fields. Server-controlled only. */
  includeContact?: boolean
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' ? value as PublicObject : null
}

export function toPublicBrokerRecord(value: unknown, options?: PublicBrokerOptions) {
  const broker = objectValue(value)
  if (!broker) return {}

  const includeContact = options?.includeContact === true
  const str = (v: unknown) => (v == null || v === '' ? null : String(v))
  const num = (v: unknown) => Number(v) || 0

  // Explicit allowlist — a public caller may only ever receive the identity,
  // marketing, professional, and trust signals below. Internal/CRM-facing
  // state (leads, view counters, broker status, privacy-dropped fields,
  // creation/update timestamps, geo internals) and relational payloads
  // (reviews, bank partners, count aggregates) are never leaked.
  return {
    profileSlug: str(broker.profileSlug) ?? '',
    displayName: String(broker.displayName ?? ''),
    companyName: str(broker.companyName),
    description: str(broker.description),
    nmls: str(broker.nmls),
    licenseStates: Array.isArray(broker.licenseStates) ? broker.licenseStates : [],
    city: str(broker.city),
    state: str(broker.state),
    logo: str(broker.logo),
    profileImage: str(broker.profileImage),
    coverImage: str(broker.coverImage),
    experienceYears: num(broker.experienceYears),
    avgRating: num(broker.avgRating),
    totalReviews: num(broker.totalReviews),
    socialLinks: broker.socialLinks && typeof broker.socialLinks === 'object'
      ? broker.socialLinks as PublicObject
      : null,
    user: (() => {
      const user = objectValue(broker.user)
      return user ? { name: user.name, image: user.image } : null
    })(),
    // Protected contact fields — only emitted when the caller is entitled
    // (FEATURED plan, broker owner, or admin).
    ...(includeContact ? {
      phone: str(broker.phone),
      whatsapp: str(broker.whatsapp),
      email: str(broker.email),
      website: str(broker.website),
      officeAddress: str(broker.officeAddress),
      pinCode: str(broker.pinCode),
    } : {}),
  }
}

// Compact public record for listing grid cards. Only the fields the public
// broker-card UI actually renders (plus the two server-computed badges) are
// emitted — reviews, bank partners, contact details, social links, and free
// text are deliberately excluded to keep the listing payload small.
export function toPublicBrokerListRecord(
  value: unknown,
  options: { isFeatured: boolean; isMortgageExpert: boolean },
) {
  const broker = objectValue(value)
  const raw = (broker ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (v == null || v === '' ? null : String(v))
  const num = (v: unknown) => Number(v) || 0
  return {
    id: str(raw.id) ?? '',
    profileSlug: str(raw.profileSlug) ?? '',
    displayName: String(raw.displayName ?? ''),
    companyName: str(raw.companyName),
    city: str(raw.city),
    state: str(raw.state),
    nmls: str(raw.nmls),
    logo: str(raw.logo),
    profileImage: str(raw.profileImage),
    avgRating: num(raw.avgRating),
    totalReviews: num(raw.totalReviews),
    experienceYears: num(raw.experienceYears),
    isFeatured: options.isFeatured,
    isMortgageExpert: options.isMortgageExpert,
  }
}
