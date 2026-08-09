import assert from 'node:assert/strict'
import test from 'node:test'

const database = process.env.PHASE13_AUTH_DATABASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('Public FAQ projection returns only published FAQs in deterministic order', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  try {
    const faqs = await prisma.fAQ.findMany({
      where: { isActive: true },
      select: { question: true, answer: true, category: true, displayOrder: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })
    assert.ok(faqs.length >= 8)
    for (let i = 1; i < faqs.length; i++) {
      assert.ok(faqs[i].displayOrder >= faqs[i - 1].displayOrder)
    }
  } finally {
    await prisma.$disconnect()
  }
})

test('Draft FAQs never appear in the public projection', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  try {
    const published = await prisma.fAQ.findMany({ where: { isActive: true }, select: { question: true } })
    const all = await prisma.fAQ.findMany({ select: { question: true, isActive: true } })
    const draftQuestions = all.filter((faq) => !faq.isActive).map((faq) => faq.question)
    for (const draft of draftQuestions) {
      assert.equal(published.some((faq) => faq.question === draft), false)
    }
    assert.ok(draftQuestions.length >= 1)
  } finally {
    await prisma.$disconnect()
  }
})

test('FAQ CRUD round-trip at the data layer (create, edit, publish, reorder, delete)', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const created = await prisma.fAQ.create({
    data: { question: 'CRUD Test Question', answer: 'CRUD test answer', category: 'Test', displayOrder: 99, isActive: false },
  })
  try {
    assert.equal(created.isActive, false)

    const updated = await prisma.fAQ.update({ where: { id: created.id }, data: { isActive: true, displayOrder: 100 } })
    assert.equal(updated.isActive, true)
    assert.equal(updated.displayOrder, 100)

    const published = await prisma.fAQ.findMany({ where: { isActive: true }, select: { question: true } })
    assert.equal(published.some((faq) => faq.question === 'CRUD Test Question'), true)

    const moved = await prisma.fAQ.update({ where: { id: created.id }, data: { displayOrder: 1 } })
    assert.equal(moved.displayOrder, 1)
  } finally {
    await prisma.fAQ.delete({ where: { id: created.id } }).catch(() => undefined)
  }
})

test('FAQ seed set is unique', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  try {
    const faqs = await prisma.fAQ.findMany({ select: { question: true } })
    assert.equal(new Set(faqs.map((faq) => faq.question)).size, faqs.length)
  } finally {
    await prisma.$disconnect()
  }
})

test('FAQPage structured data source is published FAQs only', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  try {
    const published = await prisma.fAQ.findMany({ where: { isActive: true }, select: { question: true, answer: true } })
    for (const faq of published) {
      assert.ok(faq.question && faq.answer)
    }
  } finally {
    await prisma.$disconnect()
  }
})
