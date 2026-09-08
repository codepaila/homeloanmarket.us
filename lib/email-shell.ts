// lib/email-shell.ts
//
// The single HomeLoanMarket transactional email shell. Every customer-facing
// template renders through this shell so all emails share one visual identity,
// one header, one footer, one CTA style, and email-client-safe markup.
//
// Safety constraints honored here:
//   - no CSS @import / web fonts (system font stack)
//   - no CSS variables, gradients, pseudo-elements, flex/grid, or JavaScript
//   - table-based structural layout with conservative inline styles
//   - preheader support (hidden preview text)
//   - optional sections (social, legal, status) render only when data exists

import { emailTokens as t } from '@/lib/email-tokens'
import { escapeHtml, safeUrl, preheaderHtml } from '@/lib/email-utils'

export type EmailStatusTone = 'success' | 'warning' | 'destructive' | 'neutral'

export type EmailSocialLink = { label: string; url: string }

export type EmailShellOptions = {
  preheader?: string
  title?: string
  subtitle?: string
  message?: string
  // Primary CTA (optional; render only when present)
  ctaLabel?: string
  ctaHref?: string
  // Optional key/value information table
  info?: Record<string, string>
  // Optional status block (e.g. "Status: Verified")
  status?: { tone: EmailStatusTone; label: string; detail?: string }
  // Optional social links — render only real, validated URLs
  social?: EmailSocialLink[]
  // Optional footer note; when omitted the standard footer shows
  footerNote?: string
}

function statusColor(tone: EmailStatusTone) {
  switch (tone) {
    case 'success': return { text: t.success, background: t.successBackground, border: '#86efac' }
    case 'warning': return { text: t.warning, background: t.warningBackground, border: '#fcd34d' }
    case 'destructive': return { text: t.destructive, background: t.destructiveBackground, border: '#fca5a5' }
    default: return { text: t.muted, background: t.background, border: t.border }
  }
}

function headerHtml() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
  // Canonical HomeLoanMarket light logo (/assets/logo.png) rendered from an
  // absolute hosted URL. Email clients may block remote images, so the img alt
  // carries the "HomeLoanMarket" wordmark styled to match the brand — that text
  // fallback stays visible when images are blocked and the email never depends
  // on the image loading.
  return `
    <tr>
      <td align="center" style="padding: 28px 24px 12px 24px;">
        <img src="${escapeHtml(appUrl)}/assets/logo.png" alt="HomeLoanMarket" width="220"
             style="display:inline-block; max-width:220px; width:220px; height:auto; border:0; outline:none; text-decoration:none; font-family:${t.fontFamily}; font-size:22px; font-weight:bold; color:${t.foreground};" />
        <div style="font-size: 12px; color: ${t.muted}; margin-top: 6px;">Connecting homebuyers with trusted mortgage professionals across the United States</div>
      </td>
    </tr>
  `
}

function ctaHtml(label: string, href: string) {
  const url = safeUrl(href)
  if (!url) return ''
  return `
    <tr>
      <td align="center" style="padding: 20px 24px 0 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
          <tr>
            <td align="center" bgcolor="${t.cta}" style="border-radius: 6px;">
              <a href="${escapeHtml(url)}" target="_blank"
                 style="display: inline-block; background-color: ${t.cta}; color: ${t.ctaText};
                        padding: 12px 28px; border-radius: 6px; font-size: 15px;
                        font-weight: bold; text-decoration: none;">${escapeHtml(label)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

function statusHtml(status: EmailShellOptions['status']) {
  if (!status) return ''
  const c = statusColor(status.tone)
  return `
    <tr>
      <td style="padding: 20px 24px 0 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
               style="background: ${c.background}; border: 1px solid ${c.border}; border-radius: 6px;">
          <tr>
            <td style="padding: 14px 16px; font-size: 14px; color: ${c.text};">
              <span style="font-weight: bold;">${escapeHtml(status.label)}</span>${status.detail ? ` &mdash; ${escapeHtml(status.detail)}` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

function infoHtml(info: Record<string, string>) {
  const rows = Object.entries(info).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  if (rows.length === 0) return ''
  const body = rows
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid ${t.border}; color: ${t.muted}; font-size: 13px; width: 40%; vertical-align: top;">${escapeHtml(key)}</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid ${t.border}; color: ${t.text}; font-size: 14px; font-weight: 500; vertical-align: top;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join('')
  return `
    <tr>
      <td style="padding: 24px 24px 0 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
               style="background: ${t.background}; border: 1px solid ${t.border}; border-radius: 6px;">
          ${body}
        </table>
      </td>
    </tr>
  `
}

function socialHtml(social: EmailSocialLink[]) {
  const links = (social || [])
    .map((item) => ({ label: item.label, url: safeUrl(item.url) }))
    .filter((item) => item.url !== null) as Array<{ label: string; url: string }>
  if (links.length === 0) return ''
  const rendered = links
    .map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" style="color: ${t.link}; text-decoration: none; font-size: 13px; margin: 0 8px;">${escapeHtml(item.label)}</a>`)
    .join(' &middot; ')
  return `
    <div style="margin-top: 16px; font-size: 13px; color: ${t.muted};">${rendered}</div>
  `
}

function footerHtml(options: EmailShellOptions) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
  const legal = `
    <a href="${escapeHtml(appUrl)}/privacy-policy" style="color: ${t.muted}; text-decoration: none; font-size: 12px; margin: 0 6px;">Privacy Policy</a>
    &middot;
    <a href="${escapeHtml(appUrl)}/terms-of-service" style="color: ${t.muted}; text-decoration: none; font-size: 12px; margin: 0 6px;">Terms of Service</a>
  `
  return `
    <tr>
      <td style="background: ${t.surface}; border-top: 1px solid ${t.border}; padding: 20px 24px 28px 24px; text-align: center; font-size: 12px; color: ${t.muted};">
        <div>HomeLoanMarket</div>
        ${options.footerNote ? `<div style="margin-top: 6px;">${escapeHtml(options.footerNote)}</div>` : ''}
        ${socialHtml(options.social || [])}
        <div style="margin-top: 10px;">${legal}</div>
        <div style="margin-top: 10px; color: ${t.muted};">&copy; ${new Date().getFullYear()} HomeLoanMarket. All rights reserved.</div>
      </td>
    </tr>
  `
}

// Render the full transactional email shell. Returns the outer HTML; the caller
// combines it with subject/preheader.
export function renderEmailShell(options: EmailShellOptions): string {
  const messageHtml = options.message
    ? `<div style="font-size: 15px; line-height: 1.6; color: ${t.text}; margin-bottom: 8px;">${escapeHtml(options.message).replace(/\n/g, '<br />')}</div>`
    : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(options.preheader || options.title || '')}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${t.background};">
  ${preheaderHtml(options.preheader)}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${t.background};">
    <tr>
      <td align="center" style="padding: 16px 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; width: 100%; background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 8px;">
          ${headerHtml()}
          <tr>
            <td style="padding: 8px 24px 24px 24px;">
              ${options.title ? `<h1 style="margin: 0 0 4px 0; color: ${t.foreground}; font-size: 22px; font-weight: 700;">${escapeHtml(options.title)}</h1>` : ''}
              ${options.subtitle ? `<p style="margin: 0 0 16px 0; color: ${t.muted}; font-size: 15px;">${escapeHtml(options.subtitle)}</p>` : ''}
              ${messageHtml}
            </td>
          </tr>
          ${statusHtml(options.status)}
          ${infoHtml(options.info || {})}
          ${ctaHtml(options.ctaLabel || '', options.ctaHref || '')}
          ${footerHtml(options)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}