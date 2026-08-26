'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from 'react'
import Link from 'next/link'
import { useFeaturedBrokers } from '@/hooks/useClient'
import FeaturedBrokerRowCard from '@/components/brokers/FeaturedBrokerRowCard'
import { Section } from '@/components/design/Section'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { EmptyState } from '@/components/design/EmptyState'
import { PremiumButton } from '@/components/design/PremiumButton'
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
} from 'lucide-react'

const PLAN_PRIORITY: Record<string, number> = {
  FEATURED: 2,
  FREE: 1,
}

function sortFeaturedBrokers(brokers: any[]) {
  return [...brokers].sort((a, b) => {
    const rankA = a.featuredRank ?? 0
    const rankB = b.featuredRank ?? 0
    if (rankB !== rankA) return rankB - rankA

    const planA = a.subscription?.plan || 'FREE'
    const planB = b.subscription?.plan || 'FREE'
    const planDiff = (PLAN_PRIORITY[planB] || 0) - (PLAN_PRIORITY[planA] || 0)
    if (planDiff !== 0) return planDiff

    const ratingDiff = (b.avgRating || 0) - (a.avgRating || 0)
    if (ratingDiff !== 0) return ratingDiff

    return (b.totalReviews || 0) - (a.totalReviews || 0)
  })
}

function FeaturedSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:gap-6 md:p-6"
        >
          <div className="h-16 w-16 animate-pulse rounded-xl bg-muted md:h-20 md:w-20" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="flex gap-2 md:w-[160px]">
            <div className="h-9 flex-1 animate-pulse rounded-xl bg-muted" />
            <div className="h-9 flex-1 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FeaturedBrokersSection() {
  const { brokers, isLoading } = useFeaturedBrokers()

  const sortedBrokers = React.useMemo(() => {
    if (!brokers) return []
    return sortFeaturedBrokers(brokers).slice(0, 3)
  }, [brokers])

  return (
    <Section size="lg" className="bg-card-deep/40">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-background px-3 py-1 text-xs font-semibold text-primary shadow-soft">
              <BadgeCheck className="h-3.5 w-3.5" />
              Handpicked &amp; Verified
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-text-main md:text-3xl lg:text-4xl">
              Featured Mortgage Originators
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted md:text-base">
              Our top-rated, verified professionals — reviewed by real
              borrowers and handpicked for exceptional service.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/brokers">
              <PremiumButton variant="secondary" size="md" className="px-4">
                  View All Featured Mortgage Originators
                <ArrowUpRight className="h-4 w-4" />
              </PremiumButton>
            </Link>
          </div>
        </div>
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        {isLoading ? (
          <FeaturedSkeleton />
        ) : sortedBrokers.length > 0 ? (
          <div className="flex flex-col gap-6">
            {sortedBrokers.map((broker: any) => (
              <FeaturedBrokerRowCard key={broker.id} broker={broker} />
            ))}
            <div className="flex justify-center pt-2">
              <Link href="/brokers">
                <PremiumButton variant="secondary" size="md" className="px-4">
                View All Featured Mortgage Originators
                  <ArrowUpRight className="h-4 w-4" />
                </PremiumButton>
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No Featured Mortgage Originators Available"
            description="We're curating our next batch of top-rated mortgage professionals. Check back soon or browse the full directory."
            icon={<Building2 className="h-12 w-12" />}
            action={
              <Link href="/brokers">
                <PremiumButton>
                   Find Mortgage Originators
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </PremiumButton>
              </Link>
            }
          />
        )}
      </AnimatedContainer>
    </Section>
  )
}
