import type { ConcertoConnector } from '@/lib/integrations/types';
import { getIntegrationMode } from '@/lib/config';
import { MockConcertoConnector } from './mock';
import { DemoConcertoConnector } from './demo';
import { LiveConcertoConnector } from './live';

export function createConcertoConnector(): ConcertoConnector {
  switch (getIntegrationMode()) {
    case 'live':
      return new LiveConcertoConnector();
    case 'demo':
      return new DemoConcertoConnector();
    default:
      return new MockConcertoConnector();
  }
}

export type { ConcertoConnector };
