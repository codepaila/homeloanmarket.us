import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import AdminBrokerActions from './AdminBrokerActions'

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
      isVisible: true,
      profileSlug: true,
      userId: true,
      creationSource: true,
      verificationStatus: true,
      subscription: { select: { plan: true, isActive: true } },
      claim: {
        select: {
          invitations: {
            select: { id: true, recipientEmail: true, status: true, expiresAt: true, usedAt: true, revokedAt: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
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
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
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
    </div>
  )
}
