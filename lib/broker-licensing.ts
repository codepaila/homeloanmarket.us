// Broker US licensing helpers: NMLS ID normalization/validation and license
// state normalization/validation. These are shared by the server (onboarding
// completion, broker profile edit, admin broker create/edit) and, for the pure
// format checks, by client-side validation. The server always remains the
// authoritative validator.
//
// NMLS: this is presence + format enforcement only. There is no external NMLS
// API verification in this application.
import { isUsStateCode } from './us-states'

// NMLS identifiers are numeric. A "reasonable" format is 4–10 digits (typical
// individual originator IDs are 8 digits). Whitespace is trimmed and the value
// is normalized to its digit form.
const NMLS_PATTERN = /^\d{4,10}$/

export function normalizeNmls(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export function isValidNmls(value: string): boolean {
  return NMLS_PATTERN.test(value.trim())
}

// Returns a human-readable error message, or null when valid.
export function nmlsValidationError(value: unknown): string | null {
  const normalized = normalizeNmls(value)
  if (!normalized) return 'NMLS ID is required'
  if (!isValidNmls(normalized)) return 'NMLS ID must be 4–10 digits'
  return null
}

// Normalizes an arbitrary license-state value (array of codes) into a clean,
// deduplicated array of uppercase two-letter US state codes. Non-string and
// invalid entries are dropped. Throws nothing; the caller validates separately.
export function normalizeLicenseStates(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const code = entry.trim().toUpperCase()
    if (!code || seen.has(code)) continue
    seen.add(code)
    result.push(code)
  }
  return result
}

// Validates license states strictly: must be a non-empty array whose entries
// are all valid US state codes. Duplicates are already removed by normalize.
export function validateLicenseStates(value: unknown): { ok: true; states: string[] } | { ok: false; error: string } {
  const states = normalizeLicenseStates(value)
  if (states.length === 0) {
    return { ok: false, error: 'Select at least one licensed state' }
  }
  for (const code of states) {
    if (!isUsStateCode(code)) {
      return { ok: false, error: `"${code}" is not a valid US state code` }
    }
  }
  return { ok: true, states }
}

// Strict validation returning the normalized array or throwing with a friendly
// message. Used by server-side handlers.
export function requireValidLicenseStates(value: unknown): string[] {
  const result = validateLicenseStates(value)
  if (!result.ok) throw new Error(result.error)
  return result.states
}