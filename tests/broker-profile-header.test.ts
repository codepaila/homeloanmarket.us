import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync('components/sections/broker/BrokerDetailClient.tsx', 'utf8')

test('broker name and company are rendered in the profile header', () => {
  assert.match(source, /<h1[^>]*>\s*\{displayName\}/)
  assert.match(source, /\{companyName\}/)
})

test('avatar is positioned independently and overlaps the cover, not the name', () => {
  // Avatar hangs 64px below the cover via -bottom-16.
  assert.match(source, /-bottom-16/)
  assert.match(source, /md:left-8/)
})

test('profile header clears the avatar with consistent spacing at all widths', () => {
  // The name area must not collapse to a smaller top margin on desktop.
  assert.match(source, /className="mt-20 space-y-4 text-center md:mt-20 md:text-left"/)
  assert.doesNotMatch(source, /md:mt-12/)
})

test('broker name is not clipped by overflow or truncation', () => {
  const headerBlock = source.slice(source.indexOf('<motion.header'), source.indexOf('</motion.header>'))
  assert.doesNotMatch(headerBlock, /overflow-hidden/)
  assert.doesNotMatch(headerBlock, /truncate/)
  assert.doesNotMatch(headerBlock, /line-clamp/)
})
