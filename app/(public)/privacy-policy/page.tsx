import { Metadata } from 'next'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { Shield, Database, Lock, Globe, UserCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how HomeLoanMarket collects, uses, and protects your personal information.',
  alternates: { canonical: '/privacy-policy' },
}

const sections = [
  {
    title: 'Information We Collect',
    content: [
      'Personal identification information (name, email, phone number) when you register or use our services',
      'Financial information (income details, credit history) shared with mortgage originators through our platform',
      'Property information you provide for loan matching',
      'Communication data including messages exchanged through our platform',
      'Technical information (IP address, browser type, device information) automatically collected',
    ],
  },
  {
    title: 'How We Use Your Information',
    content: [
      'To match you with suitable mortgage originators based on your requirements',
      'To facilitate communication between you and mortgage originators',
      'To improve and personalize your experience on our platform',
      'To send you important updates and notifications related to your account',
      'To ensure platform security and prevent fraudulent activities',
    ],
  },
  {
    title: 'Data Protection & Security',
    content: [
      'We implement industry-standard security measures including 256-bit SSL encryption',
      'Your data is stored on secure servers with regular security audits',
      'Access to personal information is restricted to authorized personnel only',
      'We retain your information for as long as necessary to provide our services',
      'All mortgage originators are required to maintain confidentiality of your personal information',
    ],
  },
  {
    title: 'Analytics & Cookies',
    content: [
      'We use analytics cookies to understand how visitors use the site so we can improve the experience',
      'Analytics is handled through Google Analytics and Google Tag Manager',
      'These cookies collect anonymous, aggregate information such as pages visited, time spent, and navigation patterns',
      'We do not use analytics to collect personal information such as names, email addresses, phone numbers, or mortgage details',
      'Analytics is only activated after you accept our analytics cookie consent; you may reject or change your choice at any time',
      'You can review or revoke your consent at any time via the cookie settings link in the website footer',
    ],
  },
  {
    title: 'Data Sharing & Disclosure',
    content: [
      'We do NOT sell, trade, or rent your personal information to third parties',
      'Your information is shared with mortgage originators only when you explicitly initiate contact',
      'We may share anonymized aggregate data for research and platform improvement',
      'We comply with all applicable data protection laws including GDPR and applicable US data protection regulations',
      'In case of legal requirements, we may disclose information as permitted by law',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Section className="bg-muted">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="heading-1 text-foreground mb-4">Privacy Policy</h1>
            <p className="text-xl text-muted-foreground">
              Last updated: August 6, 2026
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center">
              <p className="text-muted-foreground leading-relaxed">
                HomeLoanMarket (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the HomeLoanMarket.com website and
                mobile application (the &quot;Service&quot;). This Privacy Policy informs you of our policies
                regarding the collection, use, and disclosure of personal information we receive
                from users of the Service.
              </p>
            </div>

            {sections.map((section, idx) => (
              <div key={section.title} className="card">
                <div className="p-8">
                  <h2 className="heading-3 text-foreground mb-4">{section.title}</h2>
                  <ul className="space-y-3">
                    {section.content.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground leading-relaxed">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

            <div className="grid md:grid-cols-4 gap-6">
              <div className="card text-center p-6">
                <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">Encrypted</h3>
                <p className="text-sm text-muted-foreground">256-bit SSL encryption</p>
              </div>
              <div className="card text-center p-6">
                <Database className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">Secure Storage</h3>
                <p className="text-sm text-muted-foreground">ISO 27001 certified servers</p>
              </div>
              <div className="card text-center p-6">
                <UserCheck className="h-8 w-8 text-accent mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">Your Control</h3>
                <p className="text-sm text-muted-foreground">Access and modify your data</p>
              </div>
              <div className="card text-center p-6">
                <Globe className="h-8 w-8 text-secondary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">Compliance</h3>
                <p className="text-sm text-muted-foreground">GDPR & local regulations</p>
              </div>
            </div>

            <div className="text-center pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                For privacy-related inquiries, contact us at{' '}
                <a href="mailto:privacy@homeloanmarket.com" className="text-primary hover:text-primary">
                  privacy@homeloanmarket.com
                </a>
              </p>
            </div>
          </div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
