import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mortgage Guides',
  description: 'Practical US mortgage guides covering home buying, refinancing, credit, loan types, and closing.',
  alternates: { canonical: '/guides' },
  openGraph: {
    title: 'Mortgage Guides',
    description: 'Practical US mortgage guides for home buyers and borrowers.',
    url: '/guides',
  },
}

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return children
}
