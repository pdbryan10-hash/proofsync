import { notFound } from 'next/navigation';
import { isDemoEnabled } from '@/lib/demo/config';
import { getIntegrationMode } from '@/lib/config';

/**
 * The two stand-in systems' own web UIs.
 *
 * These pages exist so the browser transport has a real screen to drive: a real
 * login form, a real job list rendered from a real database, a real completion
 * form that really saves. Nothing here is part of ProofSync — they are the
 * systems ProofSync integrates WITH, stood up so the integration can be proved
 * without a vendor account.
 *
 * They are labelled Joblogic and Concerto and look like plausible FM software,
 * but they are not imitations of either vendor's actual product. Naming the
 * systems you integrate with is ordinary; shipping a copy of someone's UI is not.
 */
export const dynamic = 'force-dynamic';

export default function SystemsLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoEnabled() || getIntegrationMode() === 'live') notFound();
  return <>{children}</>;
}
