import assert from 'node:assert/strict'
import test from 'node:test'
import { postLoginRedirect, roleHome, sanitizeCallbackUrl } from '../lib/auth-redirect'

test('role homes use existing authoritative routes', () => {
  assert.equal(roleHome('ADMIN'), '/admin')
  assert.equal(roleHome('BROKER'), '/broker/dashboard')
  assert.equal(roleHome('USER'), '/')
})

test('role-aware login redirects select Admin, Broker, and User destinations', () => {
  assert.equal(postLoginRedirect('ADMIN'), '/admin')
  assert.equal(postLoginRedirect('BROKER'), '/broker/dashboard')
  assert.equal(postLoginRedirect('USER'), '/')
})

test('authenticated roles cannot use another role callback destination', () => {
  assert.equal(postLoginRedirect('ADMIN', '/broker/dashboard'), '/admin')
  assert.equal(postLoginRedirect('BROKER', '/admin/ads'), '/broker/dashboard')
  assert.equal(postLoginRedirect('USER', '/admin/ads'), '/')
  assert.equal(postLoginRedirect('USER', '/brokers'), '/brokers')
})

test('same-origin internal callback paths are accepted', () => {
  assert.equal(sanitizeCallbackUrl('/broker/dashboard?tab=profile'), '/broker/dashboard?tab=profile')
  assert.equal(sanitizeCallbackUrl('https://example.test/brokers?city=Miami'), '/brokers?city=Miami')
})

test('external, protocol-relative, dangerous, malformed, and login callbacks are rejected', () => {
  for (const value of ['https://evil.example', '//evil.example', 'javascript:alert(1)', 'data:text/html,unsafe', '/\\evil.example', '/auth/signin']) {
    assert.equal(sanitizeCallbackUrl(value), null)
  }
  assert.equal(postLoginRedirect('BROKER', '/auth/signin'), '/broker/dashboard')
})

test('legacy dashboard callback paths normalize to the role home', () => {
  assert.equal(postLoginRedirect('ADMIN', '/admin/dashboard'), '/admin')
  assert.equal(postLoginRedirect('BROKER', '/dashboard'), '/broker/dashboard')
})
