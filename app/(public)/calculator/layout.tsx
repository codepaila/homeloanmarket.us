import type { Metadata } from 'next'
import { canonicalUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Mortgage Calculator — Estimate Your Monthly Payment',
  description: 'Calculate your estimated monthly mortgage payment, total interest, and borrowing power with the HomeLoanMarket mortgage calculator.',
  alternates: { canonical: canonicalUrl('/calculator') },
  openGraph: {
    type: 'website',
    title: 'Mortgage Calculator — Estimate Your Monthly Payment',
    description: 'Calculate your estimated monthly mortgage payment and borrowing power with the HomeLoanMarket mortgage calculator.',
    url: canonicalUrl('/calculator'),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mortgage Calculator — Estimate Your Monthly Payment',
    description: 'Calculate your estimated monthly mortgage payment and borrowing power with the HomeLoanMarket mortgage calculator.',
  },
  robots: { index: true, follow: true },
}

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children
}
