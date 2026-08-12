/* eslint-disable react-hooks/purity */
// app/broker/page.tsx - Simplified
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { BrokerDashboard } from '@/components/sections/broker/BrokerDashboard'
import { hasPaidEntitlement } from '@/lib/broker-policy'
import { roleHome } from '@/lib/auth-redirect'
import { toBrokerOwnerDto } from '@/lib/broker-owner-dto'
import { isBrokerSetupComplete } from '@/lib/broker-onboarding-state'

export default async function BrokerPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  if (user.role !== 'BROKER') {
    redirect(roleHome(user.role))
  }

  // Check if user has broker profile
  if (!isBrokerSetupComplete(user)) {
    const registrationSubscription = user.brokerRegistration?.subscription
    if (user.brokerRegistration && (!registrationSubscription?.isActive || registrationSubscription.status !== 'ACTIVE')) {
      redirect('/broker/subscription/select')
    }
    redirect('/setup')
  }

  // Fetch contact messages for initial render
  const contacts = await prisma.contactMessage.findMany({
    where: {
      brokerId: user.brokerProfile.id
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true
        }
      }
    }
  })

const subscription = user.brokerProfile.subscription
const hasPaidPlan = hasPaidEntitlement(subscription)

if (!hasPaidPlan) {
  // FREE owners retain dashboard access; only paid analytics are gated.
  const initialData = {
     broker: toBrokerOwnerDto(user.brokerProfile),
    stats: {
      recentContacts: contacts.length,
      requiresSubscription: false
    }
  }
  
  return <BrokerDashboard initialData={initialData} />
}

// For subscribed users, fetch analytics
const analytics = await prisma.contactMessage.aggregate({
  where: {
    brokerId: user.brokerProfile.id,
    createdAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    }
  },
  _count: {
    id: true
  },
  _avg: {
    loanAmount: true
  }
})

const initialData = {
   broker: toBrokerOwnerDto(user.brokerProfile),
  stats: {
    recentContacts: contacts.length,
    totalContacts30Days: analytics._count.id,
    avgLoanAmount: analytics._avg.loanAmount
  }
}

  return <BrokerDashboard initialData={initialData} />
}
