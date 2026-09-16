import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import CalculatorPage, {
  calculateMortgage,
  clampLoanTerm,
  DEFAULT_HOME_PRICE,
  DEFAULT_DOWN_PAYMENT,
  DEFAULT_INTEREST_RATE,
  DEFAULT_LOAN_TERM,
  LOAN_TERM_PRESETS,
  MAX_HOME_PRICE,
  MAX_LOAN_TERM,
  MIN_HOME_PRICE,
  MIN_LOAN_TERM,
} from '../app/(public)/calculator/page'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const source = read('app/(public)/calculator/page.tsx')

// Render the client component on the server to assert the *initial* UI state.
const html = renderToStaticMarkup(React.createElement(CalculatorPage))

const monthlyPaymentFor = (principal: number, annualRatePct: number, years: number) => {
  const r = annualRatePct / 100 / 12
  const n = years * 12
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1)
}

// ---------------------------------------------------------------------------
// A. Defaults
// ---------------------------------------------------------------------------

test('A: default home price, down payment, derived loan amount, and term', () => {
  assert.equal(DEFAULT_HOME_PRICE, 300000)
  assert.equal(DEFAULT_DOWN_PAYMENT, 20)
  assert.equal(DEFAULT_LOAN_TERM, 30)
  const defaults = calculateMortgage({
    homePrice: DEFAULT_HOME_PRICE,
    downPaymentPercent: DEFAULT_DOWN_PAYMENT,
    interestRate: DEFAULT_INTEREST_RATE,
    loanTerm: DEFAULT_LOAN_TERM,
  })
  assert.equal(defaults.downPaymentAmount, 60000)
  assert.equal(defaults.loanAmount, 240000)
  assert.match(html, /Home price/)
  assert.match(html, /value="300,000"/)
})

// ---------------------------------------------------------------------------
// B. Term presets
// ---------------------------------------------------------------------------

test('B: term presets are 15, 20, 30 and Other, defaulting to 30', () => {
  assert.deepEqual([...LOAN_TERM_PRESETS], [15, 20, 30])
  assert.equal(DEFAULT_LOAN_TERM, 30)
  assert.match(html, /15 yr/)
  assert.match(html, /20 yr/)
  assert.match(html, /30 yr/)
  assert.match(html, /Other/)
  // Exactly the default (30) is pressed.
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
  const pressedIndex = html.indexOf('aria-pressed="true"')
  const pressed = html.slice(pressedIndex, pressedIndex + 400)
  assert.match(pressed, /30 yr/)
})

// ---------------------------------------------------------------------------
// C. Derived values
// ---------------------------------------------------------------------------

test('C: home price + down payment derive the loan amount', () => {
  const base = calculateMortgage({ homePrice: 300000, downPaymentPercent: 20, interestRate: 6.5, loanTerm: 30 })
  assert.equal(base.downPaymentAmount, 60000)
  assert.equal(base.loanAmount, 240000)

  // Changing home price updates both derived values.
  const higher = calculateMortgage({ homePrice: 400000, downPaymentPercent: 20, interestRate: 6.5, loanTerm: 30 })
  assert.equal(higher.downPaymentAmount, 80000)
  assert.equal(higher.loanAmount, 320000)

  // Changing down payment updates both derived values.
  const lowerDown = calculateMortgage({ homePrice: 300000, downPaymentPercent: 10, interestRate: 6.5, loanTerm: 30 })
  assert.equal(lowerDown.downPaymentAmount, 30000)
  assert.equal(lowerDown.loanAmount, 270000)

  // The rendered summary shows the derived loan amount, not the home price.
  assert.match(html, /Loan amount/)
  assert.match(html, /\$240,000/)
  assert.match(html, /\$60,000/)
})

// ---------------------------------------------------------------------------
// D. Custom term validation / guarding
// ---------------------------------------------------------------------------

test('D: supported custom terms (5, 10, 25, 40, 1, 50) are accepted', () => {
  for (const term of [5, 10, 25, 40, 1, 50]) {
    assert.equal(clampLoanTerm(term), term, `term ${term}`)
  }
})

test('D: invalid custom terms are guarded', () => {
  assert.equal(clampLoanTerm(0), MIN_LOAN_TERM)
  assert.equal(clampLoanTerm(-5), MIN_LOAN_TERM)
  assert.equal(clampLoanTerm(25.7), 26) // decimals normalized to whole years
  assert.equal(clampLoanTerm(51), MAX_LOAN_TERM)
  assert.equal(clampLoanTerm(Number.NaN), DEFAULT_LOAN_TERM)
  assert.equal(clampLoanTerm(Number.POSITIVE_INFINITY), DEFAULT_LOAN_TERM)
  assert.equal(MIN_LOAN_TERM, 1)
  assert.equal(MAX_LOAN_TERM, 50)
})

test('D: an invalid custom term never produces NaN/Infinity in the calculation', () => {
  for (const term of [0, -1, 51, 1000, Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = calculateMortgage({ homePrice: 300000, downPaymentPercent: 20, interestRate: 6.5, loanTerm: term })
    for (const v of [r.monthlyPayment, r.totalPayment, r.totalInterest, r.interestShare, r.principalShare, r.loanAmount]) {
      assert.ok(Number.isFinite(v), `term ${term} produced a non-finite value`)
    }
  }
})

// ---------------------------------------------------------------------------
// E. Interest-rate NaN guard
// ---------------------------------------------------------------------------

test('E: a zero/invalid transient interest rate cannot produce NaN/Infinity', () => {
  for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = calculateMortgage({ homePrice: 300000, downPaymentPercent: 20, interestRate: rate, loanTerm: 30 })
    for (const v of [r.monthlyPayment, r.totalPayment, r.totalInterest]) {
      assert.ok(Number.isFinite(v), `rate ${rate} produced a non-finite value`)
    }
  }
  assert.doesNotMatch(html, /NaN|Infinity/)
})

// ---------------------------------------------------------------------------
// F. Calculation correctness
// ---------------------------------------------------------------------------

test('F: known amortization case and totals', () => {
  const r = calculateMortgage({ homePrice: 300000, downPaymentPercent: 20, interestRate: 6.5, loanTerm: 30 })
  const expectedMonthly = monthlyPaymentFor(240000, 6.5, 30)
  assert.ok(Math.abs(r.monthlyPayment - expectedMonthly) < 1e-6)
  assert.ok(Math.abs(r.totalPayment - expectedMonthly * 360) < 1e-6)
  assert.ok(Math.abs(r.totalInterest - (expectedMonthly * 360 - 240000)) < 1e-6)
  assert.ok(Math.abs(r.interestShare + r.principalShare - 100) < 1e-9)
  // The rendered monthly payment matches the formula.
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(expectedMonthly)
  assert.match(html, new RegExp(formatted.replace('$', '\\$')))
})

test('F: a shorter term raises the monthly payment', () => {
  const short = calculateMortgage({ homePrice: 300000, downPaymentPercent: 20, interestRate: 6.5, loanTerm: 15 })
  const long = calculateMortgage({ homePrice: 300000, downPaymentPercent: 20, interestRate: 6.5, loanTerm: 30 })
  assert.ok(short.monthlyPayment > long.monthlyPayment)
  assert.ok(short.totalInterest < long.totalInterest)
})

test('F: the Payment Summary hides the customer-facing Total interest row', () => {
  // The dollar row was removed from the rendered summary...
  assert.doesNotMatch(html, /Total interest/)
  // ...but the underlying calculation still exposes totalInterest and the
  // interest share is still shown in the payment composition bar.
  const r = calculateMortgage({ homePrice: 300000, downPaymentPercent: 20, interestRate: 6.5, loanTerm: 30 })
  assert.ok(Number.isFinite(r.totalInterest) && r.totalInterest > 0)
  assert.ok(Number.isFinite(r.interestShare))
  assert.match(html, /Interest \d+%/)
})

// ---------------------------------------------------------------------------
// G. Accessibility
// ---------------------------------------------------------------------------

test('G: numeric inputs and sliders have accessible names', () => {
  for (const id of ['homePrice', 'downPayment', 'interestRate']) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} input id`)
    assert.match(html, new RegExp(`for="${id}"`), `${id} label association`)
  }
  assert.match(html, /aria-label="Home price"/)
  assert.match(html, /aria-label="Down payment percentage"/)
  assert.match(html, /aria-label="Interest rate"/)
})

test('G: the loan-term group is semantically grouped and Other reveals a labelled input', () => {
  assert.match(html, /role="group"/)
  assert.match(html, /aria-labelledby="loanTermLabel"/)
  assert.match(html, /id="loanTermLabel"/)
  // The custom-term field only appears when "Other" is selected (not by default).
  assert.doesNotMatch(html, /id="customLoanTerm"/)
  // The conditional field is fully wired (label, described-by error, alert).
  assert.match(source, /htmlFor="customLoanTerm"/)
  assert.match(source, /id="customLoanTerm"/)
  assert.match(source, /aria-describedby=\{customTermInvalid \? 'customLoanTermError' : undefined\}/)
  assert.match(source, /id="customLoanTermError" role="alert"/)
  assert.match(source, /aria-invalid=\{customTermInvalid\}/)
})

// ---------------------------------------------------------------------------
// Range alignment with marketing copy
// ---------------------------------------------------------------------------

test('home price range aligns with the advertised $100k–$5M', () => {
  assert.equal(MIN_HOME_PRICE, 100000)
  assert.equal(MAX_HOME_PRICE, 5000000)
})
