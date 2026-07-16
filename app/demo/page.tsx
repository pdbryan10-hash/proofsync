import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';
import { DemoConsole } from '@/components/demo/demo-console';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ProofSync — live sync console',
  description:
    'Watch completed jobs move from a contractor job-management system into a client CAFM, in real time.',
  // A working demo of an unreleased product has no business in search results.
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  // 404 rather than a notice: a disabled demo should look like it was never here.
  if (!isDemoEnabled() || getIntegrationMode() === 'live') notFound();
  return <DemoConsole />;
}
