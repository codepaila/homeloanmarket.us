// lib/email-utils.ts
//
// Shared helpers for building safe, email-client-compatible transactional email
// HTML. A single escape function is used everywhere user-controlled data is
// interpolated so no template re-implements escaping.

// Escape a value for safe interpolation into HTML text/attributes. Handles the
// five HTML metacharacters; null/undefined render as empty string.
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Allow only http(s) URLs (and mailto for support links). Used for href values
// that may be influenced by data; returns null when unsafe so callers can omit
// the link entirely.
export function safeUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:|mailto:)/i.test(trimmed) && !/[\s"'<>]/.test(trimmed)) {
    return trimmed
  }
  return null
}

// Email-client-safe hidden preview text (preheader). Uses a zero-height,
// hidden-but-present div so major clients render it in the inbox preview.
export function preheaderHtml(preheader: string | null | undefined): string {
  if (!preheader) return ''
  const text = escapeHtml(preheader)
  return (
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;color:#ffffff;font-size:0;line-height:0;opacity:0;height:0;">` +
    `${text}\u200c\u200c\u200c\u200c\u200c\u200c\u200c\u200c\u200c\u200c\u200c\u200c\u200c` +
    `</div>`
  )
}

// Convert multi-line text to <br />-separated escaped HTML paragraphs.
export function escapeParagraphs(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join('<br />')
}