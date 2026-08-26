
import type { Metadata } from 'next'
import SearchSection from '@/components/sections/landing/SearchSection'
import LocalExpertSection from '@/components/sections/landing/LocalExportSection'
import SmartToolsSection from '@/components/sections/landing/SmartToolsSection'
import HeroImageSection from '@/components/sections/landing/HeroImage'
import { canonicalUrl, safeJsonLd, organizationJsonLd, websiteJsonLd } from '@/lib/seo'
import { getSiteSettings } from '@/lib/site/settings'

export const metadata: Metadata = {
  title: 'Find a Trusted Mortgage Originator',
  description: 'Compare verified mortgage originators across the United States and connect with local home-loan experts. Find the right mortgage professional for your home loan.',
  alternates: { canonical: canonicalUrl('/') },
  openGraph: {
    type: 'website',
    title: 'Find a Trusted Mortgage Originator',
    description: 'Connect with verified local mortgage originators for your next home loan.',
    url: canonicalUrl('/'),
    images: [{ url: '/assets/images/cover.jpg', alt: 'HomeLoanMarket mortgage marketplace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find a Trusted Mortgage Originator',
    description: 'Connect with verified local mortgage originators for your next home loan.',
  },
}

export default async function Home() {
  const settings = await getSiteSettings()

  const organization = organizationJsonLd({
    name: settings.siteName,
    description: settings.siteDescription || settings.seoDescription,
    url: canonicalUrl('/'),
    logo: settings.siteLogo,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    sameAs: [
      settings.socialFacebook,
      settings.socialTwitter,
      settings.socialLinkedIn,
      settings.socialInstagram,
      settings.socialYouTube,
    ],
  })

  const website = websiteJsonLd({
    name: settings.siteName,
    url: canonicalUrl('/'),
    searchTarget: canonicalUrl('/brokers?search={search_term}'),
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(website) }}
      />
    <HeroImageSection/>
      {/* <HeroSection /> */}
      {/* <StatisticsSection /> */}
      <SearchSection/>
      <LocalExpertSection/>
      <SmartToolsSection/>
      {/* <FeaturedBrokersSection /> */}
      {/* <ServicesSection /> */}
      {/* <WhyChooseUsSection /> */}
      {/* <ProcessSection /> */}
      {/* <BankPartnersSection /> */}
      {/* <TestimonialsSection /> */}
      {/* <FAQSection /> */}
      {/* <LatestArticles /> */}
      {/* <ChooseHomeSection /> */}
      {/* <Resources /> */}
      {/* <CallToActionSection /> */}
    </>
  )
}
