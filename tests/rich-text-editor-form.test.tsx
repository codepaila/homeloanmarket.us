import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { BlogForm } from '../components/admin/content/BlogForm'
import { RichTextEditor, isSafeLinkUrl } from '../components/editor/RichTextEditor'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const baseInitial = {
  title: 'Article',
  slug: 'article',
  excerpt: '',
  content: '<h2>Legacy heading</h2><p>Stored HTML.</p>',
  coverImage: null,
  author: 'Admin',
  category: 'Guides',
  tags: [] as string[],
  isPublished: false,
  seoTitle: null,
  seoDescription: null,
}

// ===========================================================================
// Editor SSR shell + business-logic-free boundary
// ===========================================================================

test('RichTextEditor renders an SSR-safe static shell (no browser APIs at render)', () => {
  // renderToStaticMarkup throws if the component touches browser APIs during
  // server render (useEditor with immediatelyRender: false renders null editor).
  const html = renderToStaticMarkup(
    <RichTextEditor value="<p>Hello</p>" onChange={() => undefined} />,
  )
  assert.ok(typeof html === 'string')
  assert.ok(html.length > 0)
})

test('BlogForm renders the editor and keeps the hidden content field', () => {
  const html = renderToStaticMarkup(
    <BlogForm action={async () => undefined} assets={[]} initial={baseInitial} />,
  )
  assert.ok(html.includes('name="content"'), 'hidden content field present')
  assert.ok(html.includes('rich-text'), 'editor chrome rendered')
  // The hidden field carries the stored content as an ESCAPED attribute value
  // (the FormData contract). Raw HTML markup must never appear unescaped in
  // the server-rendered shell — that would be a content-injection leak.
  assert.ok(!html.includes('<h2>Legacy heading</h2>'), 'no unescaped content markup in SSR shell')
  assert.ok(html.includes('&lt;h2&gt;Legacy heading'), 'content reaches the form as an escaped value')
})

test('BlogForm no longer renders the plain content textarea', () => {
  const html = renderToStaticMarkup(
    <BlogForm action={async () => undefined} assets={[]} initial={baseInitial} />,
  )
  assert.ok(!html.includes('<textarea'), 'textarea replaced by editor')
})

test('BlogForm label still points at content for a11y', () => {
  const html = renderToStaticMarkup(
    <BlogForm action={async () => undefined} assets={[]} initial={baseInitial} />,
  )
  assert.ok(html.includes('for="content"'))
})

// ===========================================================================
// Link URL validation (editor-side scheme gate)
// ===========================================================================

test('isSafeLinkUrl accepts http(s), mailto, relative, and anchor URLs', () => {
  assert.equal(isSafeLinkUrl('https://example.com/page'), true)
  assert.equal(isSafeLinkUrl('http://example.com'), true)
  assert.equal(isSafeLinkUrl('mailto:support@homeloanmarket.com'), true)
  assert.equal(isSafeLinkUrl('/blog/some-post'), true)
  assert.equal(isSafeLinkUrl('some-relative-path'), true)
  assert.equal(isSafeLinkUrl('#section'), true)
})

test('isSafeLinkUrl rejects javascript:, vbscript:, and data: URLs', () => {
  assert.equal(isSafeLinkUrl('javascript:alert(1)'), false)
  assert.equal(isSafeLinkUrl('JAVASCRIPT:alert(1)'), false)
  assert.equal(isSafeLinkUrl('java\tscript:alert(1)'), false)
  assert.equal(isSafeLinkUrl('vbscript:msgbox(1)'), false)
  assert.equal(isSafeLinkUrl('data:text/html,<script>alert(1)</script>'), false)
  assert.equal(isSafeLinkUrl('DATA:image/svg+xml;base64,AAAA'), false)
})

test('isSafeLinkUrl rejects unknown schemes and empty input', () => {
  assert.equal(isSafeLinkUrl('ftp://files.example.com'), false)
  assert.equal(isSafeLinkUrl('file:///etc/passwd'), false)
  assert.equal(isSafeLinkUrl(''), false)
  assert.equal(isSafeLinkUrl('   '), false)
})

// ===========================================================================
// Persistence contract in actions/content.ts
// ===========================================================================

test('createBlog and updateBlog persist sanitized content via the helper', () => {
  const actions = read('actions/content.ts')
  assert.match(actions, /prepareContentForPersistence\(formData\.get\('content'\)\)/)
  assert.match(actions, /import \{ isHtmlContent, sanitizeArticleHtml \} from '@\/lib\/blog-content'/)
  // Defense-in-depth contract: write-time sanitize + render-time sanitize.
  assert.match(actions, /isHtmlContent\(content\) \? sanitizeArticleHtml\(content\) : content/)
})

test('public renderer only uses dangerouslySetInnerHTML with sanitizer output', () => {
  const page = read('app/(public)/blog/[slug]/page.tsx')
  assert.match(page, /isHtmlContent\(post\.content\)/)
  assert.match(page, /sanitizeArticleHtml\(post\.content\)/)
  // Raw content must never reach dangerouslySetInnerHTML.
  assert.ok(!page.includes('__html: post.content'), 'raw content never rendered as HTML')
  // Legacy branch renders as text (escaped), preserving newlines.
  assert.match(page, /whitespace-pre-line/)
  // The legacy branch must not apply pre-line to the HTML branch: pre-line
  // appears only inside the plain-text branch.
  assert.ok(page.indexOf('whitespace-pre-line') > page.indexOf('isHtmlContent(post.content)'))
})

test('single canonical sanitizer: no second sanitizer or second editor exists', () => {
  const packageJson = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
  const deps = Object.keys(packageJson.dependencies)
  const editorLibs = deps.filter((dep) => /quill|lexical|slate|ckeditor|tinymce|editor\.js|jodit|trix/i.test(dep))
  assert.deepEqual(editorLibs, [], 'no second editor library installed')
  // Tiptap is the one editor; sanitize-html is the one sanitizer.
  assert.ok(deps.includes('@tiptap/react'))
  assert.ok(deps.includes('sanitize-html'))
})

test('public listing never reads or renders BlogPost.content', () => {
  const listing = read('app/(public)/blog/page.tsx')
  // The card excerpt comes from the authoritative excerpt field only.
  assert.ok(listing.includes('excerpt: true'), 'query selects the excerpt field')
  assert.ok(listing.includes('{post.excerpt}'), 'card renders the excerpt field')
  // BlogPost.content must not leak into listing cards.
  assert.ok(!listing.includes("content: true"), 'content is not selected')
  assert.ok(!listing.includes('{post.content}'), 'content is not rendered in cards')
  assert.ok(!listing.includes('dangerouslySetInnerHTML'), 'no raw HTML injection in listing')
  // Truncation stays display-safe via line-clamp.
  assert.ok(listing.includes('line-clamp-3'), 'excerpt truncation is applied')
})

test('editor source file has no embedded control bytes', () => {
  const editor = read('components/editor/RichTextEditor.tsx')
  // A literal NUL (or exotic C0 control) inside a regex class made the file read
  // as binary and broke tools. The scheme scrubber must use explicit \u escapes.
  // (\x09 tab / \x0A LF / \x0D CR are legitimate source formatting.)
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(editor), 'no exotic C0/DEL bytes in editor source')
  assert.ok(editor.includes(String.raw`[\s\u0000-\u001f\u007f]`), 'regex uses explicit unicode escapes')
})

test('editor toolbar buttons are keyboard-activatable', () => {
  const editor = read('components/editor/RichTextEditor.tsx')
  // Commands must run from onClick (Enter/Space dispatch click, never mousedown);
  // onMouseDown is kept only to preserve editor focus for the selection.
  assert.ok(editor.includes('onClick={onClick}'), 'button runs the command from onClick')
  assert.ok(editor.includes('type="button"'), 'buttons never submit the parent form')
})
