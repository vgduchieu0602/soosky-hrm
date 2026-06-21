/* eslint-disable no-console */
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
import { connectDB, disconnectDB } from '@core/database/mongoose';

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
    console.log('Re-run with --yes to confirm:  pnpm seed:clear -- --yes');
    process.exit(0);
  }

  await connectDB();
  try {
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
