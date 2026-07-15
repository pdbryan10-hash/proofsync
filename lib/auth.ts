import { headers } from 'next/headers';

/**
 * Role-based access scaffold (§18).
 *
 * The MVP runs as a single-tenant demo with no login, so this is intentionally
 * permissive — but every mutating route funnels through `requireRole()`, giving
 * a single place to bolt on real authentication (Clerk / NextAuth / SSO) without
 * touching route logic. In production this would resolve the session and check
 * the user's role.
 */
export type Role = 'viewer' | 'operator' | 'admin';

export interface Principal {
  id: string;
  role: Role;
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

export async function getPrincipal(): Promise<Principal> {
  // TODO(production): resolve from the authenticated session.
  // Demo: an optional header lets you exercise role gating locally.
  const h = await headers();
  const headerRole = h.get('x-demo-role');
  const role: Role = headerRole === 'viewer' || headerRole === 'admin' ? headerRole : 'operator';
  return { id: 'demo-user', role };
}

export async function requireRole(minimum: Role): Promise<Principal> {
  const principal = await getPrincipal();
  if (ROLE_RANK[principal.role] < ROLE_RANK[minimum]) {
    throw new AccessDeniedError(minimum);
  }
  return principal;
}

export class AccessDeniedError extends Error {
  readonly status = 403;
  constructor(required: Role) {
    super(`This action requires the "${required}" role.`);
    this.name = 'AccessDeniedError';
  }
}
