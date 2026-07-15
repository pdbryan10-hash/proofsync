import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  Clock,
  TriangleAlert,
  Gauge,
  ArrowRight,
  PlugZap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SyncActivityChart } from '@/components/dashboard/sync-activity-chart';
import { WorkflowStrip } from '@/components/dashboard/workflow-strip';
import { RunStatusBadge } from '@/components/ui/status-badge';
import { getDashboardMetrics, getSyncActivity, getRecentSyncs } from '@/lib/services/metrics';
import { prisma } from '@/lib/db/prisma';
import { timeAgo, formatTime, formatDuration } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

async function getIntegrationHealth() {
  const connections = await prisma.integrationConnection.findMany();
  const joblogic = connections.find((c) => c.provider === 'JOBLOGIC');
  const concerto = connections.find((c) => c.provider === 'CONCERTO');
  const lastSync = connections
    .map((c) => c.lastSuccessfulSyncAt)
    .filter(Boolean)
    .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];
  return { joblogic, concerto, lastSync: lastSync ?? null };
}

export default async function DashboardPage() {
  const [metrics, activity, recent, health] = await Promise.all([
    getDashboardMetrics(),
    getSyncActivity(14),
    getRecentSyncs(8),
    getIntegrationHealth(),
  ]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="overflow-hidden rounded-xl border border-navy-900/30 bg-navy-800 text-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] lg:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">SEE CAFM Sync</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight lg:text-4xl">
              Complete once.
              <br />
              Sync automatically.
              <br />
              <span className="text-white/70">Review only the exceptions.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70">
              Automatically transfer completed job information, attendance data and certificates from Joblogic
              back into the correct Concerto job — without administrators re-keying the same information twice.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/jobs">
                <Button variant="success" size="lg">
                  View live sync
                  <ArrowRight />
                </Button>
              </Link>
              <Link href="/exceptions">
                <Button variant="outline" size="lg" className="border-white/25 bg-transparent text-white hover:bg-white/10">
                  View exceptions
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-full rounded-lg bg-white/5 p-5 ring-1 ring-white/10">
              <p className="text-xs font-medium uppercase tracking-wide text-white/50">Time returned to the team</p>
              <p className="mt-2 text-4xl font-bold">{metrics.monthHoursSaved} hrs</p>
              <p className="text-sm text-white/60">removed this month</p>
              <div className="mt-4 border-t border-white/10 pt-4 text-sm text-white/70">
                Equivalent to <span className="font-semibold text-white">{metrics.monthWorkingDaysReturned} working days</span> returned.
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                Estimate based on {metrics.estimatedMinutesPerJob} minutes of duplicated admin per completed job.
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-navy-900/40 px-6 py-4 lg:px-8">
          <WorkflowStrip />
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Jobs processed today" value={metrics.jobsProcessedToday} icon={Activity} tone="navy" />
        <KpiCard label="Successfully synced" value={metrics.successfullySynced} icon={CheckCircle2} tone="success" />
        <KpiCard label="Admin hours saved" value={metrics.adminHoursSavedToday} sublabel="today (estimated)" icon={Clock} tone="info" />
        <KpiCard label="Open exceptions" value={metrics.openExceptions} icon={TriangleAlert} tone={metrics.openExceptions > 0 ? 'warning' : 'success'} />
        <KpiCard label="Success rate" value={`${metrics.successRatePct}%`} sublabel="today" icon={Gauge} tone="navy" />
      </section>

      {/* Chart + health */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sync activity — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <SyncActivityChart data={activity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integration health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <HealthRow name="Joblogic" status={health.joblogic?.status ?? 'NOT_CONFIGURED'} mode={health.joblogic?.environment ?? 'mock'} />
            <HealthRow name="Concerto" status={health.concerto?.status ?? 'NOT_CONFIGURED'} mode={health.concerto?.environment ?? 'mock'} />
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last successful sync</p>
              <p className="mt-1 font-semibold text-navy-800">{timeAgo(health.lastSync)}</p>
            </div>
            <Link href="/integrations">
              <Button variant="outline" size="sm" className="w-full">
                <PlugZap />
                Manage integrations
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Recent activity */}
      <section>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <Link href="/jobs" className="text-xs font-medium text-info-text hover:underline">
              View all jobs
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Concerto ref</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatTime(r.time)}</TableCell>
                    <TableCell className="font-mono text-xs font-medium text-navy-800">{r.concertoReference ?? '—'}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.site}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{r.jobDescription}</TableCell>
                    <TableCell><RunStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDuration(r.durationMs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function HealthRow({ name, status, mode }: { name: string; status: string; mode: string }) {
  const connected = status === 'CONNECTED';
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <div className="flex items-center gap-2.5">
        <span className={`size-2.5 rounded-full ${connected ? 'bg-success' : 'bg-warning'}`} />
        <div>
          <p className="text-sm font-semibold text-navy-800">{name}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{mode === 'live' ? 'Live' : 'Demo / Mock'}</p>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{connected ? 'Connected' : status}</span>
    </div>
  );
}
