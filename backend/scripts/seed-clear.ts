/**
 * Clear seeded / app data — empties every collection in the connected database
 * (keeps the collections + indexes; just removes documents). Use to reset a dev
 * environment before re-seeding.
 *
 *   pnpm seed:clear            # asks for confirmation flag
 *   pnpm seed:clear -- --yes   # actually wipes
 *
 * Refuses to run when NODE_ENV=production unless --force is also passed.
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '@infra/db/mongoose';

/**
 * Host + database of MONGO_URI. Credentials are stripped before anything is
 * printed — the connection string carries a password.
 */
function describeTarget(): string {
  const uri = process.env.MONGO_URI;
  if (!uri) return '(MONGO_URI not set)';
  const withoutCreds = uri.replace(/^mongodb(\+srv)?:\/\//, '').replace(/^[^@/]*@/, '');
  const slash = withoutCreds.indexOf('/');
  const hosts = slash === -1 ? withoutCreds.split('?')[0]! : withoutCreds.slice(0, slash);
  const db = slash === -1 ? '' : (withoutCreds.slice(slash + 1).split('?')[0] ?? '');
  return `${hosts} → database "${db || 'test (driver default — no name in URI)'}"`;
}

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes') || args.includes('-y');
  const force = args.includes('--force');

  if (process.env.NODE_ENV === 'production' && !force) {
    console.error('Refusing to clear data in production. Pass --force if you really mean it.');
    process.exit(1);
  }
  if (!yes) {
    console.log('This will DELETE ALL DOCUMENTS in every collection of the connected database.');
    console.log(`Target: ${describeTarget()}`);
    console.log('Re-run with --yes to confirm:  pnpm seed:clear -- --yes');
    process.exit(0);
  }

  await connectDB();
  try {
    // Print the target before deleting anything. MONGO_URI may point at a shared
    // cluster, and a URI without a database name resolves to the driver default
    // ("test") — which is easy to wipe by accident while believing it is local.
    const { host, name } = mongoose.connection;
    console.log(`Clearing database "${name}" on ${host}\n`);

    const collections = await mongoose.connection.db!.collections();
    if (collections.length === 0) {
      console.log('No collections found — nothing to clear.');
      return;
    }
    let total = 0;
    for (const col of collections) {
      const { deletedCount } = await col.deleteMany({});
      total += deletedCount ?? 0;
      console.log(`  cleared ${String(deletedCount).padStart(5)} ← ${col.collectionName}`);
    }
    console.log(`\nDone. Removed ${total} documents from ${collections.length} collections.`);
    console.log('Tip: run `pnpm seed` then `pnpm seed:demo` to repopulate.');
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error('Clear failed:', err);
  process.exit(1);
});
