type PublicObject = Record<string, unknown>

// Protected contact fields are only emitted when the caller is entitled
// (FEATURED plan, broker owner, or admin). They must never leak to anonymous
// or FREE-plan callers.
const PROTECTED_CONTACT_FIELDS = ['phone', 'whatsapp', 'email', 'website', 'officeAddress', 'pinCode'] as const

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

  const {
    id: _id,
    userId: _userId,
    subscription: _subscription,
    claim: _claim,
    contactMessages: _contactMessages,
    registrationNumber: _registrationNumber,
    panNumber: _panNumber,
    creationSource: _creationSource,
    verifiedAt: _verifiedAt,
    featuredRank: _featuredRank,
    isVisible: _isVisible,
    // Admin-controlled badge flag — never leaks to public callers. Public
    // consumers receive the derived `isMortgageExpert` boolean instead.
    mortgageExpertEnabled: _mortgageExpertEnabled,
    // Protected contact fields — dropped unless includeContact is true.
    phone: _phone,
    whatsapp: _whatsapp,
    email: _email,
    website: _website,
    officeAddress: _officeAddress,
    pinCode: _pinCode,
    reviews,
    bankPartners,
    _count,
    user,
    ...publicBroker
  } = broker
  const publicUser = objectValue(user)
  const publicReviews = Array.isArray(reviews)
    ? reviews.map((review) => {
        const record = objectValue(review)
        if (!record) return review
        const { rating, comment, createdAt, user: reviewer } = record
        const reviewerRecord = objectValue(reviewer)
        return {
          rating,
          comment,
          createdAt,
          user: reviewerRecord
            ? { name: reviewerRecord.name, image: reviewerRecord.image }
            : null,
        }
      })
    : []

  const publicBankPartners = Array.isArray(bankPartners)
    ? bankPartners.map((bank) => {
        const record = objectValue(bank)
        return record
          ? { bankName: record.bankName, bankType: record.bankType, since: record.since }
          : bank
      })
    : []

  const contact = includeContact
    ? {
        phone: _phone,
        whatsapp: _whatsapp,
        email: _email,
        website: _website,
        officeAddress: _officeAddress,
        pinCode: _pinCode,
      }
    : {}

  return {
    ...publicBroker,
    ...contact,
    nmls: publicBroker.nmls ?? null,
    licenseStates: publicBroker.licenseStates ?? [],
    user: publicUser
      ? { name: publicUser.name, image: publicUser.image }
      : null,
    reviews: publicReviews,
    bankPartners: publicBankPartners,
    _count: _count && typeof _count === 'object'
      ? { reviews: objectValue(_count)?.reviews }
      : undefined,
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
