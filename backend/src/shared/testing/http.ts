/// <reference types="jest" />
/**
 * Shared harness for HTTP integration tests: real Express app (full middleware
 * chain: authenticate → guards → validate → controller) over a real
 * mongodb-memory-server replica set (transactions work). Tests issue real
 * requests via supertest and assert on responses + persisted state.
 */
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import supertest from 'supertest';
import { createExpressServer } from '@infra/server/createExpressServer';
import { Role } from '@modules/iam/adapters/persistence/models/role.model';
import { tokenService } from '@modules/auth';

export const api = supertest(createExpressServer());

const oid = () => new mongoose.Types.ObjectId();

let repl: MongoMemoryReplSet;

/** Spin up an in-memory replica set + connect mongoose. Call in beforeAll. */
export async function startDb(): Promise<void> {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
}

/** Disconnect + stop. Call in afterAll. */
export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  await repl.stop();
}

/** Wipe every collection. Call in afterEach. */
export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/** Seed the three system roles used across the app. */
export async function seedRoles(): Promise<void> {
  await Role.create([
    { name: 'admin', description: 'admin', isSystem: true },
    { name: 'hr_manager', description: 'hr', isSystem: true },
    { name: 'employee', description: 'emp', isSystem: true },
  ]);
}

/**
 * Mint a valid access token for a caller with the given roles. `userId` lets a
 * test bind the token to a specific employee's `userId` (so `selfOrHr` resolves
 * the caller's own record); defaults to a fresh id.
 */
export function tokenFor(
  roles: string[],
  opts: { userId?: string; mustChangePassword?: boolean } = {},
): { token: string; userId: string } {
  const userId = opts.userId ?? oid().toString();
  const token = tokenService.signAccess({
    userId,
    sessionId: oid().toString(),
    roles,
    permissions: [],
    mustChangePassword: opts.mustChangePassword,
  });
  return { token, userId };
}

/** `Authorization: Bearer <token>` header object for supertest `.set`. */
export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
