import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/currentUser'
import { CreateTicketForm } from '@/components/support/CreateTicketForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Create Support Ticket',
  robots: { index: false, follow: false },
}

export default async function CreateSupportTicketPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'BROKER') {
    redirect('/auth/signin')
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Create a Support Ticket</CardTitle>
        <CardDescription>
          Describe the issue and our support team will get back to you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateTicketForm />
      </CardContent>
    </Card>
  )
}