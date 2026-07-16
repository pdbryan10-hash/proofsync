import type { ConcertoConnector } from '@/lib/integrations/types';
import { getIntegrationMode } from '@/lib/config';
import { isBrowserTransport } from '@/lib/demo/config';
import { MockConcertoConnector } from './mock';
import { DemoConcertoConnector } from './demo';
import { BrowserConcertoConnector } from './browser';
import { LiveConcertoConnector } from './live';

export function createConcertoConnector(): ConcertoConnector {
  switch (getIntegrationMode()) {
    case 'live':
      return new LiveConcertoConnector();
    case 'demo':
      return isBrowserTransport() ? new BrowserConcertoConnector() : new DemoConcertoConnector();
    default:
      return new MockConcertoConnector();
  }
}

export type { ConcertoConnector };
