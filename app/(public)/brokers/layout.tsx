import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mortgage Brokers in the United States',
  description: 'Browse verified mortgage brokers across the United States by location, specialty, ratings, and experience.',
  alternates: { canonical: '/brokers' },
  openGraph: {
    title: 'Mortgage Brokers in the United States',
    description: 'Browse verified mortgage brokers across the United States.',
    url: '/brokers',
  },
}

export default function BrokersLayout({ children }: { children: React.ReactNode }) {
  return children
}
