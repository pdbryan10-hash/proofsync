import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import type { Collection } from 'mongodb';
import { getSourceDb, getTargetDb, sourceUsers, targetUsers } from '@/lib/demo/mongo';

/**
 * Login for the two stand-in systems.
 *
 * These are the FAKE systems' own logins, not ProofSync's. Joblogic and Concerto
 * each have their own users, their own cookie and their own session store in
 * their own database — because that is what makes them two systems rather than
 * two routes.
 *
 * The session handling here is ordinary and real: a credential check, an opaque
 * token, an httpOnly cookie, a server-side session row with an expiry. It is
 * deliberately unremarkable. The point is not that this login is clever; it is
 * that it is a genuine login, so a browser has to actually get through it.
 *
 * SECURITY NOTE: passwords are compared in plaintext and the seeded credentials
 * are public (lib/demo/config.ts). That is correct for a stand-in guarding
 * fabricated data, and would be indefensible anywhere else. Nothing real is
 * behind these doors.
 */

export type SystemId = 'joblogic' | 'concerto';

export const SESSION_COOKIE: Record<SystemId, string> = {
  joblogic: 'jl_session',
  concerto: 'con_session',
};

const SESSION_TTL_MS = 30 * 60_000;

export interface SystemSessionDoc {
  token: string;
  username: string;
  displayName: string;
  expiresAt: Date;
  createdAt: Date;
}

async function sessionStore(system: SystemId): Promise<Collection<SystemSessionDoc>> {
  const db = system === 'joblogic' ? await getSourceDb() : await getTargetDb();
  return db.collection<SystemSessionDoc>('sessions');
}

export interface SignInResult {
  ok: boolean;
  token?: string;
  displayName?: string;
  error?: string;
}

/** Verify credentials and open a session. */
export async function signIn(
  system: SystemId,
  username: string,
  password: string,
): Promise<SignInResult> {
  const users = system === 'joblogic' ? await sourceUsers() : await targetUsers();
  const user = await users.findOne({ username: username.trim() });

  // One message for both failure modes — a stand-in system still shouldn't teach
  // a caller which half of the credential was wrong.
  if (!user || user.password !== password) {
    return { ok: false, error: 'Those details were not recognised.' };
  }

  const token = randomBytes(24).toString('hex');
  const store = await sessionStore(system);
  await store.insertOne({
    token,
    username: user.username,
    displayName: user.displayName,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    createdAt: new Date(),
  });
  await users.updateOne({ username: user.username }, { $set: { lastLoginAt: new Date() } });

  return { ok: true, token, displayName: user.displayName };
}

/** Resolve the caller's session from their cookie, or null. */
export async function currentUser(
  system: SystemId,
): Promise<{ username: string; displayName: string } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE[system])?.value;
  if (!token) return null;

  const store = await sessionStore(system);
  const session = await store.findOne({ token });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await store.deleteOne({ token });
    return null;
  }
  return { username: session.username, displayName: session.displayName };
}

export async function signOut(system: SystemId): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE[system])?.value;
  if (!token) return;
  const store = await sessionStore(system);
  await store.deleteOne({ token });
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
