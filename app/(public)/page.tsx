import HeroSection from '@/components/sections/landing/Hero'
import StatisticsSection from '@/components/sections/landing/Statistics'
import FeaturedBrokersSection from '@/components/sections/landing/FeaturedBrokers'
import ServicesSection from '@/components/sections/landing/Services'
import WhyChooseUsSection from '@/components/sections/landing/WhyChooseUs'
import ProcessSection from '@/components/sections/landing/Process'
import BankPartnersSection from '@/components/sections/landing/BankPartners'
import TestimonialsSection from '@/components/sections/landing/Testimonials'
import FAQSection from '@/components/sections/landing/FAQ'
import { LatestArticles } from '@/components/sections/landing/LatestArticles'
import { AdvertisementRenderer } from '@/components/advertisements'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Find a Trusted Mortgage Broker | HomeLoanMarket',
  description: 'Compare verified mortgage brokers across the United States and connect with local home-loan experts.',
  openGraph: {
    title: 'Find a Trusted Mortgage Broker | HomeLoanMarket',
    description: 'Connect with verified local mortgage brokers for your next home loan.',
    images: [{ url: '/assets/images/cover.jpg', alt: 'HomeLoanMarket mortgage marketplace' }],
  },
}

export default function Home() {
  return (
    <>
      <HeroSection />
      <AdvertisementRenderer placement="HOMEPAGE_HERO" />
      <StatisticsSection />
      <FeaturedBrokersSection />
      <AdvertisementRenderer placement="HOMEPAGE_FEATURED" />
      <ServicesSection />
      <WhyChooseUsSection />
      <ProcessSection />
      <BankPartnersSection />
      <TestimonialsSection />
      <FAQSection />
      <LatestArticles />
      <div className="mx-2 md:mx-4">

      <AdvertisementRenderer placement="HOMEPAGE_CTA" />
      </div>
      {/* <ChooseHomeSection /> */}
      {/* <Resources /> */}
      {/* <CallToActionSection /> */}
    </>
  )
}
