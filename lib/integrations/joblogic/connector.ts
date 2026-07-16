import type { JoblogicConnector } from '@/lib/integrations/types';
import { getIntegrationMode } from '@/lib/config';
import { isBrowserTransport } from '@/lib/demo/config';
import { MockJoblogicConnector } from './mock';
import { DemoJoblogicConnector } from './demo';
import { BrowserJoblogicConnector } from './browser';
import { LiveJoblogicConnector } from './live';

/**
 * Factory for the Joblogic connector. All provider-specific logic lives in the
 * implementations; the rest of the app depends only on the `JoblogicConnector`
 * interface — which is what lets the demo swap the entire access method, from a
 * database read to a browser reading the screen, without the engine noticing.
 */
export function createJoblogicConnector(): JoblogicConnector {
  switch (getIntegrationMode()) {
    case 'live':
      return new LiveJoblogicConnector();
    case 'demo':
      return isBrowserTransport() ? new BrowserJoblogicConnector() : new DemoJoblogicConnector();
    default:
      return new MockJoblogicConnector();
  }
}

export type { JoblogicConnector };
