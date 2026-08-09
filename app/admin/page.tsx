import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { getAdminDashboardData } from '@/lib/admin/dashboard'
import { AdminDashboard } from '@/components/admin/dashboard/AdminDashboard'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== 'ADMIN') {
    redirect('/auth/signin')
  }

  let data
  try {
    data = await getAdminDashboardData()
  } catch (error) {
    console.error('Admin dashboard data load failed:', error instanceof Error ? error.message : 'unknown error')
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-base font-semibold">Unable to load dashboard data.</p>
          <p className="mt-1 text-sm text-muted-foreground">Refresh the page to try again.</p>
        </CardContent>
      </Card>
    )
  }

  return <AdminDashboard data={data} />
}
