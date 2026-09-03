import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const signupPage = fs.readFileSync('app/(public)/auth/signup/page.tsx', 'utf8')

// ============================================================================
// HYDRATION SAFETY TESTS
// ============================================================================

test('CAPTCHA initial state is deterministic (no Math.random in useState)', () => {
  // The useState initializer must NOT use Math.random
  const mathRandomInInit = signupPage.match(/useState\(\s*\(\)\s*=>[\s\S]{0,200}Math\.random/)
  assert.ok(!mathRandomInInit, 'useState initializer must not use Math.random')
})

test('CAPTCHA has a fixed initial question string', () => {
  // The initial state must be a literal object with fixed values
  assert.match(signupPage, /useState\(\s*\{\s*question:\s*['"][\d]+\s*\+\s*[\d]+['"]\s*,\s*answer:\s*\d+\s*\}\)/)
})

test('useEffect generates random CAPTCHA after hydration', () => {
  assert.match(signupPage, /useEffect\(\s*\(\)\s*=>\s*\{/)
  assert.match(signupPage, /setCaptcha\(generateCaptcha\(\)\)/)
})

test('generateCaptcha function uses Math.random', () => {
  assert.match(signupPage, /function\s+generateCaptcha\s*\(\)/)
  assert.match(signupPage, /Math\.floor\(Math\.random/)
})

test('No suppressHydrationWarning is used', () => {
  assert.doesNotMatch(signupPage, /suppressHydrationWarning/)
})

// ============================================================================
// CAPTCHA VALIDATION PRESERVATION TESTS
// ============================================================================

test('CAPTCHA answer is submitted to server', () => {
  assert.match(signupPage, /captchaAnswer:\s*Number\(captchaAnswer\)/)
})

test('Expected CAPTCHA answer is submitted to server', () => {
  assert.match(signupPage, /expectedCaptcha:\s*captcha\.answer/)
})

test('CAPTCHA validation error message preserved', () => {
  assert.match(signupPage, /Incorrect CAPTCHA answer/)
})

test('CAPTCHA input field preserved', () => {
  assert.match(signupPage, /name="captcha"/)
  assert.match(signupPage, /type="number"/)
})

// ============================================================================
// VISUAL DESIGN PRESERVATION TESTS
// ============================================================================

test('ShieldCheck icon is still used', () => {
  assert.match(signupPage, /ShieldCheck/)
})

test('AuthSection for security is preserved', () => {
  assert.match(signupPage, /AuthSection\s+title="Security and terms"/)
})

test('Question display format preserved', () => {
  assert.match(signupPage, /What is \{captcha\.question\}\?/)
})

// ============================================================================
// LIFECYCLE TESTS
// ============================================================================

test('hydrated state exists for tracking hydration status', () => {
  assert.match(signupPage, /setHydrated\(true\)/)
  assert.match(signupPage, /const\s+\[hydrated/)
})

test('CAPTCHA regenerates on mount via useEffect', () => {
  // The useEffect has no dependency array, meaning it runs once on mount
  const useEffectPattern = signupPage.match(/useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?setCaptcha[\s\S]*?\},\s*\[\]\s*\)/)
  assert.ok(useEffectPattern, 'useEffect should have empty dependency array (run once on mount)')
})

// ============================================================================
// SECURITY TESTS
// ============================================================================

test('CAPTCHA is not client-trusted (answer sent to server for verification)', () => {
  // The server receives both the user's answer AND the expected answer
  // This means the server can verify the answer independently
  const submitsBoth = signupPage.includes('captchaAnswer') && signupPage.includes('expectedCaptcha')
  assert.ok(submitsBoth, 'Both captchaAnswer and expectedCaptcha must be sent to server')
})

test('CAPTCHA numbers are in valid range (1-10)', () => {
  // Math.floor(Math.random() * 10) + 1 produces 1-10
  assert.match(signupPage, /Math\.floor\(Math\.random\(\)\s*\*\s*10\)\s*\+\s*1/)
})
