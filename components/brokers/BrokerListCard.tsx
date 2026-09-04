'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  CheckCircle,
  Heart,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RatingStars } from '@/components/design/RatingStars'
import { PremiumButton } from '@/components/design/PremiumButton'
import { BrokerAvatar } from '@/components/brokers/BrokerAvatar'
import { MortgageExpertBadge } from '@/components/brokers/MortgageExpertBadge'

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

interface BrokerListCardProps {
  slug: string
  name?: string
  company?: string
  location?: string
  logo?: string
  profileImage?: string
  rating?: number
  reviewCount?: number
  yearsExperience?: number
  isVerified?: boolean
  isFeatured?: boolean
  isPremium?: boolean
  isMortgageExpert?: boolean
  description?: string
  supportedBanks?: string[]
  className?: string
}

export default function BrokerListCard({
  slug,
  name,
  company,
  location,
  logo,
  profileImage,
  rating = 0,
  reviewCount = 0,
  yearsExperience = 0,
  isVerified = false,
  isFeatured = false,
  isPremium = false,
  isMortgageExpert = false,
  description,
  supportedBanks = [],
  className,
}: BrokerListCardProps) {
  const [isFavorite, setIsFavorite] = useState(
    () => readFavorites().includes(slug),
  )

  const toggleFavorite = () => {
    const current = readFavorites()
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug]
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable — keep in-memory state */
    }
    setIsFavorite(!isFavorite)
  }

  // Real data only — empty fields are hidden, never placeholder
  const validBanks = supportedBanks.filter(Boolean)
  const displayLocation = location || ''
  const showRating = rating > 0 || reviewCount > 0

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded',
        'border border-border bg-card shadow-soft transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-large',
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-2 p-4 md:p-5">
        {/* ===== Top row: logo · name + rating + badges · View ===== */}
        <div className="flex items-start gap-3">
          <div className="relative h-14 w-14 flex-shrink-0">
            <BrokerAvatar src={profileImage || logo} alt={company || name || 'Mortgage Originator'} name={name || company} className="h-full w-full" />
            {isVerified && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <CheckCircle className="h-3 w-3 text-white" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {name && (
                <h3 className="line-clamp-1 text-lg font-bold text-foreground">
                  <Link
                    href={`/brokers/${slug}`}
                    className="transition-colors hover:text-primary"
                  >
                    {name}
                  </Link>
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

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {isPremium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-700 ring-1 ring-purple-600/20 dark:text-purple-300 dark:ring-purple-400/30">
                  <Award className="h-3 w-3" />
                  Premium
                </span>
              )}
              {isFeatured && !isPremium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-600/20 dark:text-amber-300 dark:ring-amber-400/30">
                  <Star className="h-3 w-3 fill-current" />
                  Mortgage Expert
                </span>
              )}
              {isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/30">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </span>
              )}
              {isMortgageExpert && <MortgageExpertBadge />}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite ? 'Remove from favorites' : 'Save to favorites'
              }
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200',
                isFavorite
                  ? 'border-red-200 bg-red-50 text-red-500 dark:border-red-500/30 dark:bg-red-500/10'
                  : 'border-border bg-background text-muted-foreground hover:border-red-300 hover:text-red-500',
              )}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </button>
            <Link
              href={`/brokers/${slug}`}
              className="hidden items-center gap-0.5 rounded px-1.5 py-1 text-xs font-semibold text-primary transition-colors hover:text-primary hover:underline sm:inline-flex"
            >
              View
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* ===== Company ===== */}
        {company && (
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {company}
          </p>
        )}

        {/* ===== Meta: Experience • Location ===== */}
        {(yearsExperience > 0 || displayLocation) && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {yearsExperience > 0 && <span>{yearsExperience}+ Years of Experience</span>}
            {yearsExperience > 0 && displayLocation && <Dot />}
            {displayLocation && <span>{displayLocation}</span>}
          </p>
        )}

        {/* ===== Meta: Bank Partners ===== */}
        {validBanks.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                Bank Partners:
              </span>{' '}
              {validBanks.slice(0, 3).join(', ')}
              {validBanks.length > 3 && ` +${validBanks.length - 3}`}
            </span>
          </p>
        )}

        {/* ===== Short description ===== */}
        {description && (
          <p className="line-clamp-1 text-sm leading-snug text-muted-foreground">
            {description}
          </p>
        )}

        {/* ===== CTA ===== */}
        <div className="mt-auto flex gap-2 pt-2">
          <Link href={`/brokers/${slug}`} className="min-w-0 flex-1">
            <PremiumButton size="sm" fullWidth>
              View Profile
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </PremiumButton>
          </Link>
          <Link
            href={`/brokers/${slug}#contact`}
            className="min-w-0 flex-1"
          >
            <PremiumButton variant="outline" size="sm" fullWidth>
              Contact Mortgage Originator
            </PremiumButton>
          </Link>
        </div>
      </div>
    </article>
  )
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-muted-foreground/50">
      •
    </span>
  )
}
