import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* =====================================================================
   Custom line-art icon set — thin single-stroke "blueprint" style that
   ties visually to house plans. Rendered with stroke="currentColor".
===================================================================== */

function IconLocalSearch({ className = '' }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
      <path
        d="M20 9c-4.1 0-7.4 3.3-7.4 7.4 0 5.5 7.4 14 7.4 14s7.4-8.5 7.4-14C27.4 12.3 24.1 9 20 9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="16.2" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function IconCompareOptions({ className = '' }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="11" width="18" height="24" stroke="currentColor" strokeWidth="1.7" />
      <rect x="17" y="5" width="18" height="24" fill="var(--primary)" stroke="currentColor" strokeWidth="1.7" />
      <line x1="21" y1="11" x2="31" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <line x1="21" y1="15" x2="31" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <line x1="21" y1="19" x2="27" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.7" />
    </svg>
  )
}

function IconChooseConnect({ className = '' }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M13.5 20.3l4.2 4.2 9-9.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---------- small step illustrations (one per step) ---------- */

function DiagramSearchArea({ className = '' }) {
  return (
    <svg viewBox="0 0 96 72" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="48" cy="34" r="24" stroke="currentColor" strokeWidth="1" strokeDasharray="2.5 3" opacity="0.4" />
      <path
        d="M48 18c-5 0-9 4-9 8.9 0 6.6 9 17 9 17s9-10.4 9-17c0-4.9-4-8.9-9-8.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="27" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="20" y1="64" x2="76" y2="64" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="20" y1="60" x2="20" y2="68" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="76" y1="60" x2="76" y2="68" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

function DiagramExploreProfiles({ className = '' }) {
  return (
    <svg viewBox="0 0 96 72" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {[10, 38, 66].map((x, i) => (
        <g key={x} opacity={i === 1 ? 1 : 0.5}>
          <rect x={x} y="10" width="20" height="40" stroke="currentColor" strokeWidth={i === 1 ? 1.6 : 1.1} />
          <circle cx={x + 10} cy="20" r="4" stroke="currentColor" strokeWidth="1.1" />
          <line x1={x + 4} y1="30" x2={x + 16} y2="30" stroke="currentColor" strokeWidth="1" />
          <line x1={x + 4} y1="35" x2={x + 14} y2="35" stroke="currentColor" strokeWidth="1" opacity="0.7" />
        </g>
      ))}
      <line x1="6" y1="62" x2="90" y2="62" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

function DiagramConnectDirect({ className = '' }) {
  return (
    <svg viewBox="0 0 96 72" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="26" width="18" height="18" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="33" r="3" stroke="currentColor" strokeWidth="1.1" />
      <path d="M11 40c1.3-3.3 3.5-5 6-5s4.7 1.7 6 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />

      <rect x="70" y="26" width="18" height="18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M72 34l7-6 7 6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />

      <line x1="30" y1="35" x2="66" y2="35" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
      <path d="M60 30l6 5-6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---------- closing-banner illustration: home, path, neighborhood ----------
   Line-art scene drawn entirely with currentColor so it inherits the
   semantic palette in light and dark themes. */

export function HouseIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 220"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* sun / focal circle */}
      <circle cx="52" cy="44" r="18" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <circle cx="52" cy="44" r="8" fill="currentColor" opacity="0.12" />

      {/* main house */}
      <path d="M120 96l52-40 52 40" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="132" y="96" width="80" height="62" stroke="currentColor" strokeWidth="1.8" />
      {/* door */}
      <rect x="160" y="118" width="24" height="40" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="178" cy="140" r="1.6" fill="currentColor" />
      {/* windows */}
      <rect x="142" y="108" width="14" height="14" stroke="currentColor" strokeWidth="1.2" />
      <rect x="188" y="108" width="14" height="14" stroke="currentColor" strokeWidth="1.2" />

      {/* path leading from the door */}
      <path d="M164 158L138 206h72l-26-48" stroke="currentColor" strokeWidth="1.3" opacity="0.7" />
      <path d="M150 182h64" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

      {/* neighborhood house, quieter */}
      <g opacity="0.45">
        <path d="M236 112l28-22 28 22" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <rect x="243" y="112" width="42" height="46" stroke="currentColor" strokeWidth="1.3" />
        <rect x="258" y="128" width="13" height="13" stroke="currentColor" strokeWidth="1" />
      </g>

      {/* tree */}
      <g opacity="0.55">
        <circle cx="104" cy="130" r="13" stroke="currentColor" strokeWidth="1.3" />
        <line x1="104" y1="143" x2="104" y2="158" stroke="currentColor" strokeWidth="1.3" />
      </g>

      {/* ground line */}
      <line x1="36" y1="158" x2="292" y2="158" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {/* geometric anchor squares */}
      <rect x="36" y="180" width="10" height="10" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <rect x="278" y="180" width="10" height="10" fill="currentColor" opacity="0.15" />
    </svg>
  )
}

/* ---------- comparison illustration: evaluating loan options ----------
   Three mortgage-option panels share aligned metric rows so the dotted
   "comparison bridges" read like-for-like. The raised middle panel is the
   better choice: stronger outline, faint primary fill, and a selection
   badge. Colors come exclusively from semantic theme variables. */

function ComparisonIllustration() {
  // Shared metric-row baseline keeps like-for-like rows aligned across cards.
  const metricRows = [136, 172, 208]

  const optionCards = [
    { x: 52, y: 92, w: 124, h: 200 },
    { x: 204, y: 60, w: 140, h: 228 },
    { x: 372, y: 96, w: 116, h: 196 },
  ]
  // Value-bar widths per card suggest different rate/fee/term profiles.
  const valueWidths = [
    [46, 62, 38],
    [58, 44, 66],
    [40, 54, 34],
  ]

  return (
    <svg
      viewBox="0 0 520 360"
      role="img"
      aria-labelledby="compare-more-illustration-title"
      preserveAspectRatio="xMidYMid meet"
      className="h-auto w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="compare-more-illustration-title">Compare mortgage options</title>

      {/* decorative geometry */}
      <g aria-hidden="true">
        <rect x="24" y="24" width="10" height="10" className="text-border" stroke="currentColor" strokeWidth="1" />
        <circle cx="492" cy="40" r="12" className="text-border" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <path d="M452 318l18-26 18 26z" className="text-border" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
        <line x1="28" y1="322" x2="492" y2="322" className="text-border" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </g>

      {/* dotted comparison bridges between aligned metric rows */}
      <g aria-hidden="true">
        {[0, 1].map((gap) =>
          metricRows.map((rowY) => {
            const from = gap === 0 ? optionCards[0].x + optionCards[0].w : optionCards[1].x + optionCards[1].w
            const to = gap === 0 ? optionCards[1].x : optionCards[2].x
            return (
              <line
                key={`${gap}-${rowY}`}
                x1={from}
                y1={rowY}
                x2={to}
                y2={rowY}
                strokeDasharray="2 4"
                className="text-muted-foreground"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.55"
              />
            )
          })
        )}
      </g>

      {/* option cards */}
      {optionCards.map((card, index) => {
        const selected = index === 1
        return (
          <g key={card.x}>
            <rect
              x={card.x}
              y={card.y}
              width={card.w}
              height={card.h}
              rx="4"
              fill={selected ? 'var(--primary)' : 'var(--card)'}
              fillOpacity={selected ? 0.04 : 1}
              stroke={selected ? 'var(--primary)' : 'var(--border)'}
              strokeWidth={selected ? 2 : 1.4}
            />

            {/* card header: marker square + two title bars */}
            <rect
              x={card.x + 14}
              y={card.y + 14}
              width="9"
              height="9"
              fill={selected ? 'var(--primary)' : 'none'}
              stroke={selected ? 'var(--primary)' : 'var(--muted-foreground)'}
              strokeWidth="1.2"
            />
            <line
              x1={card.x + 32}
              y1={card.y + 18}
              x2={card.x + card.w - 14}
              y2={card.y + 18}
              stroke="var(--foreground)"
              strokeWidth="2.2"
              opacity={selected ? 0.85 : 0.55}
            />
            <line
              x1={card.x + 32}
              y1={card.y + 27}
              x2={card.x + card.w - 40}
              y2={card.y + 27}
              stroke="var(--muted-foreground)"
              strokeWidth="1.2"
              opacity="0.5"
            />

            {/* metric rows: label tick + value bar */}
            {metricRows.map((rowY, rowIndex) => (
              <g key={rowY}>
                <line
                  x1={card.x + 14}
                  y1={rowY - 4}
                  x2={card.x + 30}
                  y2={rowY - 4}
                  stroke="var(--muted-foreground)"
                  strokeWidth="1.2"
                  opacity="0.6"
                />
                <line
                  x1={card.x + 14}
                  y1={rowY + 6}
                  x2={card.x + 14 + valueWidths[index][rowIndex]}
                  y2={rowY + 6}
                  stroke={selected ? 'var(--primary)' : 'var(--border)'}
                  strokeWidth={selected ? 2.4 : 3}
                  opacity={selected ? 0.9 : 1}
                />
              </g>
            ))}

            {/* footer action bar */}
            <rect
              x={card.x + 14}
              y={card.y + card.h - 40}
              width={card.w - 28}
              height="22"
              rx="3"
              fill={selected ? 'var(--primary)' : 'none'}
              stroke={selected ? 'var(--primary)' : 'var(--border)'}
              strokeWidth="1.2"
              opacity={selected ? 1 : 0.9}
            />
          </g>
        )
      })}

      {/* selection badge on the better option */}
      <g aria-hidden="true">
        <circle cx="344" cy="60" r="15" fill="var(--primary)" />
        <path d="M337 60.5l4.8 4.8L352 55" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

const options = [
  {
    icon: IconLocalSearch,
    title: 'Find Local Mortgage Experts',
    description: 'Connect with mortgage professionals serving your area.',
  },
  {
    icon: IconCompareOptions,
    title: 'Explore Your Options',
    description: 'Learn about conventional, FHA, VA, jumbo, first-time buyer and other home loan programs.',
  },
  {
    icon: IconChooseConnect,
    title: 'Choose What Works for You',
    description: "Contact the professionals you're interested in and decide which option is right for you.",
  },
]

const steps = [
  {
    title: 'Search Your Area',
    description: 'Enter your city or ZIP code to find mortgage professionals serving your local market.',
    Diagram: DiagramSearchArea,
  },
  {
    title: 'Explore Local Experts',
    description: 'View profiles, experience, specialties, loan programs and contact information.',
    Diagram: DiagramExploreProfiles,
  },
  {
    title: 'Connect Directly',
    description: 'Choose who you want to speak with and contact them directly. No complicated forms or unnecessary steps.',
    Diagram: DiagramConnectDirect,
  },
]

export default function LocalExpertSection() {
  return (
    <section className="section-spacing bg-background">
      <div className="container-custom space-y-14 md:space-y-24">

        {/* ==========================================================
            SECTION 1 — Compare More. Choose Better.
            Golden-ratio editorial split (~62/38): content column +
            mortgage-comparison illustration; supporting statement below.
           ========================================================== */}
        <div>
          <div className="grid gap-5 md:gap-10 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-3">
              <h2 className="heading-2 text-foreground">
                Compare More.{' '}
                <span className="text-primary">Choose Better</span>
              </h2>

              {/* Paragraph 1 */}
              <p className="mt-2 md:mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Mortgage rates, fees, and loan options can vary from one lender to another.
                Even a small difference in your rate or closing costs can mean thousands of dollars over time.
              </p>
            </div>

            <div className="mx-auto w-full max-w-md lg:col-span-2 lg:max-w-none">
              <div className="rounded-lg border border-border bg-card p-5 sm:p-8 lg:p-6 xl:p-8">
                <ComparisonIllustration />
              </div>
            </div>
          </div>

          {/* Supporting statement under a hairline rule */}
          {/* Paragraph 2 */}
          <p className="mt-2 text-center  md:mt-12 max-w-3xl mx-auto border-t border-border pt-8 md:text-2xl font-medium leading-relaxed text-foreground/90 sm:text-xl">
            Home Loan Market helps you find local mortgage professionals so you can explore your options,
            compare, and choose the loan that works best for you.
          </p>
        </div>

        {/* ==========================================================
            SECTION 2 — More Options. A Smarter Home Loan Choice.
            Three equal-weight cards: icon zone, title, description,
            action indicator.
           ========================================================== */}
        <div>
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="heading-3 text-foreground">
              More Options. <br /> A Smarter Home Loan Choice.
            </h3>
            {/* Description */}
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Different mortgage professionals may offer different loan programs, rates, fees, and solutions.
              Exploring your options can help you find a loan that better fits your needs.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {options.map((option) => (
              <div key={option.title} className="group flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-medium lg:p-7">
                {/* icon zone */}
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-muted text-foreground transition-colors duration-300 group-hover:border-primary/40 group-hover:bg-background">
                  <option.icon className="h-7 w-7" />
                </div>
                <h4 className="mt-6 text-lg font-semibold text-foreground">{option.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {option.description}
                </p>
                {/* action indicator */}
                {/* <span
                  aria-hidden="true"
                  className="mt-auto inline-flex justify-end pt-6 text-primary/60 transition-colors duration-300 group-hover:text-primary"
                >
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </span> */}
              </div>
            ))}
          </div>

          {/* Call to action note */}
          <p className="mt-8 flex items-center justify-center text-base font-medium text-foreground/80">
            Start by searching your city or ZIP code.
          </p>
        </div>

        {/* ==========================================================
            SECTION 3 — Finding a Home Loan Expert Is Simple.
            Directional process flow: Search → Explore → Connect.
            Horizontal journey on desktop, vertical timeline on mobile.
           ========================================================== */}
        <div>
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="heading-3 md:heading-2 text-foreground">
              Finding a Home Loan Expert Is Simple
            </h3>
          </div>

          <ol className="relative mt-8 sm:mt-12 space-y-8 lg:grid lg:grid-cols-3 lg:gap-x-6 lg:space-y-0">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">


                {/* step card */}
                {/* Step number inside card - positioned at top left with visual prominence */}
                <div className="card mt-5 p-6 relative overflow-visible">
                  {/* Step number with absolute positioning - overlapping the card */}
                  <div className="absolute -top-7 left-1/2  -translate-x-1/2">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-lg font-bold tracking-tight text-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Content with top padding to accommodate the overlapping number */}
                  <div className="">

                    <step.Diagram className="h-16 w-24 text-foreground/70" />
                    <h4 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ==========================================================
            SECTION 4 — Your Home. Your Loan. Your Choice.
            Wide editorial banner (~60 content / ~40 illustration).
           ========================================================== */}
        <div>
          <div className="relative overflow-hidden">
            <div className="grid gap-10  lg:grid-cols-5 lg:items-center lg:gap-12">
              <div className="lg:col-span-3">
                <h3 className="text-xl font-medium sm:text-4xl text-foreground">
                  Your Home. Your Loan. Your Choice.
                </h3>
                <p className="mt-2 sm:mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  HomeLoanMarket gives you a simple way to discover mortgage professionals and explore your options — while you stay in control of who you contact.
                </p>

                {/* CTA Button */}
                <div className="mt-8">
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

              <div className="text-foreground/80 lg:col-span-2">
                <HouseIllustration className="w-full max-w-md lg:max-w-none" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
