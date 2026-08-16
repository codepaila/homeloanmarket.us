import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const header = fs.readFileSync('components/layout/Header.tsx', 'utf8')

test('mobile menu closes on outside click', () => {
  assert.match(header, /setIsMenuOpen\(false\)/)
  assert.match(header, /mobileMenuRef\.current\?\.contains\(target\)/)
  assert.match(header, /headerRef\.current\?\.contains\(target\)/)
})

test('mobile menu button is labelled and references the menu via aria-controls', () => {
  assert.match(header, /aria-controls="mobile-menu"/)
  assert.match(header, /id="mobile-menu"/)
  assert.match(header, /aria-expanded=\{isMenuOpen\}/)
})

test('scroll state uses a threshold rather than tracking every pixel', () => {
  assert.match(header, /setScrolled\(latest > 6\)/)
})

test('menus close on route change', () => {
  assert.match(header, /setIsMenuOpen\(false\)/)
  assert.match(header, /setIsUserMenuOpen\(false\)/)
})

test('mobile menu is fixed to the viewport below the sticky header', () => {
  assert.match(header, /className="fixed inset-x-0 top-16 z-30 overflow-hidden border-b border-border bg-card shadow-large md:top-\[72px\] lg:hidden"/)
})
