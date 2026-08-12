import { auth } from "./auth"
import prisma from "./prisma"
import { SubscriptionService } from './subscription'
import { hasPaidEntitlement } from './broker-policy'

export async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.email) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    // Deliberately EXCLUDES accounts and contactMessages. Explicitly select
    // User scalars. Credentials and token fields are never
    // part of the generic current-user result, even if a caller serializes it.
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      brokerProfile: {
        include: {
          subscription: true,
          bankPartners: true,
          reviews: {
            include: {
              user: {
                select: { name: true }
              }
            },
            take: 5,
            orderBy: { createdAt: 'desc' }
          },
        }
      },
      brokerRegistration: {
        include: {
          subscription: true,
          draft: true,
        },
      },
      companyMemberships: {
        where: { isActive: true },
        include: { company: { include: { subscription: true } } },
      },
    },
  })

  if (!user) {
    return null
  }

  const brokerProfile = user.brokerProfile
  const subscription = brokerProfile?.subscription
  const effectiveSubscription = brokerProfile
    ? SubscriptionService.effectiveSubscription(subscription || null)
    : null
  const hasActiveSubscription = Boolean(effectiveSubscription?.isActive)
  const hasPaidSubscription = hasPaidEntitlement(effectiveSubscription)

  // Helper properties for backward compatibility
  const stripeCustomerId = subscription?.stripeCustomerId || null
  const subscriptionId = subscription?.stripeSubId || null
  const subscriptionPlan = effectiveSubscription?.plan || 'FREE'
  const subscriptionStatus = hasActiveSubscription ? 'ACTIVE' : 'INACTIVE'
  const subscriptionStartDate = effectiveSubscription?.startDate || null
  const subscriptionEndDate = effectiveSubscription?.endDate || null

  // Transform to include helper booleans
  return {
    ...user,
    // Subscription properties for backward compatibility
    stripeCustomerId,
    subscriptionId,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionStartDate,
    subscriptionEndDate,
    hasPaymentFailure: false,
    lastPaymentFailedAt: null,
    trialEndDate: null,
    
    // Helper booleans
    isAdmin: user.role === "ADMIN",
    isBroker: user.role === "BROKER",
    isUser: user.role === "USER",
    hasActiveSubscription,
    isVerifiedBroker: brokerProfile?.verificationStatus === "VERIFIED",
    isFeaturedBroker: hasPaidSubscription,
    isPremiumBroker: false,
    
    // Subscription object
    subscription: effectiveSubscription,
    
    brokerProfile: brokerProfile ? {
      ...brokerProfile,
       subscription: effectiveSubscription,
       hasActiveSubscription,
        canShowContact: hasPaidSubscription,
         isFeatured: hasPaidSubscription,
      isVerified: brokerProfile.verificationStatus === "VERIFIED",
    } : null,
  }
}
