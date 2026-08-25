import type { Metadata } from 'next'
import { canonicalUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Subscription Plans — HomeLoanMarket for Mortgage Brokers',
  description: 'Explore HomeLoanMarket subscription plans for mortgage brokers, including FREE and FEATURED options designed to help you get discovered by home buyers.',
  alternates: { canonical: canonicalUrl('/subscription') },
  openGraph: {
    type: 'website',
    title: 'Subscription Plans — HomeLoanMarket for Mortgage Brokers',
    description: 'Explore HomeLoanMarket subscription plans for mortgage brokers, including FREE and FEATURED options.',
    url: canonicalUrl('/subscription'),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Subscription Plans — HomeLoanMarket for Mortgage Brokers',
    description: 'Explore HomeLoanMarket subscription plans for mortgage brokers, including FREE and FEATURED options.',
  },
  robots: { index: true, follow: true },
}

export default function SubscriptionLayout({ children }: { children: React.ReactNode }) {
  return children
}
