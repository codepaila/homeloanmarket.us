import assert from 'node:assert/strict'
import test from 'node:test'
import { isHtmlContent, sanitizeArticleHtml, ALLOWED_TAGS } from '../lib/blog-content'

// ===========================================================================
// isHtmlContent — legacy plain text vs HTML compat-branch heuristic
// ===========================================================================

test('plain text is not detected as HTML', () => {
  assert.equal(isHtmlContent('A detailed article for prospective home buyers.'), false)
  assert.equal(isHtmlContent('Line one\n\nLine two'), false)
  assert.equal(isHtmlContent('Draft content.'), false)
})

test('empty and whitespace-only content is not HTML', () => {
  assert.equal(isHtmlContent(''), false)
  assert.equal(isHtmlContent('   '), false)
  assert.equal(isHtmlContent(null), false)
  assert.equal(isHtmlContent(undefined), false)
})

test('editor HTML is detected as HTML', () => {
  assert.equal(isHtmlContent('<p>Hello</p>'), true)
  assert.equal(isHtmlContent('<h2>Heading</h2><p>Body</p>'), true)
  assert.equal(isHtmlContent('<ul><li>Item</li></ul>'), true)
})

test('arithmetic comparisons are not mistaken for tags', () => {
  assert.equal(isHtmlContent('if a < b then c'), false)
  assert.equal(isHtmlContent('1 < 2 and 3 > 2'), false)
  // A '<' not followed by an ASCII letter is not a tag start.
  assert.equal(isHtmlContent('5 < 10\nNext line'), false)
})

// ===========================================================================
// sanitizeArticleHtml — legitimate editor output survives
// ===========================================================================

test('legitimate headings, paragraphs, and lists survive sanitization', () => {
  const html = '<h2>Heading</h2><p>Paragraph</p><ul><li>Item</li></ul><ol><li>First</li></ol>'
  assert.equal(sanitizeArticleHtml(html), html)
})

test('blockquote, code, pre, and horizontal rule survive sanitization', () => {
  assert.equal(sanitizeArticleHtml('<blockquote>Quote</blockquote>'), '<blockquote>Quote</blockquote>')
  assert.equal(sanitizeArticleHtml('<pre><code>const x = 1</code></pre>'), '<pre><code>const x = 1</code></pre>')
  // sanitize-html serializes void elements with XHTML-style self-closing.
  assert.match(sanitizeArticleHtml('<hr>'), /^<hr \/?>$/)
})

test('formatting marks survive sanitization', () => {
  assert.equal(sanitizeArticleHtml('<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s></p>'), '<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s></p>')
})

test('legitimate links survive with href preserved', () => {
  const out = sanitizeArticleHtml('<p><a href="https://example.com">Link</a></p>')
  assert.ok(out.includes('href="https://example.com"'), out)
  assert.ok(out.includes('>Link</a>'), out)
})

test('empty content sanitizes to empty string', () => {
  assert.equal(sanitizeArticleHtml(''), '')
  assert.equal(sanitizeArticleHtml('   '), '')
  assert.equal(sanitizeArticleHtml(null), '')
  assert.equal(sanitizeArticleHtml(undefined), '')
})

// ===========================================================================
// sanitizeArticleHtml — malicious content is removed or neutralized
// ===========================================================================

test('script tags are removed entirely, including their text content', () => {
  const out = sanitizeArticleHtml('<p>Safe</p><script>alert(1)</script>')
  assert.ok(!out.includes('script'), out)
  assert.ok(!out.includes('alert(1)'), out)
  assert.ok(out.includes('<p>Safe</p>'), out)
})

test('event handler attributes are stripped (onerror, onload, onclick)', () => {
  assert.equal(sanitizeArticleHtml('<p onclick="alert(1)">text</p>'), '<p>text</p>')
  // <img> is not allowed at all, so the element is dropped regardless of attrs.
  const imgOut = sanitizeArticleHtml('<img src=x onerror=alert(1)>')
  assert.ok(!imgOut.includes('onerror'), imgOut)
  assert.ok(!imgOut.includes('<img'), imgOut)
})

test('javascript: URLs are removed from links', () => {
  const out = sanitizeArticleHtml('<a href="javascript:alert(1)">Click</a>')
  assert.ok(!out.includes('javascript:'), out)
  // Case/whitespace obfuscation is also caught by the scheme allowlist.
  const mixed = sanitizeArticleHtml('<a href="JaVaScRiPt:alert(1)">Click</a>')
  assert.ok(!/javascript/i.test(mixed), mixed)
})

test('vbscript: and data: URL schemes are removed from links', () => {
  assert.ok(!sanitizeArticleHtml('<a href="vbscript:msgbox(1)">x</a>').includes('vbscript:'))
  assert.ok(!sanitizeArticleHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>').includes('data:'))
})

test('protocol-relative URLs are removed', () => {
  const out = sanitizeArticleHtml('<a href="//evil.example.com">x</a>')
  assert.ok(!out.includes('//evil.example.com'), out)
})

test('unsupported web schemes (file:, tel:) are stripped from href', () => {
  assert.ok(!sanitizeArticleHtml('<a href="file:///etc/passwd">x</a>').includes('file:'))
  assert.ok(!sanitizeArticleHtml('<a href="tel:+15551234567">x</a>').includes('tel:'))
})

test('dangerous structural tags are dropped with their contents', () => {
  for (const [tag, payload] of [
    ['iframe', '<iframe src="https://evil.example.com"></iframe>'],
    ['object', '<object data="https://evil.example.com"></object>'],
    ['embed', '<embed src="https://evil.example.com">'],
    ['form', '<form action="https://evil.example.com"><input type="text"></form>'],
    ['svg', '<svg onload="alert(1)"><circle r="1"></circle></svg>'],
    ['style', '<style>body { display: none }</style>'],
  ] as const) {
    const out = sanitizeArticleHtml(`<p>before</p>${payload}<p>after</p>`)
    assert.ok(!out.includes(`<${tag}`), `${tag}: ${out}`)
    assert.ok(out.includes('<p>before</p>') && out.includes('<p>after</p>'), `${tag}: ${out}`)
  }
})

test('disallowed attributes (id, class, style, target injection) are stripped', () => {
  assert.equal(sanitizeArticleHtml('<p id="x" class="y" style="color: red">t</p>'), '<p>t</p>')
  // Only href/title are allowed on <a>.
  const out = sanitizeArticleHtml('<a href="https://example.com" onclick="x" style="y" id="z">L</a>')
  assert.ok(out.includes('href="https://example.com"'), out)
  assert.ok(!out.includes('onclick'), out)
  assert.ok(!out.includes('style'), out)
  assert.ok(!out.includes('id='), out)
})

test('editor target/rel attributes cannot survive sanitization; hardening is additive', () => {
  // Even if the editor (or an attacker) stores target/rel on a link, the render
  // boundary strips them and only the hardenExternalLinks post-pass re-adds rel.
  const out = sanitizeArticleHtml('<a href="https://example.com" target="_blank" rel="noopener noreferrer">L</a>')
  assert.ok(!out.includes('target='), out)
  assert.ok(/rel="[^"]*noopener[^"]*"/.test(out), out)
  assert.ok(/rel="[^"]*noreferrer[^"]*"/.test(out), out)
})

test('malformed HTML is normalized to a safe serialization', () => {
  const out = sanitizeArticleHtml('<p>Unclosed paragraph <strong>bold')
  assert.ok(out.includes('Unclosed paragraph'), out)
  assert.ok(out.includes('<strong>bold</strong>'), out)
  assert.ok(!out.includes('<script'), out)
})

test('nested malicious payload inside allowed tags is neutralized', () => {
  const out = sanitizeArticleHtml('<blockquote><p onclick="x"><a href="javascript:alert(1)">q</a></p></blockquote>')
  assert.ok(out.includes('<blockquote>'), out)
  assert.ok(!out.includes('onclick'), out)
  assert.ok(!out.includes('javascript:'), out)
})

test('deeply nested pathological input stays within the nesting limit', () => {
  const deep = '<blockquote>'.repeat(50) + 'x' + '</blockquote>'.repeat(50)
  const out = sanitizeArticleHtml(deep)
  assert.ok(!out.includes('<script'), out)
  // Nesting is capped (20) — the depth must not exceed the limit + root.
  const depth = (out.match(/<blockquote>/g) || []).length
  assert.ok(depth <= 20, `depth ${depth}`)
})

// ===========================================================================
// External link hardening (rel policy)
// ===========================================================================

test('external links gain rel="nofollow noopener noreferrer"', () => {
  const out = sanitizeArticleHtml('<a href="https://example.com/page">ext</a>')
  assert.ok(/rel="[^"]*noopener[^"]*"/.test(out), out)
  assert.ok(/rel="[^"]*noreferrer[^"]*"/.test(out), out)
  assert.ok(/rel="[^"]*nofollow[^"]*"/.test(out), out)
})

test('internal links are not nofollowed', () => {
  // Deterministic: pin the app URL for the duration of this test.
  const prev = process.env.NEXT_PUBLIC_APP_URL
  process.env.NEXT_PUBLIC_APP_URL = 'https://homeloanmarket.com'
  try {
    const out = sanitizeArticleHtml('<a href="https://homeloanmarket.com/blog">internal</a>')
    assert.ok(out.includes('href="https://homeloanmarket.com/blog"'), out)
    assert.ok(!out.includes('nofollow'), out)
  } finally {
    if (prev === undefined) process.env.NEXT_PUBLIC_APP_URL = ''
    else process.env.NEXT_PUBLIC_APP_URL = prev
  }
})

test('relative links are preserved and not nofollowed', () => {
  const out = sanitizeArticleHtml('<a href="/blog">blog</a>')
  assert.ok(out.includes('href="/blog"'), out)
  assert.ok(!out.includes('nofollow'), out)
})

test('mailto links survive and gain no rel hardening', () => {
  const out = sanitizeArticleHtml('<a href="mailto:support@homeloanmarket.com">mail</a>')
  assert.ok(out.includes('href="mailto:support@homeloanmarket.com"'), out)
  assert.ok(!out.includes('nofollow'), out)
})

// ===========================================================================
// Allowlist contract
// ===========================================================================

test('allowlist contains exactly the editor-supported tags', () => {
  assert.deepEqual(
    [...ALLOWED_TAGS].sort(),
    ['a', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'hr', 'li', 'ol', 'p', 'pre', 's', 'strong', 'u', 'ul'].sort(),
  )
})
