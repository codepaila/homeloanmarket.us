import { Metadata } from 'next'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { FileText, Scale, Gavel } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Read the terms and conditions governing the use of HomeLoanMarket.com.',
  alternates: { canonical: '/terms-of-service' },
}

const termsSections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using the HomeLoanMarket.com website and mobile application (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree with all the terms and conditions, you may not access or use the Service. These Terms constitute a legally binding agreement between you and HomeLoanMarket.`,
  },
  {
    title: '2. Use of Service',
    content: `You may use the Service for lawful purposes in accordance with these Terms. You are responsible for all activities that occur under your account. You agree not to: (a) use the Service for any fraudulent or unlawful purpose; (b) interfere with or disrupt the Service; (c) attempt to gain unauthorized access to any portion of the Service; (d) submit false or misleading information through the Service; (e) scrape or copy content from the Service for unauthorized purposes.`,
  },
  {
    title: '3. Mortgage Originator Matching',
    content: `HomeLoanMarket serves as a platform to connect mortgage borrowers with mortgage originators. We do not directly provide mortgage services, financial advice, or act as a lender. Your interactions with mortgage originators facilitated through our platform are solely between you and the respective mortgage originator. HomeLoanMarket makes no warranties regarding the services provided by mortgage originators.`,
  },
  {
    title: '4. Account Registration',
    content: `To access certain features of the Service, you may be required to register for an account. You agree to provide accurate, current, and complete information during registration and to update such information as needed. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.`,
  },
  {
    title: '5. Intellectual Property',
    content: `The Service and its original content, features, and functionality are the exclusive property of HomeLoanMarket and are protected by copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, modify, create derivative works, or otherwise use the content without prior written permission.`,
  },
  {
    title: '6. Disclaimer of Warranties',
    content: `THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. HomeLoanMarket DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the Service will be uninterrupted, secure, or error-free.`,
  },
  {
    title: '7. Limitation of Liability',
    content: `TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL HomeLoanMarket BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, REVENUE, OR BUSINESS, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, WHETHER BASED ON CONTRACT, TORT, NEGLIGENCE, OR OTHERWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.`,
  },
  {
    title: '8. Indemnification',
    content: `You agree to indemnify, defend, and hold harmless HomeLoanMarket, its affiliates, officers, directors, employees, agents, and licensors from and against any claims, liabilities, damages, losses, and expenses arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your violation of any rights of another party.`,
  },
  {
    title: '9. Governing Law',
     content: `These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Dallas, Texas.`,
  },
  {
    title: '10. Changes to Terms',
    content: `We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide notice by posting an announcement on our platform and sending an email. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.`,
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Section className="bg-muted">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <Scale className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="heading-1 text-foreground mb-4">Terms of Service</h1>
            <p className="text-xl text-muted-foreground">
              Last updated: August 6, 2026
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="card">
              <div className="p-8">
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    These Terms of Service (&quot;Terms&quot;) govern your access to and use of the HomeLoanMarket
                    website and mobile application (collectively, the &quot;Service&quot;). Please read these Terms
                    carefully before using the Service.
                  </p>
                </div>
              </div>
            </div>

            {termsSections.map((section) => (
              <div key={section.title} className="card">
                <div className="p-8">
                  <h2 className="heading-3 text-foreground mb-4">{section.title}</h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {section.content}
                  </p>
                </div>
              </div>
            ))}

            <div className="text-center pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                For questions about these Terms, contact us at{' '}
                <a href="mailto:legal@homeloanmarket.com" className="text-primary hover:text-primary">
                  legal@homeloanmarket.com
                </a>
              </p>
            </div>
          </div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
