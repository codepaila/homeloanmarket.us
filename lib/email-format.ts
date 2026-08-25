// Shared, dependency-free formatting helpers for the email templates.
// These produce US-appropriate USD formatting for monetary values shown in
// email content. They are pure and safe to import anywhere (no Prisma, no env).

// Formats a numeric amount in the plan's currency (default USD). `price` is in
// the plan's minor-unit convention — broker plans store price in cents, so a
// value of 1500 renders as "$15.00".
export function formatCurrencyAmount(amount: number, currency = 'usd'): string {
  if (!Number.isFinite(amount)) return '$0.00'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}

// Formats a broker plan price stored in cents (e.g. 1500 -> "$15.00").
export function formatPlanPriceFromCents(priceCents: number, currency = 'usd'): string {
  return formatCurrencyAmount(Number.isFinite(priceCents) ? priceCents / 100 : 0, currency)
}

// Renders a human-friendly price + interval, e.g. "$15.00/month". For a
// zero/free plan it returns the literal "Free".
export function formatPlanPriceAndInterval(priceCents: number, currency: string | undefined, billingInterval: string | undefined): string {
  if (!Number.isFinite(priceCents) || priceCents <= 0) return 'Free'
  const amount = formatPlanPriceFromCents(priceCents, currency || 'usd')
  const interval = billingInterval || 'month'
  return `${amount}/${interval}`
}

// Formats a user-provided loan amount (already in dollars) as USD, e.g.
// 350000 -> "$350,000.00". Falls back to the raw value when not a number.
export function formatLoanAmountDollars(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Not specified'
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Not specified'
  return formatCurrencyAmount(numeric, 'usd')
}
