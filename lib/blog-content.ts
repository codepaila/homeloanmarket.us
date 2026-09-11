// lib/blog-content.ts
//
// Canonical BlogPost content helpers. ONE centralized article HTML sanitizer
// (allowlist-based, server-side). BlogPost.content is a plain String that may
// hold either legacy plain text (newlines preserved by the renderer) or editor
// HTML; isHtmlContent() is the single compat-branch heuristic.
//
// Security model: client/editor HTML is NEVER trusted. Sanitization happens at
// the public render boundary (mandatory) and at write time (defense-in-depth).
// Raw BlogPost.content is never passed to dangerouslySetInnerHTML.

import sanitizeHtml from 'sanitize-html'

/**
 * Tags the blog editor can produce today. Executable content (script, style,
 * iframe, object, embed, svg, form controls) is excluded by construction.
 */
export const ALLOWED_TAGS: readonly string[] = [
  'p',
  'h1',
  'h2',
  'h3',
  'strong',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'br',
  'hr',
  'code',
  'pre',
]

const ALLOWED_SCHEMES = ['http', 'https', 'mailto']

const SANITIZER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: {
    a: ['href', 'title'],
    // Intentionally no img/video/iframe in this phase (deferred features).
  },
  // These containers are dropped WITH their text content: script/style bodies
  // must never leak through as visible text.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  // Additional structural drop: elements not in the allowlist that carry no
  // meaningful article text. (script/style are covered by nonTextTags above.)
  exclusiveFilter: (frame) =>
    ['iframe', 'object', 'embed', 'svg', 'math', 'form', 'button', 'input', 'select'].includes(frame.tag),
  // Dangerous URL schemes: the attribute is stripped entirely.
  allowedSchemes: ALLOWED_SCHEMES,
  // '//evil.com' protocol-relative URLs are treated as dangerous and removed.
  allowProtocolRelative: false,
  // No inline styling, no class/id passthrough — presentation is owned by CSS.
  allowedStyles: {},
  // Hardening against pathological nesting.
  nestingLimit: 20,
}

/** True only for http(s) URLs that leave the site's own host. */
function isExternalHttpUrl(href: string): boolean {
  try {
    const parsed = new URL(href)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    try {
      const self = new URL(platformArticleBaseUrl())
      return parsed.host !== self.host
    } catch {
      // Without a configured base URL, treat every absolute http(s) URL as
      // external (hardening is additive and harmless for same-site links).
      return true
    }
  } catch {
    return false
  }
}

function platformArticleBaseUrl(): string {
  // Mirrors the site origin used elsewhere (NEXT_PUBLIC_APP_URL). A missing or
  // invalid value simply hardens more links; it never weakens sanitization.
  return process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
}

/**
 * Harden an already-sanitized document: external http(s) links gain
 * rel="nofollow noopener noreferrer". Runs as a post-pass over the sanitizer
 * output so the rel policy lives in exactly one place.
 */
function hardenExternalLinks(html: string): string {
  return html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (anchor) => {
    const hrefMatch = anchor.match(/\bhref="([^"]*)"/i)
    if (!hrefMatch) return anchor
    if (!isExternalHttpUrl(hrefMatch[1])) return anchor
    const relMatch = anchor.match(/\brel="([^"]*)"/i)
    const existing = (relMatch ? relMatch[1] : '').split(/\s+/).filter(Boolean)
    const hardened = Array.from(new Set([...existing, 'nofollow', 'noopener', 'noreferrer']))
    const hardenedRel = `rel="${hardened.join(' ')}"`
    if (relMatch) return anchor.replace(relMatch[0], hardenedRel)
    return anchor.replace(/<a\b/i, `<a ${hardenedRel}`)
  })
}

/**
 * Compat-branch heuristic: does this persisted content look like HTML?
 * A tag must start with '<' followed by an ASCII letter — matches every tag
 * the editor persists and rejects arithmetic comparisons like 'a < b'.
 */
export function isHtmlContent(content: string | null | undefined): boolean {
  if (!content || !content.trim()) return false
  return /<[a-z][\s\S]*>/i.test(content)
}

/**
 * The ONE canonical article sanitizer. Returns '' for empty input. The result
 * is the ONLY form of BlogPost.content ever rendered via dangerouslySetInnerHTML.
 */
export function sanitizeArticleHtml(content: string | null | undefined): string {
  if (!content || !content.trim()) return ''
  return hardenExternalLinks(sanitizeHtml(content, SANITIZER_OPTIONS))
}
