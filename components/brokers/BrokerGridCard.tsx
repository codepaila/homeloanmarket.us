'use client'

import Link from 'next/link'
import { BrokerAvatar } from '@/components/brokers/BrokerAvatar'
import { BrokerSubscriptionBadge } from '@/components/brokers/BrokerSubscriptionBadge'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrokerCardProps {
  slug: string
  name: string
  company: string
  location: string
  nmls?: string | null
  logo?: string | null
  isPremium?: boolean
  className?: string
}

export default function BrokerCard({
  slug,
  name,
  company,
  location,
  nmls,
  logo,
  isPremium = false,
  className,
}: BrokerCardProps) {
  return (
    <Link
      href={`/brokers/${slug}`}
      className={cn(
        'group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        className,
      )}
      aria-label={`View profile of ${name}`}
    >
      <div className="flex items-start gap-4">
        <BrokerAvatar
          src={logo}
          alt={company || name || 'Mortgage Broker'}
          name={company || name}
          className="h-14 w-14"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-lg font-bold text-text-main transition-colors group-hover:text-primary">
              {name}
            </h3>
            {isPremium && <BrokerSubscriptionBadge className="h-5 w-5" />}
          </div>
          <p className="truncate text-sm text-text-muted">{company}</p>
          {nmls && (
            <p className="mt-1 text-xs font-medium text-text-muted">NMLS #{nmls}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-4 text-sm text-text-muted">
        <MapPin className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{location}</span>
      </div>
    </Link>
  )
}
