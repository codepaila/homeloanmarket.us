const CONSENT_KEY = "hlm_cookie_consent"

export type ConsentChoice = "accepted" | "rejected" | null

type Listener = () => void

let cachedConsent: ConsentChoice | undefined
const listeners = new Set<Listener>()

export function getStoredConsent(): ConsentChoice {
  if (typeof window === "undefined") return null
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    if (v === "accepted" || v === "rejected") return v
  } catch {
    // storage unavailable — treat as no choice
  }
  return null
}

export function setStoredConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return
  try {
    if (choice) localStorage.setItem(CONSENT_KEY, choice)
    else localStorage.removeItem(CONSENT_KEY)
  } catch {
    // storage unavailable — state still works for this session
  }
}

export function subscribeConsent(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getConsentSnapshot(): ConsentChoice {
  if (typeof window === "undefined") return null
  if (cachedConsent === undefined) cachedConsent = getStoredConsent()
  return cachedConsent
}

export function setConsentChoice(choice: ConsentChoice): void {
  cachedConsent = choice
  setStoredConsent(choice)
  for (const listener of listeners) listener()
}
