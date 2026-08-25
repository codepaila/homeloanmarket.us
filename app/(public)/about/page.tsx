import { Metadata } from 'next'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { StatCard } from '@/components/design/StatCard'
import { Award, Home, TrendingUp, Shield, Users, MapPin, Phone, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'HomeLoanMarket is a mortgage marketplace connecting home buyers with verified mortgage brokers across the United States.',
  alternates: { canonical: '/about' },
}

const stats = [
  { label: 'Mortgage Brokers', value: '5,000+', icon: Users, color: 'text-primary' },
  { label: 'Loans Facilitated', value: '15,000+', icon: Home, color: 'text-primary' },
  { label: 'States Served', value: '50+', icon: MapPin, color: 'text-secondary' },
  { label: 'Customer Satisfaction', value: '4.9/5', icon: TrendingUp, color: 'text-accent' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Section className="bg-surface">
        <AnimatedContainer>
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Award className="h-4 w-4" />
              Trusted since 2018
            </div>
            <h1 className="heading-1 text-text-main mb-6">
              Connecting Home Buyers with Trusted Mortgage Experts
            </h1>
              <p className="text-xl text-text-muted leading-relaxed max-2xl mx-auto">
                HomeLoanMarket is America&apos;s premier platform that bridges the gap between mortgage borrowers
                and verified mortgage brokers. We simplify the complex mortgage process by providing
                transparent access to expert guidance, competitive rates, and seamless service.
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                icon={<stat.icon className={`h-7 w-7 ${stat.color}`} />}
                value={stat.value}
                label={stat.label}
              />
            ))}
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-surface/30">
        <AnimatedContainer>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="heading-3 text-text-main">Our Mission</h2>
              <p className="text-text-muted leading-relaxed">
                Our mission is to democratize access to home financing in the United States. We believe every
                homebuyer deserves expert guidance, transparent pricing, and a seamless experience
                from application to approval.
              </p>
              <p className="text-text-muted leading-relaxed">
                 By connecting borrowers with verified and rated mortgage professionals, we ensure
                 that the mortgage process is efficient, trustworthy, and tailored to each
                 individual&apos;s unique financial situation.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-text-main">Licensed Mortgage Partners</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-text-main mb-1">Verified Mortgage Brokers</h3>
                <p className="text-sm text-text-muted">All mortgage brokers are verified and rated by clients</p>
              </div>
              <div className="card p-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-text-main mb-1">Transparent Rates</h3>
                <p className="text-sm text-text-muted">Compare rates across 20+ lending partners</p>
              </div>
              <div className="card p-6 text-center">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-text-main mb-1">Secure Process</h3>
                <p className="text-sm text-text-muted">Bank-grade encryption protecting your data</p>
              </div>
              <div className="card p-6 text-center">
                <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-3">
                  <Award className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-semibold text-text-main mb-1">Expert Network</h3>
                <p className="text-sm text-text-muted">Access to industry&apos;s top mortgage experts</p>
              </div>
            </div>
          </div>
        </AnimatedContainer>
      </Section>

      <Section>
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
             <h2 className="heading-3 text-text-main mb-6">Contact</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-text-muted">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>support@homeloanmarket.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>1-800-466-3562</span>
              </div>
            </div>
          </div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
