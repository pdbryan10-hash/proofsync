import { IntegrationAuthenticationError } from '@/lib/errors/integration-errors';
import { sourceUsers, targetUsers } from './mongo';
import {
  DEMO_SOURCE_LOGIN,
  DEMO_TARGET_LOGIN,
  DEMO_SESSION_TTL_MS,
} from './config';

/**
 * Simulated user-session transport.
 *
 * WHAT THIS IS
 * ------------
 * Where a vendor exposes no API, ProofSync's only route in is the one a human
 * has: log in, read the screen, type into the screen. This module models that
 * ACCESS PATTERN — authenticate with a username and password, hold a session
 * token, have it expire, re-authenticate transparently — and then reads and
 * writes the stand-in system's database directly.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is NOT browser automation, and it does NOT prove that logging into the real
 * Joblogic or Concerto UI works. The session lifecycle here is real; the
 * transport underneath it is a database call, not a rendered page.
 *
 * Everything above this file — the connectors, the sync engine, the ledger — is
 * production ProofSync code and is unaware of the difference. That is the point:
 * replacing this module with a Playwright-backed driver that genuinely fills the
 * login form and reads the DOM changes nothing above it. `SystemSession` is the
 * seam where that swap happens.
 *
 * Do not let a demo built on this module be described as proving login-based
 * access to a real system. It proves the pipeline, not the door.
 */

export type DemoSystem = 'JOBLOGIC' | 'CONCERTO';

export interface SystemSession {
  system: DemoSystem;
  token: string;
  username: string;
  displayName: string;
  issuedAt: Date;
  expiresAt: Date;
  /** How the session was obtained — surfaced in the demo UI so nobody overclaims. */
  transport: 'simulated';
}

type SessionCache = { demoSessions?: Map<DemoSystem, SystemSession> };
const cache = globalThis as unknown as SessionCache;

function sessions(): Map<DemoSystem, SystemSession> {
  if (!cache.demoSessions) cache.demoSessions = new Map();
  return cache.demoSessions;
}

function mintToken(system: DemoSystem): string {
  // Opaque, session-shaped, and worthless — it authorises nothing.
  const rand = Math.random().toString(36).slice(2, 10);
  return `${system.toLowerCase()}-sess-${Date.now().toString(36)}-${rand}`;
}

function isExpired(session: SystemSession): boolean {
  return session.expiresAt.getTime() <= Date.now();
}

/**
 * Authenticate against a stand-in system. Wrong credentials raise the same
 * error a live connector would, so the engine's API_AUTHENTICATION_FAILED path
 * is exercised by the demo rather than assumed to work.
 */
export async function authenticate(system: DemoSystem): Promise<SystemSession> {
  const creds = system === 'JOBLOGIC' ? DEMO_SOURCE_LOGIN : DEMO_TARGET_LOGIN;
  const users = system === 'JOBLOGIC' ? await sourceUsers() : await targetUsers();

  const user = await users.findOne({ username: creds.username });
  if (!user || user.password !== creds.password) {
    throw new IntegrationAuthenticationError(
      `${system} rejected the sign-in for ${creds.username}.`,
    );
  }

  await users.updateOne({ username: creds.username }, { $set: { lastLoginAt: new Date() } });

  const now = new Date();
  const session: SystemSession = {
    system,
    token: mintToken(system),
    username: user.username,
    displayName: user.displayName,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + DEMO_SESSION_TTL_MS),
    transport: 'simulated',
  };
  sessions().set(system, session);
  return session;
}

/**
 * Return a valid session, signing in only when there isn't one or it has
 * expired — the same "keep the session warm, re-login when it drops" behaviour a
 * screen-driven connector needs.
 */
export async function getSession(system: DemoSystem): Promise<SystemSession> {
  const existing = sessions().get(system);
  if (existing && !isExpired(existing)) return existing;
  return authenticate(system);
}

/**
 * Run work under a live session, re-authenticating once if the session is
 * rejected mid-flight. A single retry only: a genuine credential failure must
 * surface as an exception, not spin.
 */
export async function withSession<T>(
  system: DemoSystem,
  fn: (session: SystemSession) => Promise<T>,
): Promise<T> {
  const session = await getSession(system);
  try {
    return await fn(session);
  } catch (error) {
    if (error instanceof IntegrationAuthenticationError) {
      sessions().delete(system);
      const fresh = await authenticate(system);
      return fn(fresh);
    }
    throw error;
  }
}

/** Current session state, for the demo console's connection strip. */
export function peekSession(system: DemoSystem): SystemSession | null {
  const s = sessions().get(system);
  if (!s || isExpired(s)) return null;
  return s;
}

export function clearSessions(): void {
  sessions().clear();
}
