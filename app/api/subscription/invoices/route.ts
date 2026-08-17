import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import Stripe from 'stripe'
import { SubscriptionService } from '@/lib/subscription'
import type { ExpandedInvoice, SubscriptionWithPeriod } from '@/types/stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json({
        success: true,
        data: { 
          invoices: [], 
          subscriptions: [], 
          paymentMethods: [],
          totalInvoices: 0,
          totalAmount: 0,
          paidAmount: 0
        }
      })
    }

    if (!user.brokerProfile) return NextResponse.json({ success: false, error: 'Broker profile not found' }, { status: 404 })
    await SubscriptionService.assertStripeCustomerOwnership(user.id, user.brokerProfile.id, user.stripeCustomerId)

    // Fetch all billing data in parallel
    const [customer, paymentMethods, invoices, subscriptions] = await Promise.all([
      stripe.customers.retrieve(user.stripeCustomerId),
      stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
        limit: 10
      }),
      stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: 100,
        expand: ['data.charge', 'data.subscription']
      }),
      stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 10,
        expand: ['data.default_payment_method']
      })
    ])

    // Format invoices
    const formattedInvoices = invoices.data.map((invoice: ExpandedInvoice) => ({
      id: invoice.id,
      number: invoice.number || `INV-${invoice.created}`,
      date: new Date(invoice.created * 1000).toISOString(),
      description: invoice.description || 'Subscription Invoice',
      amount: invoice.total / 100,
      currency: invoice.currency,
      status: invoice.status as 'paid' | 'pending' | 'failed' | 'void' | 'draft' | 'open',
      type: invoice.billing_reason === 'subscription_cycle' ? 'subscription' as const : 'one_time' as const,
      stripeInvoiceId: invoice.id,
      stripeChargeId: invoice.charge || invoice.payment_intent || invoice.id,
      paymentMethod: 'card',
      pdfUrl: invoice.invoice_pdf,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      subscription: invoice.subscription ? {
        id: typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id,
        plan: typeof invoice.subscription === 'string' ? undefined : invoice.subscription.items.data[0]?.price.nickname
      } : undefined,
      createdAt: new Date(invoice.created * 1000),
      updatedAt: new Date()
    }))

    // Format subscriptions
    const formattedSubscriptions = (subscriptions.data as unknown as SubscriptionWithPeriod[]).map((sub) => ({
      id: sub.id,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      plan: sub.items?.data?.[0]?.price?.nickname || 'Unknown',
      amount: sub.items?.data?.[0]?.price?.unit_amount ? sub.items.data[0].price.unit_amount / 100 : 0,
      currency: sub.items?.data?.[0]?.price?.currency || 'usd',
      defaultPaymentMethodId: sub.default_payment_method as string
    }))

    // Format payment methods
    const customerData = customer as Stripe.Customer
    const formattedPaymentMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      type: 'card' as const,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '',
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: pm.id === customerData.invoice_settings?.default_payment_method,
      status: 'active' as const
    }))

    // Calculate totals
    const totalInvoices = invoices.data.length
    const totalAmount = invoices.data.reduce((sum, inv) => sum + (inv.total / 100), 0)
    const paidAmount = invoices.data
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.total / 100), 0)

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customerData.id,
          email: customerData.email,
          name: customerData.name,
          balance: customerData.balance
        },
        invoices: formattedInvoices,
        subscriptions: formattedSubscriptions,
        paymentMethods: formattedPaymentMethods,
        totalInvoices,
        totalAmount,
        paidAmount
      }
    })
  } catch (error) {
    console.error('Error fetching billing info:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch billing information'
    return NextResponse.json(
      { 
        success: false, 
        error: message
      },
      { status: 500 }
    )
  }
}
