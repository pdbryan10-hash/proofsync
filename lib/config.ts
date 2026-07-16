/**
 * Central runtime configuration. Server-only values are read from process.env;
 * nothing secret is ever exported to the client bundle.
 */

export type IntegrationMode = 'mock' | 'live';

export function getIntegrationMode(): IntegrationMode {
  return process.env.INTEGRATION_MODE === 'live' ? 'live' : 'mock';
}

export function isMockMode(): boolean {
  return getIntegrationMode() === 'mock';
}

/** Estimated minutes of duplicated admin removed per successfully synced job. */
export function getEstimatedManualMinutesPerJob(): number {
  const raw = Number(process.env.ESTIMATED_MANUAL_MINUTES_PER_JOB);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ProofSync';
export const APP_TAGLINE = 'Powered by ProofWorks';
/** Named launch customer — attribution only; never the product's own identity. */
export const LAUNCH_CUSTOMER = 'SEE Services';

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
