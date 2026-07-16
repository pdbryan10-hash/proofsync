import type { JoblogicConnector } from '@/lib/integrations/types';
import { getIntegrationMode } from '@/lib/config';
import { MockJoblogicConnector } from './mock';
import { DemoJoblogicConnector } from './demo';
import { LiveJoblogicConnector } from './live';

/**
 * Factory for the Joblogic connector. All provider-specific logic lives in the
 * mock/demo/live implementations; the rest of the app depends only on the
 * `JoblogicConnector` interface — which is what lets the live-sync demo run the
 * real engine against a stand-in system without the engine knowing.
 */
export function createJoblogicConnector(): JoblogicConnector {
  switch (getIntegrationMode()) {
    case 'live':
      return new LiveJoblogicConnector();
    case 'demo':
      return new DemoJoblogicConnector();
    default:
      return new MockJoblogicConnector();
  }
}

export type { JoblogicConnector };
