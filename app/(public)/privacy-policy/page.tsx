import { Metadata } from 'next'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how HomeLoanMarket collects, uses, and protects your personal information.',
  alternates: { canonical: '/privacy-policy' },
}

// Exact content from HomeLoanMarket_Terms_and_Privacy_Policy.docx (Privacy Policy).
const privacyIntro =
  'Home Loan Market LLC (“Home Loan Market,” “we,” “us,” or “our”) respects your privacy. This Privacy Policy explains how we collect, use, disclose, and protect information when you visit or use HomeLoanMarket.com.'

const privacySections: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: '1. Information We Collect',
    paragraphs: [
      'Depending on how you use HomeLoanMarket.com, we may collect information such as:',
      'Information you provide directly, including your name, email address, telephone number, business name, business address, NMLS number, professional information, profile information, photographs, advertising information, account information, and communications with us.',
      'Payment information. When you purchase a subscription or advertising service, payment information may be collected and processed by our third-party payment processor. We may receive information about the transaction, such as payment status, amount, billing information, and transaction identifiers, without receiving or storing your complete card number.',
      'Automatically collected information may include IP address, browser type, device information, operating system, pages visited, referring pages, approximate location derived from IP address, dates and times of visits, and interactions with our website.',
    ],
  },
  {
    title: '2. Cookies and Similar Technologies',
    paragraphs: [
      'We and our service providers may use cookies and similar technologies to operate the website, remember preferences, understand how visitors use the site, measure performance, maintain security, and, where applicable, support advertising and analytics.',
      'You may be able to control non-essential cookies through our Cookie Settings tool. Disabling certain cookies may affect some website functionality.',
    ],
  },
  {
    title: '3. Analytics',
    paragraphs: [
      'We may use analytics services, including Google Analytics or similar services, to understand website traffic and how visitors interact with HomeLoanMarket.com. These providers may collect information through cookies and similar technologies according to their own privacy practices.',
    ],
  },
  {
    title: '4. How We Use Information',
    paragraphs: [
      'We may use information to operate and improve HomeLoanMarket.com; create and manage accounts and professional listings; process subscriptions and advertising purchases; communicate with users; provide customer support; personalize and improve website functionality; analyze website usage; prevent fraud and security incidents; enforce our Terms; comply with legal obligations; and market our services where permitted by law.',
    ],
  },
  {
    title: '5. Public Professional Information',
    paragraphs: [
      'Mortgage-originator profiles and other professional listings are intended to be publicly accessible.',
      'Information displayed in these profiles may include a professional’s name, photograph, company, NMLS number, business telephone number, business email, business address, website, professional description, and other business-related information.',
      'Some professional information may originate from publicly available sources, licensing records, the professional or company itself, or other lawful sources. If you believe a professional listing contains incorrect information, please contact us to request a correction.',
    ],
  },
  {
    title: '6. How We Disclose Information',
    paragraphs: [
      'We may disclose information to service providers that help us operate the website, including hosting providers, payment processors, analytics providers, email and communications providers, security providers, and other technology vendors.',
      'We may also disclose information when required by law; to respond to lawful government requests; to investigate fraud, abuse, or security issues; to protect our legal rights or the rights of others; or in connection with a merger, acquisition, financing, reorganization, or sale of all or part of our business.',
      'We may also disclose information when you direct or authorize us to do so.',
      'We do not sell personal information for money. If our data practices change in the future, we will update this Privacy Policy and provide any notices or opt-out mechanisms required by applicable law.',
    ],
  },
  {
    title: '7. Advertising',
    paragraphs: [
      'HomeLoanMarket.com may display advertisements from mortgage companies, lenders, insurance companies, title companies, real estate companies, and other businesses.',
      'The presence of an advertisement does not mean that we disclose a consumer’s personal information to the advertiser. If we use technologies that constitute “sharing,” “targeted advertising,” or a “sale” under an applicable state privacy law, we will provide the disclosures and choices required by that law.',
    ],
  },
  {
    title: '8. Data Security',
    paragraphs: [
      'We use reasonable administrative, technical, and organizational safeguards designed to protect personal information. However, no website, electronic transmission, or data-storage system can be guaranteed to be completely secure.',
    ],
  },
  {
    title: '9. Data Retention',
    paragraphs: [
      'We retain personal information for as long as reasonably necessary to provide our services, maintain business and transaction records, comply with legal obligations, resolve disputes, prevent fraud, and enforce agreements. Retention periods may vary depending on the type of information and the reason it was collected.',
    ],
  },
  {
    title: '10. Your Privacy Rights',
    paragraphs: [
      'Depending on where you live and applicable law, you may have rights regarding your personal information, including the right to request access to information we maintain about you, request correction of inaccurate information, request deletion of certain information, obtain a portable copy of certain information, or opt out of certain uses of personal information.',
      'We will not unlawfully discriminate against you for exercising applicable privacy rights.',
      'To submit a privacy request, contact: [YOUR PRIVACY EMAIL]',
      'We may need to verify your identity before completing certain requests.',
    ],
  },
  {
    title: '11. California Privacy Rights',
    paragraphs: [
      'California residents may have additional rights under California privacy laws, including rights to know, access, correct, or delete certain personal information and, where applicable, opt out of the sale or sharing of personal information and limit certain uses of sensitive personal information. Whether particular rights apply depends on the applicability of the relevant law to Home Loan Market.',
    ],
  },
  {
    title: '12. Texas Privacy Rights',
    paragraphs: [
      'Texas residents may have rights under the Texas Data Privacy and Security Act when the Act applies, including rights concerning access, correction, deletion, portability, and certain opt-outs. Applicable rights and obligations depend on Home Loan Market’s data practices and the scope of the law.',
    ],
  },
  {
    title: '13. Children’s Privacy',
    paragraphs: [
      'HomeLoanMarket.com is intended for adults seeking mortgage-related information and professionals or businesses offering related services. Our services are not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
      'If we learn that we have collected personal information from a child under 13 in circumstances prohibited by applicable law, we will take appropriate steps to delete it.',
    ],
  },
  {
    title: '14. Third-Party Links',
    paragraphs: [
      'Our website may contain links to third-party websites. Home Loan Market is not responsible for the privacy practices of those websites. We encourage users to review the privacy policy of any third-party website they visit.',
    ],
  },
  {
    title: '15. Do Not Track and Privacy Signals',
    paragraphs: [
      'Some browsers provide “Do Not Track” or other privacy preference signals. Where legally required, we will recognize applicable browser-based opt-out preference signals. Otherwise, our response to such signals may depend on the technologies used on our website and applicable law.',
    ],
  },
  {
    title: '16. Changes to This Privacy Policy',
    paragraphs: [
      'We may update this Privacy Policy periodically to reflect changes to our services, technology, business practices, or legal requirements. The “Last Updated” date at the top will indicate when the policy was most recently revised.',
    ],
  },
  {
    title: '17. Contact Us',
    paragraphs: [
      'For questions about this Privacy Policy or requests concerning your personal information, contact:',
      'Home Loan Market LLC',
      'HomeLoanMarket.com',
      // 'Privacy Email: [YOUR PRIVACY EMAIL]',
      // 'Mailing Address: [YOUR BUSINESS MAILING ADDRESS]',
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
            <h1 className="heading-1 text-foreground mb-4">PRIVACY POLICY</h1>
            <p className="text-xl text-muted-foreground">
              Last Updated: September 14, 2026
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
                  <p className="text-muted-foreground leading-relaxed mb-6">{privacyIntro}</p>
                </div>
              </div>
            </div>

            {privacySections.map((section) => (
              <div key={section.title} className="card">
                <div className="p-8">
                  <h2 className="heading-3 text-foreground mb-4">{section.title}</h2>
                  <div className="space-y-4">
                    {section.paragraphs.map((paragraph, i) => (
                      <p key={i} className="text-muted-foreground leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
