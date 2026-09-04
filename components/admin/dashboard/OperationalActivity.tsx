import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminDashboardData, RecentBroker, RecentClaim, RecentContact, RecentAdvertisement, RecentUser } from '@/lib/admin/dashboard'
import { DashboardEmptyState } from './DashboardEmptyState'

function Row({ primary, detail, meta }: { primary: string; detail: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{primary}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
    </div>
  )
}

function Panel({ title, description, children, empty }: { title: string; description: string; children: React.ReactNode; empty: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {empty ? <DashboardEmptyState message="No recent records." /> : children}
      </CardContent>
    </Card>
  )
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString()

export function RecentUsers({ users }: { users: RecentUser[] }) {
  return (
    <Panel title="Recent Users" description="Latest registrations" empty={users.length === 0}>
      {users.map((user, index) => (
        <Row key={`${user.email}-${index}`} primary={user.name || 'New user'} detail={user.email || ''} meta={`${user.role} · ${dateLabel(user.createdAt)}`} />
      ))}
    </Panel>
  )
}

export function RecentBrokers({ brokers }: { brokers: RecentBroker[] }) {
  return (
    <Panel title="Recent Brokers" description="Latest broker profiles" empty={brokers.length === 0}>
      {brokers.map((broker, index) => (
        <Row
          key={`${broker.displayName}-${index}`}
          primary={broker.companyName || broker.displayName}
          detail={[broker.city, broker.state].filter(Boolean).join(', ') || 'Location not provided'}
          meta={`${broker.brokerStatus} · ${dateLabel(broker.createdAt)}`}
        />
      ))}
    </Panel>
  )
}

export function RecentContacts({ contacts }: { contacts: RecentContact[] }) {
  return (
    <Panel title="Recent Contacts" description="Latest inquiries" empty={contacts.length === 0}>
      {contacts.map((contact, index) => (
        <Row
          key={`${contact.email}-${index}`}
          primary={contact.name}
          detail={contact.brokerName || 'Unknown broker'}
          meta={`${contact.city || '—'} · ${dateLabel(contact.createdAt)}`}
        />
      ))}
    </Panel>
  )
}

export function RecentClaims({ claims }: { claims: RecentClaim[] }) {
  return (
    <Panel title="Recent Claims" description="Latest claim activity" empty={claims.length === 0}>
      {claims.map((claim, index) => (
        <Row key={`${claim.brokerName}-${claim.status}-${index}`} primary={claim.brokerName || 'Unknown broker'} detail={`Status: ${claim.status}`} meta={dateLabel(claim.createdAt)} />
      ))}
    </Panel>
  )
}

export function RecentAdvertisements({ advertisements }: { advertisements: RecentAdvertisement[] }) {
  return (
    <Panel title="Recent Advertisements" description="Latest advertisement activity" empty={advertisements.length === 0}>
      {advertisements.map((advertisement, index) => (
        <Row
          key={`${advertisement.title}-${index}`}
          primary={advertisement.title}
          detail={advertisement.placement}
          meta={`${advertisement.isEnabled ? 'Enabled' : 'Disabled'} · ${dateLabel(advertisement.createdAt)}`}
        />
      ))}
    </Panel>
  )
}

export function OperationalActivity({ data }: { data: AdminDashboardData['recent'] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RecentUsers users={data.users} />
      <RecentBrokers brokers={data.brokers} />
      <RecentContacts contacts={data.contacts} />
      <RecentClaims claims={data.claims} />
      <div className="lg:col-span-2">
        <RecentAdvertisements advertisements={data.advertisements} />
      </div>
    </div>
  )
}
