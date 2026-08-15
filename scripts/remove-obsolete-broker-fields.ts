import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const databaseUrl = process.env.DATABASE_URL
const dryRun = process.argv.includes('--dry-run')

if (!databaseUrl) throw new Error('DATABASE_URL is required')

const script = `
const brokers = db.getSiblingDB(db.getName()).brokers;
const before = {
  serviceCities: brokers.countDocuments({ serviceCities: { $exists: true } }),
  specializations: brokers.countDocuments({ specializations: { $exists: true } }),
  languages: brokers.countDocuments({ languages: { $exists: true } }),
};
if (${dryRun ? 'true' : 'false'}) {
  printjson({ database: db.getName(), dryRun: true, before, target: 'brokers', fields: ['serviceCities', 'specializations', 'languages'] });
} else {
  const result = brokers.updateMany({}, { $unset: { serviceCities: '', specializations: '', languages: '' } });
  const after = {
    serviceCities: brokers.countDocuments({ serviceCities: { $exists: true } }),
    specializations: brokers.countDocuments({ specializations: { $exists: true } }),
    languages: brokers.countDocuments({ languages: { $exists: true } }),
  };
  printjson({ database: db.getName(), dryRun: false, before, matched: result.matchedCount, modified: result.modifiedCount, after });
}
`

async function main() {
  const result = await execFileAsync('mongosh', ['--quiet', databaseUrl, '--eval', script])
  process.stdout.write(result.stdout)
}

main().catch((error) => {
  const message = error && typeof error === 'object' && 'stderr' in error
    ? String(error.stderr)
    : error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
