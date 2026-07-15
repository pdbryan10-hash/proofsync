import type { JoblogicConnector } from '@/lib/integrations/types';
import { isMockMode } from '@/lib/config';
import { MockJoblogicConnector } from './mock';
import { LiveJoblogicConnector } from './live';

/**
 * Factory for the Joblogic connector. All provider-specific logic lives in the
 * mock/live implementations; the rest of the app depends only on the
 * `JoblogicConnector` interface.
 */
export function createJoblogicConnector(): JoblogicConnector {
  return isMockMode() ? new MockJoblogicConnector() : new LiveJoblogicConnector();
}

export type { JoblogicConnector };
