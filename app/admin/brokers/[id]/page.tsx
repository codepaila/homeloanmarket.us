import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
      verifiedAt: true,
      brokerStatus: true,
      normalizedAddress: true,
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
    userId: broker.userId,
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    verifiedAt: broker.verifiedAt ? broker.verifiedAt.toISOString() : null,
    creationSource: broker.creationSource,
    brokerStatus: broker.brokerStatus,
    normalizedAddress: broker.normalizedAddress,
    logo: broker.logo,
    coverImage: broker.coverImage,
    profileImage: broker.profileImage,
    mortgageExpertEnabled: broker.mortgageExpertEnabled,
    subscription: broker.subscription,
    profileBadge: brokerSubscriptionHasProfileBadge(broker.subscription),
    claim: broker.claim,
  }

  const isVerified = broker.verificationStatus === 'VERIFIED'
  const isSuspended = broker.brokerStatus === 'SUSPENDED'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/brokers" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Brokers
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{broker.companyName || broker.displayName}</h1>
          {isSuspended && <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">Suspended</span>}
          {isVerified && <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">Verified</span>}
          {!isVerified && broker.creationSource === 'SELF_REGISTERED' && <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">Under Review</span>}
          {broker.isVisible && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Published</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">/{broker.profileSlug}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ['Ownership', broker.userId ? 'OWNED' : 'UNOWNED'],
          ['Source', broker.creationSource === 'ADMIN_CREATED' ? 'Admin Created' : broker.creationSource === 'SELF_REGISTERED' ? 'Self Registered' : 'Unclassified'],
          ['Verification', isVerified ? 'VERIFIED' : 'UNVERIFIED'],
          ['Subscription', `${broker.subscription?.plan || 'FREE'}${broker.subscription?.isActive ? '' : ' / INACTIVE'}`],
          ['Visibility', broker.isVisible ? 'PUBLISHED' : 'UNPUBLISHED'],
        ].map(([label, value]) => (
          <div key={label} className="rounded border bg-card p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1.5 truncate text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <AdminBrokerActions broker={brokerDto} />

      <MortgageExpertControl
        brokerId={broker.id}
        mortgageExpertEnabled={broker.mortgageExpertEnabled}
        profileBadge={brokerDto.profileBadge}
        subscription={broker.subscription}
      />

      {broker.claim?.events && broker.claim.events.length > 0 && (
        <section className="rounded border bg-card p-6">
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
