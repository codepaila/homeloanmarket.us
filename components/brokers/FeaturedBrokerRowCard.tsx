'use client'

import * as React from 'react'
import Link from 'next/link'
import { Heart, Star, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RatingStars } from '@/components/design/RatingStars'
import { PremiumButton } from '@/components/design/PremiumButton'
import { BrokerAvatar } from '@/components/brokers/BrokerAvatar'
import { MortgageExpertBadge } from '@/components/brokers/MortgageExpertBadge'
import { Badge } from '@/components/ui/badge'

const FAVORITES_KEY = 'hlm-favorite-brokers'

function readFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface FeaturedBrokerRowCardProps {
  broker: {
    id: string
    profileSlug: string
    displayName: string
    companyName?: string
    logo?: string
    profileImage?: string
    avgRating?: number
    totalReviews?: number
    experienceYears?: number
    verificationStatus?: string
    brokerStatus?: string
    description?: string
    city?: string
    state?: string
    phone?: string
    email?: string
    user?: { name?: string; phone?: string; email?: string }
    bankPartners?: { bankName: string }[]
    subscription?: { plan?: string; isActive?: boolean; endDate?: string | Date | null }
    isMortgageExpert?: boolean
  }
}

export default function FeaturedBrokerRowCard({ broker }: FeaturedBrokerRowCardProps) {
  const [isFavorite, setIsFavorite] = React.useState(
    () => readFavorites().includes(broker.profileSlug),
  )

  const toggleFavorite = () => {
    const current = readFavorites()
    const next = current.includes(broker.profileSlug)
      ? current.filter((s) => s !== broker.profileSlug)
      : [...current, broker.profileSlug]
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
    setIsFavorite(!isFavorite)
  }

  const name =
    broker.user?.name || broker.displayName || broker.companyName || ''
  const company = broker.companyName || ''
  const location =
    broker.city || broker.state || ''
  const logo = broker.profileImage || broker.logo
  const rating = broker.avgRating || 0
  const reviewCount = broker.totalReviews || 0
  const yearsExperience = broker.experienceYears || 0
  const isVerified = broker.verificationStatus === 'VERIFIED'
  const isFeatured =
    broker.subscription?.isActive === true &&
    broker.subscription?.plan === 'FEATURED' &&
    (!broker.subscription.endDate || new Date(broker.subscription.endDate) > new Date())
  const description = broker.description
  const supportedBanks = (broker.bankPartners || []).map((bp) => bp.bankName)

  const validBanks = supportedBanks.filter(Boolean)
  const displayLocation = location || ''
  const showRating = rating > 0 || reviewCount > 0

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl',
        'border border-border bg-card shadow-soft transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-large',
        'md:flex-row md:items-stretch',
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-5 md:flex-row md:items-center md:gap-6 md:p-6">
        {/* Left: Logo */}
        <div className="flex-shrink-0">
          <div className="relative flex h-16 w-16 items-center justify-center md:h-20 md:w-20">
            <BrokerAvatar src={logo} alt={company || name || 'Mortgage Broker'} name={company || name} className="h-full w-full" />
          </div>
        </div>

        {/* Center: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {name && (
              <h3 className="text-lg font-bold text-text-main md:text-xl">
                {name}
              </h3>
            )}
            {showRating && (
              <RatingStars
                rating={rating}
                totalReviews={reviewCount}
                size="sm"
                showCount={reviewCount > 0}
              />
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {company && (
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {company}
              </span>
            )}
            {isFeatured && (
              <Badge
                variant="secondary"
                className="border-0 bg-amber-500 text-white"
              >
                <Star className="mr-1 h-3 w-3 fill-current" />
                Featured
              </Badge>
            )}
            {isVerified && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
            {broker.isMortgageExpert && <MortgageExpertBadge />}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
            {yearsExperience > 0 && (
              <span>{yearsExperience}+ years experience</span>
            )}
            {displayLocation && <span>{displayLocation}</span>}
          </div>

          {validBanks.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
              <span>
                <span className="font-medium text-text-main">Bank Partners:</span>{' '}
                {validBanks.slice(0, 3).join(', ')}
                {validBanks.length > 3 && ` +${validBanks.length - 3}`}
              </span>
            </div>
          )}

          {description && (
            <p className="mt-2 line-clamp-2 text-sm leading-snug text-text-muted">
              {description}
            </p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-shrink-0 flex-col items-stretch gap-2 md:w-[160px]">
          <Link href={`/brokers/${broker.profileSlug}`}>
            <PremiumButton size="sm" fullWidth variant="outline">
              View Profile
            </PremiumButton>
          </Link>
          <Link href={`/brokers/${broker.profileSlug}#contact`}>
            <PremiumButton size="sm" fullWidth>
              Contact Broker
            </PremiumButton>
          </Link>
          <button
            type="button"
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Save to favorites'
            }
            className={cn(
              'flex h-9 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition-all duration-200',
              isFavorite
                ? 'border-red-200 bg-red-50 text-red-500 dark:border-red-500/30 dark:bg-red-500/10'
                : 'border-border bg-background text-text-muted hover:border-red-300 hover:text-red-500',
            )}
          >
            <Heart
              className={cn('h-4 w-4', isFavorite && 'fill-current')}
            />
            <span className="hidden sm:inline">
              {isFavorite ? 'Saved' : 'Save'}
            </span>
          </button>
        </div>
      </div>
    </article>
  )
}
