/**
 * Lightweight analytics event helper.
 * Safe to call from any component — silently no-ops if analytics is unavailable.
 * Never sends PII. Only sends event name and non-PII parameters.
 */

// Matches the Window augmentation provided by @next/third-parties so both
// declarations stay compatible; this is the shared dataLayer used by gtag/GTM.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
    dataLayer?: Object[]
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return
  if (!window.dataLayer) return

  const safeParams: Record<string, string | number | boolean> = {}
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && key.toLowerCase().includes("email")) continue
      if (typeof value === "string" && key.toLowerCase().includes("phone")) continue
      if (typeof value === "string" && key.toLowerCase().includes("name")) continue
      if (typeof value === "string" && key.toLowerCase().includes("ssn")) continue
      if (typeof value === "string" && key.toLowerCase().includes("nmls")) continue
      safeParams[key] = value
    }
  }

  window.dataLayer.push({ event: eventName, ...safeParams })
}
