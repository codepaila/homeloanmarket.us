'use client'

import Link from 'next/link'
import { BrokerAvatar } from '@/components/brokers/BrokerAvatar'
import { BrokerSubscriptionBadge } from '@/components/brokers/BrokerSubscriptionBadge'
import { MortgageExpertBadge } from '@/components/brokers/MortgageExpertBadge'
import {  ChevronRight, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrokerCardProps {
  slug: string
  name: string
  company: string
  location: string
  nmls?: string | null
  logo?: string | null
  profileImage?: string | null
  isPremium?: boolean
  isMortgageExpert?: boolean
  className?: string
}

export default function BrokerCard({
  slug,
  name,
  company,
  location,
  nmls,
  logo,
  profileImage,
  isPremium = false,
  isMortgageExpert = false,
  className,
}: BrokerCardProps) {
  return (
    <Link
      href={`/brokers/${slug}`}
      className={cn(
        'relative group flex h-full flex-col rounded border border-border bg-card p-3 md:p-3 transition-colors hover:border-primary/30 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        className,
      )}
      aria-label={`View profile of ${name}`}
    >
      <span className="  absolute right-4 top-[50%] -translate-x-1/2 -translate-y-1/2 transition-all group-hover:text-primary group-hover:right-3 "><ChevronRight  size={20} /></span>
      <div className="flex items-start gap-4">
        <BrokerAvatar
          src={profileImage || logo}
          alt={company || name || 'Mortgage Broker'}
          name={name || company}
          className="h-24 w-24"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-base md:text-lg font-bold text-text-main transition-colors group-hover:text-primary">
              {name}
            </h3>
            {isPremium && <BrokerSubscriptionBadge className="h-5 w-5 shrink-0" />}
          </div>
          <p className="truncate text-sm text-text-muted">{company}</p>
          {nmls && (
            <p className=" text-xs font-medium text-text-muted">NMLS #{nmls}</p>
          )}

      <div className=" flex items-center gap-1.5 text-sm text-text-muted">
          {isMortgageExpert && <MortgageExpertBadge />}
        {/* <MapPin className="h-3 w-3 flex-shrink-0" /> */}
        {/* <span className="truncate">{location}</span> */}
      </div>
        </div>
      </div>

    </Link>
  )
}
