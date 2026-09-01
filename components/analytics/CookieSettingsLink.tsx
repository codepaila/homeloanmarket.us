"use client"

import { useConsent } from "@/lib/analytics/provider"
import { Cookie } from "lucide-react"

export function CookieSettingsLink() {
  const { resetConsent } = useConsent()

  return (
    <button
      onClick={resetConsent}
      className="inline-flex items-center gap-1.5 text-sm transition-colors hover:underline"
      style={{
        color: "var(--muted-foreground)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
      aria-label="Manage cookie preferences"
    >
      <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
      Cookie Settings
    </button>
  )
}
