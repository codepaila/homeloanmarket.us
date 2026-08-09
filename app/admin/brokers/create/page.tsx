import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import AdminBrokerForm from './AdminBrokerForm'

export default async function AdminCreateBrokerPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')
  return <AdminBrokerForm />
}
