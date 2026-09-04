/* eslint-disable @typescript-eslint/no-explicit-any */
// Idempotent reconciliation for the About Page CMS.
//
// SAFE: creates the singleton AboutPage row and its default dynamic stats /
// benefit cards ONLY when they do not already exist. It never overwrites or
// deletes admin-edited content — running it again on an existing page is a
// no-op.
//
// Run: npm run db:reconcile-about-page
import prisma from '@/lib/prisma'
import { ABOUT_PAGE_ID, seedAboutPage } from '@/lib/about/about'

async function run() {
  const page = await seedAboutPage()
  const stats = await prisma.aboutStat.count({ where: { aboutPageId: ABOUT_PAGE_ID } })
  const benefits = await prisma.aboutBenefit.count({ where: { aboutPageId: ABOUT_PAGE_ID } })
  console.log(
    `About page reconciled (id=${page.id}). stats=${stats} benefits=${benefits}`,
  )
  await prisma.$disconnect()
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
