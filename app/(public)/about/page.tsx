import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { StatCard } from '@/components/design/StatCard'
import { Award, Home, TrendingUp, Shield, Users, MapPin, Sparkles, CheckCircle2, Mail, ShieldCheck, type LucideIcon } from 'lucide-react'
import { getAboutPublicData, getAboutSeo } from '@/lib/about/about'
import { safeJsonLd, organizationJsonLd, canonicalUrl } from '@/lib/seo'
import { getSiteSettings } from '@/lib/site/settings'
import { cn } from '@/lib/utils'

const BENEFIT_ICONS: Record<string, LucideIcon> = {
  Users,
  TrendingUp,
  Shield,
  Award,
  Home,
  MapPin,
  Sparkles,
  CheckCircle2,
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getAboutSeo()
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: '/about' },
    ...(seo.ogImage ? { openGraph: { images: [{ url: seo.ogImage }] } } : {}),
  }
}

export default async function AboutPage() {
  const { active, sections } = await getAboutPublicData()

  if (!active || !sections) notFound()

  const settings = await getSiteSettings()
  const orgLd = organizationJsonLd({
    name: settings.siteName,
    description: sections.hero?.description || settings.siteDescription,
    url: canonicalUrl('/about'),
    logo: settings.siteLogo,
    contactEmail: sections.contact?.email,
  })

  const jsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: sections.hero?.title || 'About Us',
    description: sections.hero?.description || settings.siteDescription,
    url: canonicalUrl('/about'),
    mainEntity: { '@id': orgLd['@id'] },
  })

  const hasMissionImage = Boolean(sections.mission?.imageUrl)

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* Accessibility fallback: guarantees exactly one H1 on the page even
          if the Hero section is disabled/empty in the CMS. Not CMS content —
          purely a structural safety net, visually hidden. */}
      {!sections.hero?.title && <h1 className="sr-only">About</h1>}

      {sections.hero && (
        <Section className="relative overflow-hidden bg-muted">
          {sections.hero.imageUrl && (
            <>
              <Image
                src={sections.hero.imageUrl}
                alt={sections.hero.imageAlt || sections.hero.title || 'About hero image'}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-background/70" />
            </>
          )}
          <AnimatedContainer>
            <div className="relative z-10 flex min-h-[420px] sm:min-h-[520px] md:min-h-[600px] flex-col items-center justify-center px-6 lg:px-12 text-center">
              <div className="max-w-2xl">
                {sections.hero.eyebrow && (
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                    <Award className="h-4 w-4" />
                    {sections.hero.eyebrow}
                  </div>
                )}
                {sections.hero.title && (
                  <h1 className="heading-1 mb-6 text-foreground">{sections.hero.title}</h1>
                )}
                {sections.hero.description && (
                  <p className="text-xl leading-relaxed text-muted-foreground">
                    {sections.hero.description}
                  </p>
                )}
              </div>
            </div>
          </AnimatedContainer>
        </Section>
      )}

      {sections.stats && sections.stats.items.length > 0 && (
        <Section className="border-b border-border bg-background">
          <AnimatedContainer>
            <div className="container-custom">
              <div className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
                {sections.stats.items.map((stat) => (
                  <StatCard
                    key={`${stat.label}-${stat.value}`}
                    value={stat.value}
                    label={stat.label}
                    className="p-6 text-center"
                  />
                ))}
              </div>
            </div>
          </AnimatedContainer>
        </Section>
      )}

      {(sections.mission || (sections.benefits && sections.benefits.items.length > 0)) && (
        <Section className="bg-muted/50">
          <AnimatedContainer>
            <div className="container-custom">
              {sections.mission && (
                <div
                  className={cn(
                    hasMissionImage
                      ? 'grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16'
                      : 'mx-auto max-w-3xl'
                  )}
                >
                  {hasMissionImage && (
                    <div className="relative aspect-[6/4] w-full overflow-hidden rounded-sm">
                      <Image
                        src={sections.mission.imageUrl!}
                        alt={sections.mission.imageAlt || sections.mission.title || 'About mission image'}
                        fill
                        sizes="(min-width: 1024px) 40vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className={cn('space-y-6', hasMissionImage && '')}>
                    {sections.mission.title && (
                      <h2 className="heading-2 text-foreground">{sections.mission.title}</h2>
                    )}
                    {sections.mission.content && (
                      <p className="text-lg leading-relaxed text-muted-foreground">
                        {sections.mission.content}
                      </p>
                    )}
                    {sections.mission.content2 && (
                      <p className="text-lg leading-relaxed text-muted-foreground">
                        {sections.mission.content2}
                      </p>
                    )}
                    {sections.mission.checklist.length > 0 && (
                      <div className="space-y-3 pt-2">
                        {sections.mission.checklist.map((item, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                            <span className="text-base leading-relaxed text-foreground">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {sections.benefits && sections.benefits.items.length > 0 && (
                <div className={cn('grid gap-8 sm:grid-cols-2 lg:grid-cols-2', sections.mission && 'mt-16')}>
                  {sections.benefits.items.map((benefit, index) => {
                    const Icon = BENEFIT_ICONS[benefit.iconKey] || ShieldCheck
                    return (
                      <div
                        key={index}
                        className="flex flex-col items-center gap-4 rounded-sm border border-border bg-card p-8 text-center transition-shadow hover:shadow-soft"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">{benefit.title}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {benefit.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </AnimatedContainer>
        </Section>
      )}

      {sections.contact && (
        <Section className="bg-background">
          <AnimatedContainer>
            <div className="container-custom">
              <div className="mx-auto max-w-2xl rounded-sm border border-border bg-card p-8 text-center sm:p-12">
                {sections.contact.title && (
                  <h2 className="heading-2 mb-4 text-foreground">{sections.contact.title}</h2>
                )}
                <p className="mx-auto mb-8 max-w-xl text-sm text-muted-foreground">
                  Have questions? Reach out to our team for personalized assistance.
                </p>
                {sections.contact.email && (
                  <a
                    href={`mailto:${sections.contact.email}`}
                    className="btn btn-primary btn-lg gap-3"
                  >
                    <Mail className="h-5 w-5" />
                    <span>{sections.contact.email}</span>
                  </a>
                )}
              </div>
            </div>
          </AnimatedContainer>
        </Section>
      )}
    </div>
  )
}