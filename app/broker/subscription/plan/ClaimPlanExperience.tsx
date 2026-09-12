'use client'

// Focused post-claim plan experience. Reuses the canonical plan data
// (listBrokerPlansPublic) and the existing broker FEATURED checkout endpoint.
// It does not create subscriptions, does not call checkout for Free, and never
// forces an upgrade.
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Check, Loader2, Star, Zap } from 'lucide-react'
import { MortgageExpertBadge } from '@/components/brokers/MortgageExpertBadge'

type PublicPlan = {
  id: string
  code: string
  name: string
  description: string | null
  price: number // cents
  currency: string
  billingInterval: string
  displayOrder: number
  stripePriceId: string | null
  isActive: boolean
  features: string[]
}

export function ClaimPlanExperience({
  brokerName,
  currentPlan,
  plans,
}: {
  brokerName: string
  currentPlan: string
  plans: PublicPlan[]
}) {
  const [loading, setLoading] = useState(false)

  const freePlan = plans.find((plan) => plan.code === 'FREE') ?? null
  const featuredPlan = plans.find((plan) => plan.code === 'FEATURED') ?? null
  const isFeatured = currentPlan === 'FEATURED'
  const freeFeatures = freePlan?.features ?? []
  const featuredFeatures = featuredPlan?.features ?? []

  async function handleUpgrade() {
    if (loading || !featuredPlan?.stripePriceId) return
    setLoading(true)
    try {
      // Existing self-register broker FEATURED checkout flow. The server resolves
      // the authoritative DB plan/price; the webhook remains authoritative for
      // activation. Never called for the Free plan.
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: featuredPlan.stripePriceId, plan: 'FEATURED' }),
      })
      const data = await response.json()
      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Unable to start checkout. Please try again.')
      }
      window.location.assign(data.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start checkout. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <Check className="h-6 w-6 text-success" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Your broker profile is ready
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          You&apos;re currently on the Free plan, {brokerName}. You can start using your broker
          dashboard now, or upgrade to Mortgage Expert for stronger visibility across our broker
          listings.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Free plan — the authoritative current plan for a claimed broker. */}
        <section className="flex flex-col rounded border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">{freePlan?.name || 'Free'}</h2>
            <Badge variant="outline">{isFeatured ? 'Included' : 'Current plan'}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {freePlan?.description || 'Basic broker listing'}
          </p>
          <div className="mt-4 text-2xl font-bold text-foreground">
            $0<span className="text-sm font-normal text-muted-foreground">/month</span>
          </div>
          <Separator className="my-4" />
          <ul className="space-y-2">
            {freeFeatures.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Mortgage Expert (FEATURED) — optional upgrade. */}
        <section className="relative flex flex-col rounded border border-primary/40 bg-card p-6 ring-2 ring-primary/20">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="gap-1">
              <Star className="h-3 w-3" aria-hidden="true" />
              Recommended
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {featuredPlan?.name || 'Mortgage Expert'}
            </h2>
            {isFeatured && <Badge variant="outline">Current plan</Badge>}
          </div>
          <div className="mt-2">
            <MortgageExpertBadge />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {featuredPlan?.description || 'Get featured in listings and direct leads'}
          </p>
          <div className="mt-4 text-2xl font-bold text-foreground">
            {featuredPlan ? `$${(featuredPlan.price / 100).toFixed(2)}` : '—'}
            <span className="text-sm font-normal text-muted-foreground">
              /{featuredPlan?.billingInterval || 'month'}
            </span>
          </div>
          <Separator className="my-4" />
          <ul className="space-y-2">
            {featuredFeatures.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mx-auto max-w-xl text-center text-sm text-muted-foreground">
        Mortgage Expert helps your profile stand out with a higher listing position and the
        Mortgage Expert badge, along with the visibility benefits already supported by the
        platform. There is no upgrade required — the Free plan stays active until you choose to
        change it.
      </p>

      <div className="flex flex-col items-center gap-3">
        {isFeatured ? (
          <Button className="w-full sm:w-auto" asChild>
            <Link href="/broker/dashboard">Go to Dashboard</Link>
          </Button>
        ) : (
          <>
            <Button
              className="w-full gap-2 sm:w-auto"
              onClick={handleUpgrade}
              disabled={loading || !featuredPlan?.stripePriceId}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Zap className="h-4 w-4" aria-hidden="true" />
              )}
              Upgrade to Mortgage Expert
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/broker/dashboard">Go to Dashboard</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
