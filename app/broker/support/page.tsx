import { redirect } from 'next/navigation'

export default async function BrokerSupportIndexPage() {
  redirect('/broker/support/tickets')
}