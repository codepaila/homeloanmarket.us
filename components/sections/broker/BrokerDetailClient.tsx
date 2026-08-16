/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'motion/react'
import Link from 'next/link'
import ContactForm from '@/components/forms/BrokerContactForm'
import {
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  Award,
  Star,
  Users,
  Clock,
  Briefcase,
  Banknote,
  Shield,
  MessageCircle,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBroker, useAllBrokers } from '@/hooks/useClient'
import Image from 'next/image'
import { RatingStars, RatingBadge } from '@/components/design/RatingStars'
import { BrokerGridCard } from '@/components/brokers'
import { BrokerAvatar } from '@/components/brokers/BrokerAvatar'
import { BrokerSubscriptionBadge } from '@/components/brokers/BrokerSubscriptionBadge'
import { PremiumButton } from '@/components/design/PremiumButton'
import { cn } from '@/lib/utils'

interface BrokerDetailClientProps {
  brokerSlug: string
  initialBroker: any
}

export default function BrokerDetailClient({ brokerSlug, initialBroker }: BrokerDetailClientProps) {
  const { broker, isLoading: isLoadingBroker } = useBroker(brokerSlug)
  const currentBroker = broker || initialBroker
  const [activeTab, setActiveTab] = useState('about')
  const targetRef = useRef(null)

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

  if (isLoadingBroker) {
    return (
      <div className="py-12">
        <div className="mx-auto max-w-7xl px-4">
          <Skeleton className="h-64 w-full rounded-3xl mb-8" />
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
    city,
    state,
    pinCode,
    avgRating,
    totalReviews,
    totalLeads,
    profileViews,
    bankPartners = [],
    reviews = [],
    _count,
    logo,
    coverImage,
    isFeatured,
    averageResponseTime,
    canShowContact,
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
        <div className="relative h-56 w-full md:h-72 lg:h-80 overflow-hidden rounded-b-3xl">
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
            <div className="absolute inset-0 bg-primary" />
          )}
          <div className="absolute inset-0 bg-background/40" />
        </div>

        {/* Profile overlap */}
        <div className="absolute left-1/2 -bottom-16 -translate-x-1/2 md:left-8 md:translate-x-0">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border-4 border-background bg-card shadow-large overflow-hidden">
            <BrokerAvatar src={logo} alt={companyName || displayName} name={companyName || displayName} className="h-full w-full" />
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

      <div className="mx-auto max-w-7xl px-4 pb-12">
        {/* Profile Header */}
        <motion.header
          className="mt-20 space-y-4 text-center md:mt-20 md:text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col items-center md:items-start md:flex-row md:justify-between gap-3 md:gap-4">
            <div className="text-center md:text-left">
              {displayName && (
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-text-main md:text-4xl">
                    {displayName}
                  </h1>
                  {isFeaturedBroker && <BrokerSubscriptionBadge className="h-7 w-7" />}
                </div>
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

          {/* Rating & Stats */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <div className="flex items-center gap-2">
                <RatingBadge
                  rating={avgRating || 0}
                  totalReviews={totalReviewsCount}
                />
              </div>
              {totalReviewsCount > 0 && (
                <span className="text-sm text-text-muted">
                  {totalReviewsCount} review{totalReviewsCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-primary">
                  {experienceYears || 0}+
                </div>
                <div className="text-xs text-text-muted">Years Experience</div>
              </div>
              <div>
                <div className="text-xl font-bold text-primary">
                  {totalLeads || stats?.totalLeads || 0}
                </div>
                <div className="text-xs text-text-muted">Leads Assisted</div>
              </div>
              <div>
                <div className="text-xl font-bold text-primary">
                  {profileViews || stats?.profileViews || 0}
                </div>
                <div className="text-xs text-text-muted">Profile Views</div>
              </div>
            </div>
          </div>
        </motion.header>

        <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center md:justify-start">
          <button type="button" onClick={() => setActiveTab('contact')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90 sm:w-auto">
            <MessageCircle className="h-4 w-4" />
            Request Information
          </button>
          <button type="button" onClick={() => setActiveTab('reviews')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-text-main transition hover:border-primary hover:text-primary sm:w-auto">
            <Star className="h-4 w-4" />
            Read Reviews
          </button>
        </div>

        {/* Main Content Layout */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Sidebar - Sticky Contact Card */}
          <aside className="lg:col-span-1 space-y-6">
            {/* Contact Card */}
            <motion.div
              className="sticky top-24 space-y-6"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <ContactInfoCard
                phone={phone}
                whatsapp={whatsapp}
                email={email}
                website={website}
                officeAddress={officeAddress}
                city={city}
                state={state}
                pinCode={pinCode}
                averageResponseTime={averageResponseTime}
                canShowContact={canShowContact}
              />

              {/* Specializations */}
              {bankPartners.length > 0 && (
                <SidebarCard
                  icon={<Banknote className="h-5 w-5 text-primary" />}
                  title="Bank Partnerships"
                >
                  <div className="space-y-1.5">
                    {bankPartners.slice(0, 8).map((bank: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-text-main">{bank.bankName}</span>
                        <span className="text-text-muted text-xs">
                          {bank.bankType}
                        </span>
                      </div>
                    ))}
                  </div>
                </SidebarCard>
              )}
            </motion.div>
          </aside>

          {/* Right Content - Main Info */}
            <motion.div
              className="lg:col-span-2 space-y-8"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              {/* Tabs */}
              <div className="border-b border-border">
                <nav className="-mb-px flex items-center gap-6 overflow-x-auto">
                  {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                          isActive
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-muted hover:text-text-main',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    )
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              {activeTab === 'about' && (
                <motion.div
                  key="about"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <AboutSection
                    displayName={displayName}
                    description={description}
                    experienceYears={experienceYears}
                    profileViews={profileViews}
                    totalLeads={totalLeads || stats?.totalLeads || 0}
                    showDescription={showDescription}
                  />

                  {/* Experience Timeline */}
                  {experienceYears > 0 && (
                    <ExperienceSection
                      experienceYears={experienceYears}
                    />
                  )}

                  {/* Reviews Summary */}
                  {totalReviewsCount > 0 && (
                    <ReviewsSummary
                      avgRating={avgRating || 0}
                      totalReviews={totalReviewsCount}
                      reviews={reviews}
                      onViewAllReviews={() => setActiveTab('reviews')}
                    />
                  )}
                </motion.div>
              )}

              {activeTab === 'reviews' && (
                <motion.div
                  key="reviews"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <ReviewsSection
                    avgRating={avgRating || 0}
                    totalReviews={totalReviewsCount}
                    reviews={reviews}
                  />
                </motion.div>
              )}

              {activeTab === 'contact' && (
                <motion.div
                  id="contact"
                  key="contact"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="scroll-mt-28 space-y-6"
                >
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-xl font-bold text-text-main mb-1">
                      Contact {displayName?.split(' ')[0] || companyName}
                    </h2>
                    <p className="text-sm text-text-muted mb-6">
                      Send a message and they&apos;ll get back to you within{' '}
                      {averageResponseTime || '24 hours'}.
                    </p>
                    <ContactForm
                      brokerId={currentBroker.id}
                      brokerSlug={brokerSlug}
                      brokerName={displayName || companyName}
                      brokerEmail={email}
                      brokerPhone={phone}
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Similar Brokers */}
          {similar.length > 0 && (
            <motion.section
              className="mt-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5 }}
            >
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
                  />
                ))}
              </div>
            </motion.section>
          )}

          {/* Call To Action */}
          <motion.section
            className="mt-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative overflow-hidden rounded-3xl">
              <div className="absolute inset-0 bg-primary" />
              <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />

              <div className="relative px-6 py-14 text-center md:py-20">
                <h2 className="text-balance text-2xl font-bold text-white md:text-3xl">
                  Still comparing mortgage brokers?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
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
            </div>
          </motion.section>
        </div>
      </div>
    )
}

function isVerifiedBadge(status: string) {
  return status === 'VERIFIED'
}

function ContactInfoCard({
  phone,
  whatsapp,
  email,
  website,
  officeAddress,
  city,
  state,
  pinCode,
  averageResponseTime,
  canShowContact,
}: {
  phone?: string
  whatsapp?: string
  email?: string
  website?: string
  officeAddress?: string
  city?: string
  state?: string
  pinCode?: string
  averageResponseTime?: string
  canShowContact?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold text-text-main mb-4">
        Contact Information
      </h2>

      <div className="space-y-4">
        {phone && canShowContact && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-3 text-left transition-colors hover:text-primary"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Phone</p>
              <p className="break-words font-medium text-text-main">{phone}</p>
            </div>
          </a>
        )}

        {whatsapp && canShowContact && (
          <a
            href={`https://wa.me/${whatsapp?.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-left transition-colors hover:text-success"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-success">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">WhatsApp</p>
              <p className="break-words font-medium text-text-main">{whatsapp}</p>
            </div>
          </a>
        )}

        {email && canShowContact && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-3 text-left break-all transition-colors hover:text-info"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-info">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Email</p>
              <p className="break-words font-medium text-text-main">{email}</p>
            </div>
          </a>
        )}

        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-left break-all transition-colors hover:text-primary"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Website</p>
              <p className="break-words font-medium text-text-main">
                {website.replace(/^https?:\/\//, '')}
              </p>
            </div>
          </a>
        )}

        {(officeAddress || city) && (
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Office Location</p>
              <p className="break-words font-medium text-text-main">
                {[officeAddress, city, state, pinCode].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}

        {averageResponseTime && (
          <div className="flex items-start gap-3 pt-3 border-t border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Avg. Response Time</p>
              <p className="break-words font-medium text-text-main">{averageResponseTime}</p>
            </div>
          </div>
        )}

        {!canShowContact && phone && (
          <div className="rounded-lg bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              Contact information is available to subscribed brokers only.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SidebarCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold text-text-main mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
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
}: {
  avgRating: number
  totalReviews: number
  reviews: any[]
}) {
  return (
    <div className="space-y-8" id="reviews">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-text-main">
          Customer Reviews
        </h2>
        <RatingBadge rating={avgRating} totalReviews={totalReviews} />
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

        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-text-main">
                {review.user?.name || 'Anonymous'}
              </p>
              <RatingStars
                rating={review.rating || 0}
                totalReviews={0}
                size="sm"
                showCount={false}
              />
            </div>
            <span className="text-xs text-text-muted">
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
