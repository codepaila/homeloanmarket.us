'use client'

import Link from 'next/link'
import { BrokerAvatar } from '@/components/brokers/BrokerAvatar'
import { motion } from 'motion/react'
import {
  Star,
  MapPin,
  Award,
  CheckCircle,
  Phone,
  Mail,
  MessageCircle,
  ChevronRight,
  Banknote,
  Languages,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RatingStars } from '@/components/design/RatingStars'

interface BrokerCardProps {
  id?: string
  slug: string
  name: string
  company: string
  location: string
  nmls?: string
  logo?: string
  rating?: number
  reviewCount?: number
  yearsExperience?: number
  specializations?: string[]
  isVerified?: boolean
  isFeatured?: boolean
  isPremium?: boolean
  description?: string
  serviceCities?: string[]
  supportedBanks?: string[]
  languages?: string[]
  phone?: string
  email?: string
  showContact?: boolean
  viewMode?: 'grid' | 'list'
  className?: string
  priorityRank?: number
}

export default function BrokerCard({
  slug,
  name,
  company,
  location,
  nmls,
  logo,
  rating = 0,
  reviewCount = 0,
  yearsExperience = 0,
  specializations = [],
  isVerified = false,
  isFeatured = false,
  isPremium = false,
  description = '',
  serviceCities = [],
  supportedBanks = [],
  languages = [],
  phone,
  email,
  showContact = true,
  viewMode = 'grid',
  className,
}: BrokerCardProps) {
  const displayLocation = serviceCities?.[0] || location || 'Multiple Locations'
  const displayBanks = supportedBanks?.slice(0, 4) || []
  const displayLanguages = languages?.slice(0, 3) || []

  return (
    <motion.div
      layout
      className={cn(
        'group relative flex h-full flex-col rounded-2xl border border-border bg-card/80',
        'backdrop-blur-sm transition-all duration-300',
        'hover:shadow-large hover:-translate-y-1',
        viewMode === 'list' && 'md:flex-row md:items-stretch',
        className,
      )}
      whileHover={{ y: viewMode === 'grid' ? -4 : -2 }}
    >
      <Link
        href={`/brokers/${slug}`}
        className="flex flex-1 flex-col"
        aria-label={`View profile of ${name}`}
      >
        <div
          className={cn(
            'relative flex-1 overflow-hidden rounded-2xl p-6 transition-all duration-300',
            viewMode === 'grid'
              ? 'flex flex-col'
              : 'flex flex-col md:flex-1',
          )}
        >
          {/* Subtle brand hover wash */}
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            <div className="absolute inset-0 bg-primary/5" />
          </div>

          {/* Top Row: Logo, Name, Badges */}
          <div className="relative flex items-start gap-4">
            {/* Logo / Avatar */}
            <div className="relative flex-shrink-0">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <BrokerAvatar src={logo} alt={company || name || 'Mortgage Broker'} name={company || name} className="h-full w-full" />
              </div>

              {/* Verified ring */}
              {isVerified && (
                <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-card">
                  <CheckCircle className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium uppercase tracking-wider text-text-muted">
                    {company || 'Mortgage Broker'}
                  </p>
                  <h3 className="line-clamp-1 text-lg font-bold text-text-main transition-colors group-hover:text-primary">
                    {name}
                  </h3>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {isPremium && (
                    <Badge className="border-0 bg-purple-500 text-white">
                      <Award className="mr-1 h-3 w-3" />
                      Premium
                    </Badge>
                  )}
                  {isFeatured && !isPremium && (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-amber-500 text-white"
                    >
                      <Star className="mr-1 h-3 w-3 fill-current" />
                      Featured
                    </Badge>
                  )}
                  {isVerified && !isFeatured && !isPremium && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>

              {/* Rating */}
              <div className="mt-2">
                <RatingStars
                  rating={rating}
                  totalReviews={reviewCount}
                  size="sm"
                  showCount={true}
                />
              </div>

              {/* Location & Experience */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{displayLocation}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{yearsExperience}+ years</span>
                </div>
              </div>

              {/* Description */}
              {description && (
                <p className="mt-2 line-clamp-2 text-sm text-text-muted">
                  {description}
                </p>
              )}

              {/* Specializations */}
              {specializations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {specializations.slice(0, 3).map((spec, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-primary/5 text-xs text-primary"
                    >
                      {spec}
                    </Badge>
                  ))}
                  {specializations.length > 3 && (
                    <Badge variant="secondary" className="bg-muted text-xs">
                      +{specializations.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Supported Banks */}
              {displayBanks.length > 0 && (
                <div className="mt-3 flex items-start gap-2">
                  <Banknote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-muted">
                    {displayBanks.map((bank, idx) => (
                      <span key={idx} className="inline-flex items-center">
                        <span className="rounded-md bg-muted/70 px-1.5 py-0.5 font-medium text-text-main">
                          {bank}
                        </span>
                        {idx < displayBanks.length - 1 && (
                          <span className="mx-0.5 text-text-muted/50">·</span>
                        )}
                      </span>
                    ))}
                    {supportedBanks.length > 4 && (
                      <span className="text-text-muted">
                        +{supportedBanks.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Languages + Service cities */}
              {(displayLanguages.length > 0 || serviceCities.length > 0) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  {displayLanguages.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Languages className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        {displayLanguages.join(', ')}
                        {languages.length > 3 && ` +${languages.length - 3}`}
                      </span>
                    </div>
                  )}
                  {serviceCities.length > 1 && (
                    <span className="hidden sm:inline">
                       Serving {serviceCities.slice(0, 3).join(', ')}
                      {serviceCities.length > 3 && ' + more'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Footer Actions */}
      <div
        className={cn(
          'relative flex items-center justify-between gap-2 border-t border-border/60 p-3',
          viewMode === 'list' && 'md:ml-4 md:flex-shrink-0 md:border-t-0 md:border-l md:px-4',
        )}
      >
        {/* Contact buttons (grid: reveal on hover) */}
        <div
          className={cn(
            'flex items-center gap-2',
            viewMode === 'grid' &&
              'opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100',
          )}
        >
          {phone && showContact && (
            <a
              href={`tel:${phone}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white"
              aria-label={`Call ${name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {email && showContact && (
            <a
              href={`mailto:${email}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white"
              aria-label={`Email ${name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
          {phone && showContact && (
            <a
              href={`https://wa.me/${phone?.replace(/\D/g, '') || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-600 hover:text-white"
              aria-label={`WhatsApp ${name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>

        <Button
          asChild
          variant={viewMode === 'list' ? 'outline' : 'ghost'}
          size="sm"
          className="border-border text-text-main"
        >
          <Link href={`/brokers/${slug}`}>
            View Profile
            <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </motion.div>
  )
}
