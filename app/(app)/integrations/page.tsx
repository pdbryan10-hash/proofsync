import { Info, Download, Upload, Search, RefreshCw, FileCheck, Bell, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TestConnectionButton } from '@/components/integrations/test-connection-button';
import { PollNowButton } from '@/components/integrations/poll-now-button';
import { ProofSyncLogo } from '@/components/brand/proofsync-logo';
import { prisma } from '@/lib/db/prisma';
import { getIntegrationMode } from '@/lib/config';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const JOBLOGIC_CAPS = [
  { icon: Download, label: 'Retrieve jobs' },
  { icon: FileCheck, label: 'Read completion information' },
  { icon: Download, label: 'Retrieve documents' },
  { icon: Bell, label: 'Receive completion events' },
  { icon: Clock, label: 'Detect completed jobs (30-min poll)' },
];
const CONCERTO_CAPS = [
  { icon: Search, label: 'Locate job by unique reference' },
  { icon: Upload, label: 'Update job fields' },
  { icon: Upload, label: 'Upload documents' },
  { icon: RefreshCw, label: 'Update workflow status' },
  { icon: FileCheck, label: 'Verify completed update' },
];

export default async function IntegrationsPage() {
  const connections = await prisma.integrationConnection.findMany();
  const joblogic = connections.find((c) => c.provider === 'JOBLOGIC');
  const concerto = connections.find((c) => c.provider === 'CONCERTO');
  const mode = getIntegrationMode();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-800">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connections between your job-management system and the client&apos;s CAFM platform.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <IntegrationCard
          name="Joblogic"
          role="Source system"
          status={joblogic?.status ?? 'NOT_CONFIGURED'}
          mode={mode}
          lastTest={joblogic?.lastConnectionTestAt ?? null}
          capabilities={JOBLOGIC_CAPS}
          provider="joblogic"
        />
        <IntegrationCard
          name="Concerto"
          role="Target system"
          status={concerto?.status ?? 'NOT_CONFIGURED'}
          mode={mode}
          lastTest={concerto?.lastConnectionTestAt ?? null}
          capabilities={CONCERTO_CAPS}
          provider="concerto"
        />
      </div>

      {/* Automated completion polling */}
      <Card>
        <CardHeader className="flex-row items-start justify-between border-b border-border">
          <div>
            <CardTitle className="flex items-center gap-2"><Clock className="size-4" />Automated completion polling</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Safety net alongside webhooks — catches jobs even if a completion event is missed.
            </p>
          </div>
          <Badge tone="success" dot>Every 30 minutes</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="text-sm text-muted-foreground">
            <p>
              A scheduled job runs every 30 minutes, detects Joblogic jobs marked complete since the last run, and
              feeds each one into the matching Concerto record. Processing is idempotent, so a job is never updated
              twice. Runs on Vercel Cron in production (<span className="font-mono text-xs">*/30 * * * *</span>).
            </p>
          </div>
          <PollNowButton />
        </CardContent>
      </Card>

      <Card className="border-info-soft bg-info-soft/30">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info-text">
            <Info className="size-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-navy-800">Live API connection required for production</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This demonstration currently uses representative integration adapters. Production deployment requires
              authorised API access and field mapping for the specific Concerto environment. See the integration
              checklist for everything required from the contractor and the client before go-live.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-center gap-6 rounded-lg border border-border bg-card p-6 sm:flex-row">
        <ProofSyncLogo />
        <div className="hidden h-10 w-px bg-border sm:block" />
        <p className="max-w-md text-center text-xs text-muted-foreground sm:text-left">
          ProofSync is a ProofWorks product. Deterministic operational automation, designed to work with any
          job-management and CAFM pairing — API or not.
        </p>
      </div>
    </div>
  );
}

function IntegrationCard({
  name,
  role,
  status,
  mode,
  lastTest,
  capabilities,
  provider,
}: {
  name: string;
  role: string;
  status: string;
  mode: 'mock' | 'live';
  lastTest: Date | null;
  capabilities: { icon: typeof Info; label: string }[];
  provider: 'joblogic' | 'concerto';
}) {
  const connected = status === 'CONNECTED';
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between border-b border-border">
        <div>
          <CardTitle className="text-base">{name}</CardTitle>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
        <Badge tone={connected ? 'success' : 'warning'} dot>
          {connected ? 'Connected' : status.replace(/_/g, ' ')}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mode</p>
            <p className="font-medium text-navy-800">{mode === 'live' ? 'Live' : 'Demo / Mock'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last connection test</p>
            <p className="font-medium text-navy-800">{timeAgo(lastTest)}</p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Capabilities</p>
          <ul className="space-y-1.5">
            {capabilities.map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.label} className="flex items-center gap-2 text-sm text-navy-800">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {c.label}
                </li>
              );
            })}
          </ul>
        </div>
        <TestConnectionButton provider={provider} />
      </CardContent>
    </Card>
  );
}
