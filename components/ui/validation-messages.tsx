// components/ui/validation-messages.tsx
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValidationMessagesProps {
  errors: string[]
  className?: string
}

export function ValidationMessages({ errors, className }: ValidationMessagesProps) {
  if (!errors?.length) return null

  return (
    <div className={cn("space-y-2", className)}>
      {errors.map((error, index) => (
        <div key={index} className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ))}
    </div>
  )
}