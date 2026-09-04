"use client"

import { useConsent } from "@/lib/analytics/provider"
import { useState } from "react"
import { Cookie, X, Check, Settings } from "lucide-react"

export function CookieBanner() {
  const { consent, setConsent } = useConsent()
  const [expanded, setExpanded] = useState(false)

  if (consent !== null) return null

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
    >
      <div
        className="mx-auto max-w-2xl rounded border shadow-lg"
        style={{
          background: "var(--background)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-large)",
        }}
      >
        {/* Main Banner */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <Cookie
              className="h-6 w-6 mt-0.5 flex-shrink-0"
              style={{ color: "var(--primary)" }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <h2
                className="text-base font-semibold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                We value your privacy
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                Analytics cookies help us understand how visitors use the site so
                we can improve the experience. You can accept or reject analytics
                cookies below.
              </p>

              {/* Expanded Details */}
              {expanded && (
                <div
                  className="mt-4 space-y-3 text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <div>
                    <h3
                      className="font-medium mb-1"
                      style={{ color: "var(--foreground)" }}
                    >
                      What we track
                    </h3>
                    <p>
                      Anonymous page views, session duration, and navigation
                      patterns via Google Analytics. No personal information
                      (names, emails, phone numbers) is collected.
                    </p>
                  </div>
                  <div>
                    <h3
                      className="font-medium mb-1"
                      style={{ color: "var(--foreground)" }}
                    >
                      Your choice
                    </h3>
                    <p>
                      You can change your preference at any time by clicking the
                      cookie settings link in the footer.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0 p-1.5 rounded transition-colors"
              style={{
                color: "var(--muted-foreground)",
                background: "transparent",
              }}
              aria-label={expanded ? "Show less information" : "Show more information"}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--muted)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-5 sm:px-6 pb-5 sm:pb-6"
        >
          <button
            onClick={() => setConsent("rejected")}
            className="btn btn-secondary text-sm justify-center"
            style={{
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            <X className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Reject Analytics
          </button>
          <button
            onClick={() => setConsent("accepted")}
            className="btn btn-primary text-sm justify-center"
          >
            <Check className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Accept Analytics
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="sm:ml-auto text-sm underline transition-colors"
            style={{
              color: "var(--muted-foreground)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {expanded ? "Show less" : "Learn more"}
          </button>
        </div>
      </div>
    </div>
  )
}
