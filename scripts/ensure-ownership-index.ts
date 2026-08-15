import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) throw new Error('DATABASE_URL is required')

const script = `
const targetDb = db.getSiblingDB(db.getName());
if (!targetDb.getCollectionNames().includes('brokers')) targetDb.createCollection('brokers');
const brokers = targetDb.brokers;
const duplicates = brokers.aggregate([
  { $match: { userId: { $exists: true, $ne: null } } },
  { $group: { _id: '$userId', count: { $sum: 1 }, brokers: { $push: { id: '$_id', profileSlug: '$profileSlug' } } } },
  { $match: { count: { $gt: 1 } } }
]).toArray();
if (duplicates.length > 0) {
  throw new Error('Duplicate ownership detected: ' + EJSON.stringify(duplicates));
}
const replacementName = 'brokers_userId_non_null_unique';
const isOwnerIndex = (index) => index.key && Object.keys(index.key).length === 1 && index.key.userId === 1;
const isReplacement = (index) => isOwnerIndex(index) && index.name === replacementName && index.unique === true && index.partialFilterExpression && index.partialFilterExpression.userId && index.partialFilterExpression.userId.$type === 'objectId';
let indexes = brokers.getIndexes();
let replacement = indexes.find(isReplacement);
const staleOwnershipIndexes = indexes.filter((index) => isOwnerIndex(index) && index.name !== '_id_' && !isReplacement(index));
const sameNameStaleIndex = staleOwnershipIndexes.find((index) => index.name === replacementName);
if (sameNameStaleIndex) brokers.dropIndex(sameNameStaleIndex.name);
if (!replacement) {
  brokers.createIndex(
    { userId: 1 },
    { name: replacementName, unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
  );
}
indexes = brokers.getIndexes();
replacement = indexes.find(isReplacement);
if (!replacement) throw new Error('Ownership replacement index was not created or verified');
const staleAfterReplacement = indexes.filter((index) => isOwnerIndex(index) && index.name !== '_id_' && !isReplacement(index));
for (const stale of staleAfterReplacement) brokers.dropIndex(stale.name);
indexes = brokers.getIndexes();
if (indexes.some((index) => isOwnerIndex(index) && !isReplacement(index))) throw new Error('Stale ownership index remains after remediation');
const changed = sameNameStaleIndex || staleAfterReplacement.length > 0;
const removedIndexes = staleAfterReplacement.map((index) => index.name);
if (sameNameStaleIndex && !removedIndexes.includes(sameNameStaleIndex.name)) removedIndexes.unshift(sameNameStaleIndex.name);
printjson({ database: db.getName(), replacementIndex: replacementName, removedIndexes, duplicateOwnerGroups: 0, changed: Boolean(changed), status: changed ? 'reconciled' : 'healthy' });
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
