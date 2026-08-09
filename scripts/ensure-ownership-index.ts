import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) throw new Error('DATABASE_URL is required')

const script = `
const brokers = db.getSiblingDB(db.getName()).brokers;
const duplicates = brokers.aggregate([
  { $match: { userId: { $exists: true, $ne: null } } },
  { $group: { _id: '$userId', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]).toArray();
if (duplicates.length > 0) {
  throw new Error('Cannot remediate ownership index: duplicate non-null owner groups found: ' + duplicates.length);
}
const replacementName = 'brokers_userId_non_null_unique';
const isOwnerIndex = (index) => index.key && Object.keys(index.key).length === 1 && index.key.userId === 1;
const isReplacement = (index) => isOwnerIndex(index) && index.name === replacementName && index.unique === true && index.partialFilterExpression && index.partialFilterExpression.userId && index.partialFilterExpression.userId.$type === 'objectId';
let indexes = brokers.getIndexes();
let replacement = indexes.find(isReplacement);
const oldIndex = indexes.find((index) => isOwnerIndex(index) && index.unique === true && !index.partialFilterExpression);
if (!replacement) {
  brokers.createIndex(
    { userId: 1 },
    { name: replacementName, unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
  );
}
indexes = brokers.getIndexes();
replacement = indexes.find(isReplacement);
if (!replacement) throw new Error('Ownership replacement index was not created or verified');
if (oldIndex && oldIndex.name !== replacementName) brokers.dropIndex(oldIndex.name);
indexes = brokers.getIndexes();
if (indexes.some((index) => isOwnerIndex(index) && index.unique === true && !index.partialFilterExpression)) throw new Error('Normal ownership index remains after remediation');
printjson({ database: db.getName(), replacementIndex: replacementName, oldIndex: oldIndex ? oldIndex.name : null, duplicateOwnerGroups: 0, status: 'reconciled' });
`

async function main() {
  try {
    const result = await execFileAsync('mongosh', ['--quiet', databaseUrl, '--eval', script])
    process.stdout.write(result.stdout)
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : ''
    throw new Error(stderr || (error instanceof Error ? error.message : 'Ownership index reconciliation failed'))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
