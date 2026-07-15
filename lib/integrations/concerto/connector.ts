import type { ConcertoConnector } from '@/lib/integrations/types';
import { isMockMode } from '@/lib/config';
import { MockConcertoConnector } from './mock';
import { LiveConcertoConnector } from './live';

export function createConcertoConnector(): ConcertoConnector {
  return isMockMode() ? new MockConcertoConnector() : new LiveConcertoConnector();
}

export type { ConcertoConnector };
