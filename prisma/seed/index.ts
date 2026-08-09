import { prisma } from './helpers'
import { seedDemoData } from './seed-demo'

async function main() {
  try {
    await seedDemoData()
  } catch (error) {
    console.error('\nDemo seed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
