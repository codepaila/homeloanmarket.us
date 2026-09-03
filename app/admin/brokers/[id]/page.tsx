import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import AdminBrokerActions from './AdminBrokerActions'
import MortgageExpertControl from './MortgageExpertControl'
import { brokerSubscriptionHasProfileBadge } from '@/lib/broker-plans'

export default async function AdminBrokerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')
  const { id } = await params
  const broker = await prisma.broker.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      companyName: true,
      description: true,
      phone: true,
      email: true,
      officeAddress: true,
      city: true,
      state: true,
      pinCode: true,
      nmls: true,
      licenseStates: true,
      isVisible: true,
      profileSlug: true,
      userId: true,
      creationSource: true,
      verificationStatus: true,
      logo: true,
      coverImage: true,
      profileImage: true,
      mortgageExpertEnabled: true,
      subscription: {
        select: {
          plan: true,
          planId: true,
          isActive: true,
          startDate: true,
          endDate: true,
          planRef: { include: { features: true } },
        },
      },
      claim: {
        select: {
          status: true,
          invitations: {
            select: { id: true, recipientEmail: true, status: true, expiresAt: true, usedAt: true, revokedAt: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          events: {
            select: { id: true, eventType: true, occurredAt: true, actor: { select: { name: true } } },
            orderBy: { occurredAt: 'asc' },
          },
        },
      },
    },
  })
  if (!broker) notFound()

  const brokerDto = {
    id: broker.id,
    displayName: broker.displayName,
    companyName: broker.companyName,
    description: broker.description,
    phone: broker.phone,
    email: broker.email,
    officeAddress: broker.officeAddress,
    city: broker.city || '',
    state: broker.state || '',
    pinCode: broker.pinCode || '',
    nmls: broker.nmls,
    licenseStates: broker.licenseStates || [],
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    logo: broker.logo,
    coverImage: broker.coverImage,
    profileImage: broker.profileImage,
    mortgageExpertEnabled: broker.mortgageExpertEnabled,
    subscription: broker.subscription,
    profileBadge: brokerSubscriptionHasProfileBadge(broker.subscription),
    claim: broker.claim,
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Broker Management</p>
        <h1 className="text-3xl font-semibold tracking-tight">{broker.companyName || broker.displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">/{broker.profileSlug}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Ownership', broker.userId ? 'OWNED' : 'UNOWNED'],
          ['Source', broker.creationSource || 'UNCLASSIFIED'],
          ['Verification', broker.verificationStatus],
          ['Subscription', `${broker.subscription?.plan || 'FREE'}${broker.subscription?.isActive ? '' : ' / INACTIVE'}`],
          ['Visibility', broker.isVisible ? 'PUBLISHED' : 'UNPUBLISHED'],
        ].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p></div>)}
      </div>
      <AdminBrokerActions broker={brokerDto} />

      <MortgageExpertControl
        brokerId={broker.id}
        mortgageExpertEnabled={broker.mortgageExpertEnabled}
        profileBadge={brokerDto.profileBadge}
        subscription={broker.subscription}
      />

      {broker.claim?.events && broker.claim.events.length > 0 && (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Claim Timeline</h2>
          <ol className="mt-4 space-y-3">
            {broker.claim.events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="font-medium">{event.eventType}</p>
                  <p className="text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}{event.actor?.name ? ` · ${event.actor.name}` : ''}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
