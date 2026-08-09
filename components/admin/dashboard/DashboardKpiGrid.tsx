import { ReactNode } from 'react'
import { DashboardSection } from './DashboardSection'

export function DashboardKpiGrid({ title, description, cards }: { title: string; description?: string; cards: ReactNode }) {
  return (
    <DashboardSection title={title} description={description}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards}</div>
    </DashboardSection>
  )
}
