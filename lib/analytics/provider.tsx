"use client"

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react"
import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google"

import {
  ConsentChoice,
  getConsentSnapshot,
  setConsentChoice,
  subscribeConsent,
} from "./consent"
import { CookieBanner } from "@/components/analytics/CookieBanner"

interface ConsentContextValue {
  consent: ConsentChoice
  setConsent: (choice: ConsentChoice) => void
  /** Reset stored consent and re-show the banner so the user can change preferences. */
  resetConsent: () => void
}

const ConsentContextImpl = createContext<ConsentContextValue>({
  consent: null,
  setConsent: () => {},
  resetConsent: () => {},
})

export function useConsent() {
  return useContext(ConsentContextImpl)
}

// Hydration detection without setState-in-effect. Returns false during SSR,
// true after the first client render is hydrated.
const emptySubscribe = () => () => {}

function useHydrated() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

/**
 * Consent Mode v2 signals. `analytics_storage` follows the visitor's choice;
 * advertising signals stay denied because this build has no advertising tags.
 */
function pushConsentDefault(state: "granted" | "denied") {
  if (typeof window === "undefined") return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    consent: "default",
    analytics_storage: state,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
}

function pushConsentUpdate(state: "granted" | "denied") {
  if (typeof window === "undefined") return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    consent: "update",
    analytics_storage: state,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
}

let consentCommandsPushed = false

/**
 * Pushes `default=denied` followed by `update=granted` immediately before the
 * Google scripts mount so tags always observe a declared consent state. Runs
 * during render (idempotent dataLayer commands, once per page session).
 */
function pushGrantedCommands() {
  if (consentCommandsPushed) return
  consentCommandsPushed = true
  pushConsentDefault("denied")
  pushConsentUpdate("granted")
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || ""

function GoogleScripts({ consent }: { consent: ConsentChoice }) {
  // Third-party scripts are only mounted after the user accepts analytics.
  // Until then nothing loads and no pageview fires.
  if (consent !== "accepted") return null

  pushGrantedCommands()

  return (
    <>
      {GTM_ID && <GoogleTagManager gtmId={GTM_ID} />}
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </>
  )
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, () => null)
  const hydrated = useHydrated()

  const setConsent = useCallback((choice: ConsentChoice) => {
    setConsentChoice(choice)
  }, [])

  const resetConsent = useCallback(() => {
    setConsentChoice(null)
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({
        consent: "default",
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      })
    }
  }, [])

  const value = useMemo(
    () => ({ consent, setConsent, resetConsent }),
    [consent, setConsent, resetConsent],
  )

  return (
    <ConsentContextImpl.Provider value={value}>
      {children}
      {hydrated && consent === null && <CookieBanner />}
      <GoogleScripts consent={consent} />
    </ConsentContextImpl.Provider>
  )
}
