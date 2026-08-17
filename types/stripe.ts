import type Stripe from 'stripe'

// The installed Stripe type definitions omit a few standard API fields that the
// application relies on (notably `current_period_start`/`current_period_end` on
// Subscription, and the expandable `charge`/`subscription`/PDF fields on
// Invoice). These narrow augmentations keep the codebase strongly typed without
// falling back to `any`.

export type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start: number
  current_period_end: number
}

export type ExpandedInvoice = Stripe.Invoice & {
  charge?: string | Stripe.Charge | null
  payment_intent?: string | Stripe.PaymentIntent | null
  subscription?: string | Stripe.Subscription | null
  invoice_pdf?: string | null
  hosted_invoice_url?: string | null
}
