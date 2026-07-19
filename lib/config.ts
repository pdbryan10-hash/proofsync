/**
 * Central runtime configuration. Server-only values are read from process.env;
 * nothing secret is ever exported to the client bundle.
 */

/**
 * How the connectors reach the source and target systems.
 *
 *   mock — the application's own database stands in for both systems. Cheapest;
 *          used by the seeded product tour.
 *   demo — two SEPARATE databases stand in for two SEPARATE systems, reached
 *          through a simulated login/session. Proves the pipeline end to end.
 *          See docs/DEMO.md for what this does and does not prove.
 *   live — the real provider APIs.
 */
export type IntegrationMode = 'mock' | 'demo' | 'live';

export function getIntegrationMode(): IntegrationMode {
  const raw = process.env.INTEGRATION_MODE;
  if (raw === 'live') return 'live';
  if (raw === 'demo') return 'demo';
  return 'mock';
}

export function isMockMode(): boolean {
  return getIntegrationMode() === 'mock';
}

export function isDemoMode(): boolean {
  return getIntegrationMode() === 'demo';
}

export function isLiveMode(): boolean {
  return getIntegrationMode() === 'live';
}

/**
 * True when a sync needs artificial pacing to be legible to someone watching.
 *
 * Only the transports with no real latency of their own: a mock or a direct
 * database write returns in a millisecond, and seven instant stages read as a
 * fake. Excluded are live APIs — where the real latency is the truth — and the
 * browser transport, which is already visibly slow because a browser is actually
 * doing the work. Padding that would be inventing delay on top of real delay.
 */
export function usesSimulatedTransport(): boolean {
  if (isLiveMode()) return false;
  // Deferred require-style import: lib/demo owns transport, and importing it at
  // module scope here would invert the dependency between config and its demo.
  if (isDemoMode() && process.env.DEMO_TRANSPORT === 'browser') return false;
  return true;
}

/** Estimated minutes of duplicated admin removed per successfully synced job. */
export function getEstimatedManualMinutesPerJob(): number {
  const raw = Number(process.env.ESTIMATED_MANUAL_MINUTES_PER_JOB);
  // 20 min of human handling per job across the loop: ~10 to bring it in, ~10 to
  // push the completion back. One basis, every surface.
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ProofSync';
export const APP_TAGLINE = 'Powered by ProofWorks';

/**
 * Server-only provider credentials. Returned as a typed bag so live connectors
 * have a single, documented place to read from. Values are intentionally
 * allowed to be empty in mock mode.
 */
export function getJoblogicCredentials() {
  return {
    baseUrl: process.env.JOBLOGIC_API_BASE_URL ?? '',
    apiKey: process.env.JOBLOGIC_API_KEY ?? '',
    tenantId: process.env.JOBLOGIC_TENANT_ID ?? '',
    webhookSecret: process.env.JOBLOGIC_WEBHOOK_SECRET ?? '',
  };
}

export function getConcertoCredentials() {
  return {
    baseUrl: process.env.CONCERTO_API_BASE_URL ?? '',
    apiKey: process.env.CONCERTO_API_KEY ?? '',
    clientId: process.env.CONCERTO_CLIENT_ID ?? '',
    clientSecret: process.env.CONCERTO_CLIENT_SECRET ?? '',
  };
}
