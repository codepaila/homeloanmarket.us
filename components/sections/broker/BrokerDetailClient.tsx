/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import {
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  Award,
  Star,
  Users,
  MessageCircle,
  ArrowRight,
  Shield,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBroker, useAllBrokers, useBrokerReviews } from '@/hooks/useClient'
import Image from 'next/image'
import { RatingStars, RatingBadge } from '@/components/design/RatingStars'
import { BrokerGridCard } from '@/components/brokers'
import { BrokerAvatar } from '@/components/brokers/BrokerAvatar'
import { BrokerSubscriptionBadge } from '@/components/brokers/BrokerSubscriptionBadge'
import { MortgageExpertBadge } from '@/components/brokers/MortgageExpertBadge'
import { PremiumButton } from '@/components/design/PremiumButton'
import { BrokerReviewDialog } from '@/components/sections/broker/BrokerReviewDialog'
import { cn } from '@/lib/utils'

interface BrokerDetailClientProps {
  brokerSlug: string
  initialBroker: any
}

export default function BrokerDetailClient({ brokerSlug, initialBroker }: BrokerDetailClientProps) {
  const { broker, isLoading: isLoadingBroker } = useBroker(brokerSlug)
  const currentBroker = broker || initialBroker
  const [activeTab, setActiveTab] = useState('about')
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewKey, setReviewKey] = useState(0)
  const targetRef = useRef(null)
  const { status: sessionStatus } = useSession()

  const { mutate: mutateReviews } = useBrokerReviews(brokerSlug, 1, 10)

  // Deep-link to the contact tab (e.g. /brokers/{slug}#contact)
  useEffect(() => {
    if (window.location.hash !== '#contact') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('contact')
    requestAnimationFrame(() => {
      document
        .getElementById('contact')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [brokerSlug])

  // Similar brokers
  const { brokers: similarBrokers } = useAllBrokers(1, 4)
  const similar = (similarBrokers || [])
    .filter((b: any) => b.id !== currentBroker?.id && b.profileSlug !== brokerSlug)
    .slice(0, 3)

  const handleWriteReview = () => {
    if (sessionStatus === 'authenticated') {
      setReviewDialogOpen(true)
    } else {
      signIn()
    }
  }

  const handleReviewSubmitted = () => {
    setReviewKey((k) => k + 1)
    mutateReviews()
  }

  if (isLoadingBroker) {
    return (
      <div className="py-12">
        <div className="mx-auto max-w-7xl px-4">
          <Skeleton className="h-64 w-full rounded-b-3xl mb-8" />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <Skeleton className="h-[520px] w-full rounded-2xl lg:col-span-1" />
            <Skeleton className="h-[520px] w-full rounded-2xl lg:col-span-2" />
          </div>
        </div>
      </div>
    )
  }

  if (!currentBroker) {
    return null
  }

  const {
    displayName,
    companyName,
    description,
    experienceYears,
    phone,
    whatsapp,
    email,
    website,
    officeAddress,
    nmls,
    avgRating,
    totalReviews,
    totalLeads,
    profileViews,
    bankPartners = [],
    reviews = [],
    _count,
    logo,
    coverImage,
    profileImage,
    isFeatured,
    isMortgageExpert,
    hasOwner,
    stats,
  } = currentBroker

  const totalReviewsCount = _count?.reviews || totalReviews || 0
  const isPremium = false
  const isFeaturedBroker = isFeatured
  const showDescription = hasOwner !== false

  const tabs = [
    { id: 'about', label: 'About', icon: Building },
    { id: 'reviews', label: `Reviews (${totalReviewsCount})`, icon: Star },
    { id: 'contact', label: 'Contact', icon: MessageCircle },
  ]

  return (
    <div ref={targetRef} className="min-h-screen bg-background">
      {/* Hero Banner */}
      <section className="relative">
        <div className="relative h-48 w-full md:h-72 lg:h-80 overflow-hidden rounded-b-3xl">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={`${displayName || companyName} cover`}
              fill
              className="object-cover object-center"
              priority
              sizes="100vw"
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
        </div>

        {/* Profile overlap */}
        <div className="absolute left-1/2 -bottom-16 -translate-x-1/2 md:left-8 md:translate-x-0">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border-4 border-background bg-card shadow-large overflow-hidden">
            <BrokerAvatar src={profileImage || logo} alt={displayName || companyName} name={displayName || companyName} className="h-full w-full" />
          </div>

          {isFeaturedBroker && (
            <div className="absolute -top-2 -right-2 z-10">
              <Badge className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-md">
                <Star className="h-3 w-3 fill-white" />
                Featured
              </Badge>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 ">
        {/* Profile Header */}
        <header className="mt-20 space-y-4 text-center md:mt-20 md:text-left">
          <div className="flex flex-col items-center md:items-start md:flex-row md:justify-between gap-3 md:gap-4">
            <div className="text-center md:text-left">
              {displayName && (
                <div className="flex flex-col items-start justify-center gap-2 md:justify-start">
                  <h1 className="text-3xl font-bold text-text-main md:text-4xl">
                    {displayName}
                  </h1>
                  {isFeaturedBroker && <BrokerSubscriptionBadge className="h-7 w-7" />}
                  {isMortgageExpert && <MortgageExpertBadge />}
                </div>
              )}
              {nmls && (
                <p className="mt-1.5 text-sm font-medium text-text-muted">
                  NMLS #{nmls}
                </p>
              )}
              {companyName && (
                <p className="mt-1 text-lg text-text-muted">
                  {companyName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              {isVerifiedBadge(currentBroker.verificationStatus) && (
                <Badge className="bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-600/20">
                  <Shield className="h-3 w-3 mr-1" />
                  Verified Mortgage Broker
                </Badge>
              )}
              {isPremium && (
                <Badge className="bg-purple-500/15 text-purple-700 ring-1 ring-purple-600/25">
                  <Award className="h-3 w-3 mr-1" />
                  Premium Partner
                </Badge>
              )}
            </div>
          </div>

       
        </header>



        {/* Main Content Layout */}
        <div className="mt-8 grid grid-cols-1 ">
          {/* Left - Contact */}
          <aside className="lg:col-span-1 space-y-8 lg:sticky lg:top-24 lg:self-start">
            <ContactSection
              phone={phone}
              whatsapp={whatsapp}
              email={email}
              website={website}
              officeAddress={officeAddress}
            />

          </aside>


        </div>


        {similar.length > 0 && (
          <section className="mt-16">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-text-main">
                  Similar brokers
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  More verified professionals in your area.
                </p>
              </div>
              <Link
                href="/brokers"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary"
              >
                View all brokers
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((broker: any) => (
                <BrokerGridCard
                  key={broker.id}
                  slug={broker.profileSlug}
                  name={broker.displayName || broker.companyName || 'Mortgage Broker'}
                  company={broker.companyName || 'Mortgage Broker'}
                  location={[broker.city, broker.state].filter(Boolean).join(', ') || 'United States'}
                  nmls={broker.nmls}
                  logo={broker.logo}
                  profileImage={broker.profileImage}
                  isMortgageExpert={broker.isMortgageExpert === true}
                />
              ))}
            </div>
          </section>
        )}

        {/* Directory prompt */}
        <section className="">
          <div className=" px-6 py-14 text-center md:py-16">
            <h2 className="text-balance text-2xl font-bold text-text-main md:text-3xl">
              Still comparing mortgage brokers?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-text-muted">
              View the full directory of verified mortgage brokers, compare
              ratings and reviews, and find the right match for your home
              loan journey.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/brokers">
                <PremiumButton size="lg">
                  Find Mortgage Brokers
                  <ArrowRight className="ml-2 h-4 w-4" />
                </PremiumButton>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <BrokerReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        brokerSlug={brokerSlug}
        onSubmitted={handleReviewSubmitted}
      />
    </div>
  )
}

function isVerifiedBadge(status: string) {
  return status === 'VERIFIED'
}

function ContactSection({
  phone,
  whatsapp,
  email,
  website,
  officeAddress,
}: {
  phone?: string
  whatsapp?: string
  email?: string
  website?: string
  officeAddress?: string
}) {
  const websiteHref = website && !/^https?:\/\//i.test(website) ? `https://${website}` : website
  const websiteDisplay = (website || '').replace(/^https?:\/\//, '')

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-text-main">Contact</h2>
      <div className="divide-y divide-border border-y border-border">
        {phone && (
          <ContactRow icon={<Phone className="h-4 w-4" />} label="Phone">
            <a href={`tel:${phone}`} className="break-all text-text-main transition-colors hover:text-primary">
              {phone}
            </a>
          </ContactRow>
        )}

        {whatsapp && (
          <ContactRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp">
            <a
              href={`https://wa.me/${whatsapp?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-text-main transition-colors hover:text-primary"
            >
              {whatsapp}
            </a>
          </ContactRow>
        )}

        {email && (
          <ContactRow icon={<Mail className="h-4 w-4" />} label="Email">
            <a href={`mailto:${email}`} className="break-all text-text-main transition-colors hover:text-primary">
              {email}
            </a>
          </ContactRow>
        )}

        {website && websiteHref && (
          <ContactRow icon={<Globe className="h-4 w-4" />} label="Website">
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-text-main transition-colors hover:text-primary"
            >
              {websiteDisplay}
            </a>
          </ContactRow>
        )}

        {officeAddress && (
          <ContactRow icon={<MapPin className="h-4 w-4" />} label="Office Location">
            <p className="break-words text-text-main">{officeAddress}</p>
          </ContactRow>
        )}
      </div>
    </section>
  )
}

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-text-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        <div className="mt-0.5 min-w-0 break-words text-sm font-medium text-text-main">{children}</div>
      </div>
    </div>
  )
}

function BankPartnersSection({ bankPartners }: { bankPartners: any[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-text-main">Bank Partnerships</h2>
      <div className="divide-y divide-border border-y border-border">
        {bankPartners.slice(0, 8).map((bank: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0 break-words text-sm font-medium text-text-main">{bank.bankName}</span>
            <span className="shrink-0 text-xs text-text-muted">{bank.bankType}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function AboutSection({
  displayName,
  description,
  experienceYears,
  profileViews,
  totalLeads,
  showDescription = true,
}: {
  displayName?: string
  description?: string
  experienceYears?: number
  profileViews?: number
  totalLeads?: number
  showDescription?: boolean
}) {
  return (
    <div className="space-y-8">
      {showDescription && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-text-main">
            About {displayName || 'this broker'}
          </h2>
          <p className="text-text-muted leading-relaxed whitespace-pre-line">
            {description ||
              'Professional broker providing expert loan services with years of experience in the industry.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatBox label="Years Experience" value={`${experienceYears || 0}+`} />
        <StatBox label="Profile Views" value={profileViews || 0} />
        <StatBox label="Leads Assisted" value={`${totalLeads || 0}+`} />
      </div>
    </div>
  )
}

function ExperienceSection({
  experienceYears,
}: {
  experienceYears?: number
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-text-main">
        Professional Experience
      </h3>
      <p className="text-text-muted">
        With {experienceYears || 0}+ years in the mortgage industry, this broker
        specializes in helping borrowers navigate the mortgage process with
        transparency and care.
      </p>
    </div>
  )
}

function ReviewsSummary({
  avgRating,
  totalReviews,
  reviews,
  onViewAllReviews,
}: {
  avgRating: number
  totalReviews: number
  reviews: any[]
  onViewAllReviews: () => void
}) {
  if (!reviews || reviews.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-main">
          What borrowers are saying
        </h3>
        <div className="flex items-center gap-4">
          <RatingBadge rating={avgRating} totalReviews={totalReviews} />
          <button
            type="button"
            onClick={onViewAllReviews}
            className="text-sm font-medium text-primary transition-colors hover:text-primary hover:underline"
          >
            View all reviews
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.slice(0, 3).map((review: any) => (
          <ReviewItem key={review.createdAt} review={review} />
        ))}
      </div>
    </div>
  )
}

function ReviewsSection({
  avgRating,
  totalReviews,
  reviews,
  onWriteReview,
}: {
  avgRating: number
  totalReviews: number
  reviews: any[]
  onWriteReview: () => void
}) {
  return (
    <div className="space-y-8" id="reviews">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-main">
            Customer Reviews
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            <RatingStars rating={avgRating} totalReviews={0} size="sm" showCount={false} className="inline-flex" />
            <span className="ml-1 font-semibold text-text-main">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
            <span className="ml-1">· {totalReviews} review{totalReviews === 1 ? '' : 's'}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onWriteReview}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          <Star className="h-4 w-4" />
          Write a Review
        </button>
      </div>

      {reviews && reviews.length > 0 ? (
        <div className="space-y-6">
          {reviews.map((review: any) => (
            <ReviewItem key={review.createdAt} review={review} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <Star className="h-12 w-12 text-text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-main mb-2">
            No reviews at this time
          </h3>
          <p className="text-text-muted">
            Be the first to review this broker.
          </p>
        </div>
      )}
    </div>
  )
}

function ReviewItem({ review }: { review: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden">
          {review.user?.image ? (
            <Image
              src={review.user.image}
              alt={review.user.name || 'Reviewer'}
              width={40}
              height={40}
              className="object-cover"
            />
          ) : (
            <Users className="h-5 w-5 text-text-muted" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words font-medium text-text-main">
                {review.user?.name || 'Anonymous'}
              </p>
              <RatingStars
                rating={review.rating || 0}
                totalReviews={0}
                size="sm"
                showCount={false}
              />
            </div>
            <span className="shrink-0 text-xs text-text-muted">
              {new Date(review.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          {review.comment && (
            <p className="mt-3 text-sm text-text-muted">
              {review.comment}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatBox({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  )
}
