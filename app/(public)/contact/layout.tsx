import type { Metadata } from 'next'
import { canonicalUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Contact HomeLoanMarket',
  description: 'Get in touch with the HomeLoanMarket team. Whether you are looking for a mortgage originator or have questions about the platform, we are here to help.',
  alternates: { canonical: canonicalUrl('/contact') },
  openGraph: {
    type: 'website',
    title: 'Contact HomeLoanMarket',
    description: 'Get in touch with the HomeLoanMarket team for help finding a mortgage originator or answers to your questions.',
    url: canonicalUrl('/contact'),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact HomeLoanMarket',
    description: 'Get in touch with the HomeLoanMarket team for help finding a mortgage originator or answers to your questions.',
  },
  robots: { index: true, follow: true },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
