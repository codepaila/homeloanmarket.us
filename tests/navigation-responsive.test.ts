import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const header = fs.readFileSync('components/layout/Header.tsx', 'utf8')

test('mobile menu closes on outside click', () => {
  assert.match(header, /setIsMenuOpen\(false\)/)
  assert.match(header, /mobileMenuRef\.current\?\.contains\(target\)/)
  assert.match(header, /headerRef\.current\?\.contains\(target\)/)
})

test('mobile menu button is labelled, references the menu via aria-controls, and labels reflect open/closed state', () => {
  assert.match(header, /aria-controls="mobile-menu"/)
  assert.match(header, /id="mobile-menu"/)
  assert.match(header, /aria-expanded=\{isMenuOpen\}/)
  assert.match(header, /aria-label=\{isMenuOpen \? 'Close menu' : 'Open menu'\}/)
})

test('scroll state uses a threshold rather than tracking every pixel', () => {
  assert.match(header, /setScrolled\(latest > 6\)/)
})

test('menus close on route change', () => {
  assert.match(header, /setIsMenuOpen\(false\)/)
  assert.match(header, /setIsUserMenuOpen\(false\)/)
})

test('mobile menu is fixed to the viewport below the sticky header and scrolls internally', () => {
  assert.match(header, /className="fixed inset-x-0 top-16 bottom-0 z-30 overflow-hidden border-b border-border bg-card shadow-large md:top-\[72px\] lg:hidden"/)
  assert.match(header, /overflow-y-auto overscroll-behavior-contain/)
  assert.match(header, /aria-label="Mobile navigation"/)
  assert.match(header, /top-16 bottom-0/)
})

test('body scroll lock restores the previous overflow rather than blanking it', () => {
  assert.match(header, /const previousOverflow = document\.body\.style\.overflow/)
  assert.match(header, /document\.body\.style\.overflow = previousOverflow/)
})

test('mobile menu closes when the viewport crosses to desktop', () => {
  assert.match(header, /window\.matchMedia\('\(min-width: 1024px\)'\)/)
  assert.match(header, /if \(mq\.matches\) setIsMenuOpen\(false\)/)
})

test('Escape returns focus to the mobile menu toggle', () => {
  assert.match(header, /toggleButtonRef\.current\?\.focus\(\)/)
  assert.match(header, /toggleButtonRef = useRef/)
})
