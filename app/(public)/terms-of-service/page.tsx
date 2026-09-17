import { Metadata } from 'next'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { Scale } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Read the terms and conditions governing the use of HomeLoanMarket.com.',
  alternates: { canonical: '/terms-of-service' },
}

// Exact content from HomeLoanMarket_Terms_and_Privacy_Policy.docx (Terms & Conditions).
const termsIntro =
  'Welcome to HomeLoanMarket.com. These Terms & Conditions (“Terms”) govern your access to and use of HomeLoanMarket.com and the services offered by Home Loan Market LLC (“Home Loan Market,” “we,” “us,” or “our”). By accessing or using our website, creating an account, submitting information, purchasing a subscription or advertising service, or otherwise using our services, you agree to these Terms.'

const termsSections: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: '1. About Home Loan Market',
    paragraphs: [
      'HomeLoanMarket.com is an online directory, information, advertising, and marketing platform designed to help consumers discover mortgage originators and other home-finance-related professionals and businesses.',
      'Home Loan Market LLC is not a mortgage lender, mortgage broker, loan originator, bank, credit union, real estate brokerage, insurance company, title company, or financial adviser.',
      'We do not originate, fund, underwrite, approve, deny, service, or guarantee mortgage loans or other financial products. Home Loan Market does not make lending decisions and does not determine mortgage rates, fees, loan terms, eligibility, or approval.',
    ],
  },
  {
    title: '2. Mortgage Originator Directory',
    paragraphs: [
      'Our directory may contain information about mortgage loan originators and other professionals obtained from publicly available sources, information supplied by the professionals themselves, third-party sources, or other lawful sources.',
      'We make reasonable efforts to provide useful and accurate information, but we do not guarantee that every listing is complete, current, or error-free.',
      'Consumers should independently verify a mortgage professional’s identity, licensing status, NMLS information, qualifications, rates, fees, services, and other relevant information before doing business with that professional. Where applicable, users may verify mortgage licensing information through NMLS Consumer Access or the appropriate state regulatory authority.',
    ],
  },
  {
    title: '3. No Endorsement or Guarantee',
    paragraphs: [
      'The appearance of a mortgage originator, company, lender, advertiser, or other professional on HomeLoanMarket.com does not constitute an endorsement, recommendation, certification, or guarantee by Home Loan Market unless we expressly state otherwise.',
      'Paid listings, enhanced profiles, badges, featured placement, advertisements, or other promotional features may receive additional visibility because the business or professional purchased a service from Home Loan Market. Payment for advertising or a subscription does not constitute our endorsement of that advertiser or professional.',
      'We do not guarantee that any mortgage originator or advertiser will provide a particular rate, loan, service, price, approval, or result.',
    ],
  },
  {
    title: '4. Information Is Not Financial Advice',
    paragraphs: [
      'Information available through HomeLoanMarket.com, including articles, guides, calculators, search results, profiles, advertisements, and other content, is provided for general informational purposes only.',
      'Nothing on the website constitutes financial, mortgage, legal, tax, investment, or real estate advice. Mortgage rates, payments, fees, qualification requirements, and loan terms can change and vary based on numerous factors. Calculators and examples provided on the website are estimates only and should not be considered loan offers or guarantees.',
    ],
  },
  {
    title: '5. Consumer Responsibility',
    paragraphs: [
      'Consumers are responsible for evaluating mortgage professionals and businesses before entering into any transaction. Home Loan Market is not a party to agreements or transactions between consumers and mortgage originators, lenders, advertisers, or other third parties.',
      'Any communications, applications, negotiations, loans, payments, contracts, services, disputes, or transactions between users and third parties are solely between those parties.',
    ],
  },
  {
    title: '6. Mortgage Originator Accounts and Listings',
    paragraphs: [
      'Mortgage professionals may be able to create, claim, update, or purchase enhanced listings on HomeLoanMarket.com.',
      'By submitting information, you represent that the information you provide is accurate and current; you have the authority to submit and publish that information; any licenses, NMLS numbers, credentials, company affiliations, and professional claims you provide are valid and accurate; and your use of HomeLoanMarket.com complies with applicable federal, state, and local laws and regulations.',
      'Mortgage professionals are responsible for keeping their profiles accurate and current. We may correct, modify, suspend, reject, or remove listings that we reasonably believe contain inaccurate, misleading, fraudulent, unlawful, outdated, or inappropriate information.',
    ],
  },
  {
    title: '7. Paid Plans and Subscriptions',
    paragraphs: [
      'Home Loan Market may offer free and paid subscription plans. Features and pricing for each plan are displayed on the website at the time of purchase.',
      'Unless otherwise stated during checkout, paid subscriptions automatically renew at the applicable billing interval until canceled. Users may cancel their subscription according to the cancellation options provided through their account or by contacting Home Loan Market.',
      'Cancellation prevents future renewal charges but does not necessarily provide a refund for amounts already paid, except where required by law or expressly stated otherwise.',
      'We may change subscription prices or features. When legally required or reasonably appropriate, existing subscribers will receive advance notice before a pricing change applies to a future renewal.',
    ],
  },
  {
    title: '8. Advertising',
    paragraphs: [
      'Home Loan Market may sell display advertising, featured placements, sponsored listings, or other promotional services. Advertisers are responsible for ensuring that their advertisements and claims comply with applicable laws and regulations.',
      'Home Loan Market may reject, suspend, modify, or remove advertising that we believe is misleading, unlawful, inappropriate, infringing, or inconsistent with our standards.',
      'Purchasing advertising does not guarantee a specific number of impressions, clicks, inquiries, leads, customers, transactions, loan applications, or revenue unless a separate written agreement expressly provides such a guarantee.',
    ],
  },
  {
    title: '9. Payments',
    paragraphs: [
      'Payments may be processed by third-party payment processors, such as Stripe or another payment provider. By purchasing a paid service, you authorize us and our payment processor to charge the applicable amount using the payment method you provide.',
      'Home Loan Market does not necessarily store complete payment-card information directly. Payment information may be collected and processed by our payment providers according to their own terms and privacy policies.',
    ],
  },
  {
    title: '10. Promotional Codes',
    paragraphs: [
      'Home Loan Market may occasionally provide promotional codes, discounts, credits, or special offers. Promotions may be subject to expiration dates, eligibility requirements, category restrictions, geographic restrictions, or other conditions.',
      'We reserve the right to modify or discontinue promotions and to reject fraudulent or unauthorized use of promotional codes.',
    ],
  },
  {
    title: '11. User Content',
    paragraphs: [
      'If you submit photographs, logos, descriptions, reviews, business information, advertisements, or other content to HomeLoanMarket.com, you represent that you have the right to use and submit that content.',
      'You grant Home Loan Market a non-exclusive, worldwide, royalty-free license to display, reproduce, format, and use the submitted content as reasonably necessary to operate, promote, and provide the HomeLoanMarket.com service. You retain ownership of content you own.',
    ],
  },
  {
    title: '12. Prohibited Uses',
    paragraphs: [
      'You may not use HomeLoanMarket.com to engage in fraud, impersonate another person or business, submit knowingly false information, violate intellectual-property rights, interfere with the operation or security of the website, introduce malicious software, scrape or copy substantial portions of the website without authorization, or use the service for unlawful purposes.',
    ],
  },
  {
    title: '13. Third-Party Websites and Services',
    paragraphs: [
      'HomeLoanMarket.com may contain links to websites or services operated by mortgage companies, lenders, advertisers, payment processors, or other third parties.',
      'We do not control those third parties and are not responsible for their websites, privacy practices, products, services, representations, security, or conduct. Your interactions with third parties are governed by their respective terms and policies.',
    ],
  },
  {
    title: '14. Intellectual Property',
    paragraphs: [
      'HomeLoanMarket.com, the Home Loan Market name and branding, website design, original content, graphics, software, and other proprietary materials are owned by or licensed to Home Loan Market LLC and are protected by applicable intellectual-property laws. Nothing in these Terms grants users ownership of Home Loan Market intellectual property.',
    ],
  },
  {
    title: '15. Disclaimer of Warranties',
    paragraphs: [
      'HomeLoanMarket.com and its services are provided on an “as is” and “as available” basis to the fullest extent permitted by law. We do not warrant that the website will always be available, uninterrupted, secure, accurate, or error-free.',
      'We do not guarantee the accuracy or completeness of information supplied by mortgage professionals, advertisers, users, public sources, or third parties.',
    ],
  },
  {
    title: '16. Limitation of Liability',
    paragraphs: [
      'To the fullest extent permitted by applicable law, Home Loan Market LLC and its owners, officers, employees, contractors, and affiliates will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from your use of HomeLoanMarket.com or your dealings with mortgage professionals, lenders, advertisers, or other third parties.',
      'Nothing in these Terms excludes liability that cannot legally be excluded or limited.',
    ],
  },
  {
    title: '17. Indemnification',
    paragraphs: [
      'To the extent permitted by law, users who submit listings, advertisements, or other content agree to indemnify and hold harmless Home Loan Market LLC and its affiliates from claims, liabilities, damages, losses, and reasonable expenses arising from their unlawful use of the service, violation of these Terms, infringement of another person’s rights, or inaccurate or misleading content they submit.',
    ],
  },
  {
    title: '18. Account Suspension and Termination',
    paragraphs: [
      'We may suspend or terminate access to an account or remove content when we reasonably believe a user has violated these Terms, applicable law, or the rights or safety of Home Loan Market or others.',
    ],
  },
  {
    title: '19. Changes to These Terms',
    paragraphs: [
      'We may update these Terms from time to time. When we make changes, we will update the “Last Updated” date. Material changes may also be communicated through the website or other appropriate means.',
      'Continued use of the service after updated Terms become effective constitutes acceptance of the revised Terms to the extent permitted by law.',
    ],
  },
  {
    title: '20. Governing Law',
    paragraphs: [
      'These Terms are governed by the laws of the State of Wyoming, without regard to conflict-of-law principles, except where applicable consumer-protection laws require otherwise.',
    ],
  },
  {
    title: '21. Contact Us',
    paragraphs: [
      'Questions regarding these Terms may be sent to:',
      'Home Loan Market LLC',
      'HomeLoanMarket.com',
      'Email: support@homeloanmarket.com',
      // 'Mailing Address: [YOUR BUSINESS MAILING ADDRESS]',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Section className="bg-muted">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <Scale className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="heading-1 text-foreground mb-4">{'TERMS & CONDITIONS'}</h1>
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
                  <p className="text-muted-foreground leading-relaxed mb-6">{termsIntro}</p>
                </div>
              </div>
            </div>

            {termsSections.map((section) => (
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
