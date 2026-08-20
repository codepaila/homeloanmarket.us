'use client'

import Link from 'next/link'
import { ArrowRight, MapPin, FileText, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LocalExpertSection() {
  return (
    <section className="section-spacing bg-background">
      <div className="container-custom">
        <div className="mx-auto max-w-4xl">
          {/* ========== IMAGE 1 CONTENT (4.55.19 AM) ========== */}
          <div className="text-center">
            {/* Main Heading */}
            <h2 className="heading-1 text-foreground">
              The Right Home Loan{' '}
              <span className="text-primary">Could Save You Thousands</span>
            </h2>

            {/* Paragraph 1 */}
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Mortgage rates, fees, and loan options can vary from one lender to another. 
              Even a small difference in your rate or closing costs can mean thousands of dollars over time.
            </p>

            {/* Paragraph 2 */}
            <p className="mx-auto mt-4 text-base font-medium text-foreground/80 sm:text-lg">
              Home Loan Market helps you find local mortgage professionals so you can explore your options, 
              compare, and choose the loan that works best for you.
            </p>
          </div>

          {/* ========== IMAGE 2 CONTENT (4.55.34 AM) ========== */}
          <div className="mt-16">
            {/* Heading */}
            <h3 className="heading-3 text-center text-foreground">
              More Options. A Smarter Home Loan Choice.
            </h3>

            {/* Description */}
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground sm:text-lg">
              Different mortgage professionals may offer different loan programs, rates, fees, and solutions. 
              Exploring your options can help you find a loan that better fits your needs.
            </p>

            {/* Three Options Cards */}
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {/* Option 1 */}
              <div className="card-plain text-center hover:-translate-y-1 transition-all duration-300">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <MapPin className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-semibold text-foreground">Find Local Mortgage Experts</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Connect with mortgage professionals serving your area.
                </p>
              </div>

              {/* Option 2 */}
              <div className="card-plain text-center hover:-translate-y-1 transition-all duration-300">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <FileText className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-semibold text-foreground">Explore Your Options</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Learn about conventional, FHA, VA, jumbo, first-time buyer and other home loan programs.
                </p>
              </div>

              {/* Option 3 */}
              <div className="card-plain text-center hover:-translate-y-1 transition-all duration-300">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-semibold text-foreground">Choose What Works for You</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Contact the professionals you&apos;re interested in and decide which option is right for you.
                </p>
              </div>
            </div>

            {/* Call to action */}
            <div className="mt-8 text-center">
              <p className="text-base font-medium text-foreground/80">
                Start by searching your city or ZIP code.
              </p>
            </div>
          </div>

          {/* ========== IMAGE 3 CONTENT (4.55.41 AM) ========== */}
          <div className="mt-16">
            {/* Main Heading */}
            <h3 className="heading-3 text-center text-foreground">
              Finding a Home Loan Expert Is Simple
            </h3>

            {/* Three Steps */}
            <div className="mt-8 space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-5 rounded-xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:shadow-medium">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  1
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Search Your Area</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your city or ZIP code to find mortgage professionals serving your local market.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-5 rounded-xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:shadow-medium">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  2
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Explore Local Experts</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    View profiles, experience, specialties, loan programs and contact information.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-5 rounded-xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:shadow-medium">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  3
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Connect Directly</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose who you want to speak with and contact them directly. No complicated forms or unnecessary steps.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Message */}
            <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
              <h4 className="heading-3 text-foreground">
                Your Home. Your Loan. Your Choice.
              </h4>
              <p className="mt-3 text-base text-muted-foreground">
                HomeLoanMarket gives you a simple way to discover mortgage professionals and explore your options — while you stay in control of who you contact.
              </p>

              {/* CTA Button */}
              <div className="mt-6">
                <Link href="/brokers" className="group inline-block">
                  <Button
                    size="lg"
                    className="btn-primary btn-lg shadow-soft hover:shadow-medium transition-all duration-300"
                  >
                    <span className="flex items-center">
                      Find Your Local Expert
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}