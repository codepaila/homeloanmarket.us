/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {  useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  ArrowRight,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { isSafeHttpUrl } from '@/lib/broker-social-links'
import { BrokerGridCard } from '@/components/brokers'
import { BrokerAvatar } from '@/components/brokers/BrokerAvatar'
import { BrokerSubscriptionBadge } from '@/components/brokers/BrokerSubscriptionBadge'
import { MortgageExpertBadge } from '@/components/brokers/MortgageExpertBadge'
import { Button } from '@/components/ui/button'

interface BrokerDetailClientProps {
  brokerSlug: string
  initialBroker: any
  initialRelated?: any[]
}

export default function BrokerDetailClient({ brokerSlug, initialBroker, initialRelated = [] }: BrokerDetailClientProps) {
  // The profile content is fully server-rendered: the server component
  // passes the complete public record (with contact + badges) as
  // `initialBroker`, so no client-side refetch of the same broker is needed
  // on mount. This keeps the initial HTML meaningful and avoids a redundant
  // full-payload request + skeleton flash on every profile visit.
  const currentBroker = initialBroker
  const targetRef = useRef(null)
  // Deep-link to the contact tab (e.g. /brokers/{slug}#contact)
  useEffect(() => {
    if (window.location.hash !== '#contact') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    // setActiveTab('contact')
    requestAnimationFrame(() => {
      document
        .getElementById('contact')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [brokerSlug])

  // Similar brokers are resolved server-side (`initialRelated`) through the same
  // priority ordering as /brokers, so the section is present in the initial HTML
  // — no client fetch and no mount-time layout shift.
  const similar = initialRelated
    .filter((b: any) => b.profileSlug !== brokerSlug)
    .slice(0, 3)




  if (!currentBroker) {
    return null
  }

  const {
    displayName,
    companyName,
    // description,
    // experienceYears,
    phone,
    whatsapp,
    email,
    website,
    officeAddress,
    nmls,
    // avgRating,
    // totalReviews,
    // totalLeads,
    // profileViews,
    // bankPartners = [],
    // reviews = [],
    // _count,
    logo,
    // coverImage,
    profileImage,
    socialLinks,
    isFeatured,
    isMortgageExpert,
    // hasOwner,
    // stats,
  } = currentBroker

  const isFeaturedBroker = isFeatured

  return (
    <div ref={targetRef} className="min-h-screen bg-background">
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-primary">Home</Link>
          </li>
          <li aria-hidden="true" className="text-muted-foreground/60">/</li>
          <li>
            <Link href="/brokers" className="hover:text-primary">Find Mortgage Originators</Link>
          </li>
          <li aria-hidden="true" className="text-muted-foreground/60">/</li>
          <li className="truncate font-medium text-foreground" aria-current="page">
            {displayName || companyName || 'Mortgage Originator'}
          </li>
        </ol>
      </nav>


      <div className="mx-auto max-w-7xl px-4 pt-4 ">
          <div className="relative flex h-32 w-32 items-center justify-center rounded border-2 border-background bg-card shadow-large overflow-hidden">
            <BrokerAvatar src={profileImage || logo} alt={displayName || companyName} name={displayName || companyName} className="h-full w-full" />
          </div>
        {/* Profile Header */}
        <header className=" space-y-4 text-center  md:text-left mt-4">
            <div className="text-center md:text-left">
              {displayName && (
                <div className="flex flex-col items-start justify-center gap-2 md:justify-start">
                  <h1 className="text-3xl font-bold text-foreground md:text-4xl">
                    {displayName}
                  </h1>
                  {isMortgageExpert && <MortgageExpertBadge />}
                </div>
              )}
              {nmls && (
                <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                  NMLS #{nmls}
                </p>
              )}
              {companyName && (
                <p className="mt-1 text-lg text-muted-foreground">
                  {companyName}
                </p>
              )}
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

            <SocialSection socialLinks={socialLinks} />

          </aside>


        </div>


        {similar.length > 0 && (
          <section className="mt-16">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Similar mortgage originators
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  More verified professionals in your area.
                </p>
              </div>
              <Link
                href="/brokers"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary"
              >
                View all mortgage originators
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((broker: any) => (
                <BrokerGridCard
                  key={broker.id}
                  slug={broker.profileSlug}
                  name={broker.displayName || broker.companyName || 'Mortgage Originator'}
                  company={broker.companyName || 'Mortgage Originator'}
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
            <h2 className="text-balance text-2xl font-bold text-foreground md:text-3xl">
              Still comparing mortgage originators?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              View the full directory of verified mortgage originators, compare
              ratings and reviews, and find the right match for your home
              loan journey.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/brokers">
                <Button size="lg">
                  Find Mortgage Originators
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>


    </div>
  )
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
      <h2 className="text-lg font-bold text-foreground">Contact</h2>
      <div className="divide-y divide-border border-y border-border">
        {phone && (
          <ContactRow icon={<Phone className="h-4 w-4" />} label="Phone">
            <a href={`tel:${phone}`} className="break-all text-foreground transition-colors hover:text-primary">
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
              className="break-all text-foreground transition-colors hover:text-primary"
            >
              {whatsapp}
            </a>
          </ContactRow>
        )}

        {email && (
          <ContactRow icon={<Mail className="h-4 w-4" />} label="Email">
            <a href={`mailto:${email}`} className="break-all text-foreground transition-colors hover:text-primary">
              {email}
            </a>
          </ContactRow>
        )}

        {/* {website && websiteHref && (
          <ContactRow icon={<Globe className="h-4 w-4" />} label="Website">
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-foreground transition-colors hover:text-primary"
            >
              {websiteDisplay}
            </a>
          </ContactRow>
        )} */}

        {officeAddress && (
          <ContactRow icon={<MapPin className="h-4 w-4" />} label="Office Location">
            <p className="break-words text-foreground">{officeAddress}</p>
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
      <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-0.5 min-w-0 break-words text-sm font-medium text-foreground">{children}</div>
      </div>
    </div>
  )
}

// Supported public social platforms. Each value is validated against the safe
// HTTP(S) URL rule before it is rendered — legacy or malformed stored values
// (e.g. javascript:/data:) are never turned into external links.
const SOCIAL_PLATFORMS: { key: string; label: string; icon: LucideIcon; accessibleName: string }[] = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, accessibleName: 'Facebook profile' },
  { key: 'twitter', label: 'X', icon: Twitter, accessibleName: 'X (Twitter) profile' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, accessibleName: 'LinkedIn profile' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, accessibleName: 'Instagram profile' },
]

// Renders the broker's social profiles as a set of compact, responsive pills.
// The section is omitted entirely when there is nothing safe to show, so empty
// platforms never render as placeholder rows.
function SocialSection({ socialLinks }: { socialLinks?: Record<string, string | null> }) {
  const links = SOCIAL_PLATFORMS.filter(({ key }) => {
    const value = socialLinks?.[key]
    return typeof value === 'string' && isSafeHttpUrl(value)
  })

  if (links.length === 0) return null

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Social Profiles</h2>
      <div className="flex flex-wrap gap-2">
        {links.map(({ key, label, icon: Icon, accessibleName }) => (
          <a
            key={key}
            href={socialLinks?.[key] as string}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={accessibleName}
            className="inline-flex items-center gap-2 rounded border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {/* {label} */}
          </a>
        ))}
      </div>
    </section>
  )
}

