import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  Clock,
  TriangleAlert,
  Gauge,
  ArrowRight,
  Play,
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
      {/* Header */}
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">ProofSync · dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-800 lg:text-3xl">Dashboard</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Everything the live sync just did — jobs moved into Concerto, time returned to the team, and
            anything set aside for a person. Drill into any of it below.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/jobs">
              <Button variant="success" size="sm">
                Explore all jobs
                <ArrowRight />
              </Button>
            </Link>
            <Link href="/exceptions">
              <Button variant="outline" size="sm">Review exceptions</Button>
            </Link>
            <Link href="/demo">
              <Button variant="ghost" size="sm">
                <Play className="fill-current" />
                Watch the live sync
              </Button>
            </Link>
          </div>
        </div>

        <div className="w-full rounded-xl border border-success-soft bg-gradient-to-br from-emerald-50 to-teal-50 p-5 lg:max-w-xs">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time returned to the team</p>
          <p className="mt-2 text-4xl font-bold text-success-text">{metrics.monthHoursSaved} hrs</p>
          <p className="text-sm text-muted-foreground">this month</p>
          <div className="mt-3 border-t border-success-soft pt-3 text-sm text-navy-800">
            ≈ <span className="font-semibold">{metrics.monthWorkingDaysReturned} working days</span> returned.
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Estimate: {metrics.estimatedMinutesPerJob} min of duplicated admin per completed job.
          </p>
        </div>
      </section>

      <WorkflowStrip />

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

      {/* Big closing CTA — book a call */}
      <section className="overflow-hidden rounded-2xl border border-success-soft bg-gradient-to-br from-navy-800 to-navy-900 px-6 py-10 text-center lg:px-10 lg:py-14">
        <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
          See this running on your own data.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70 lg:text-base">
          One client, one job type, your real systems — we&rsquo;ll prove the round trip before you
          commit.
        </p>
        <div className="mt-7 flex justify-center">
          <Link href="/book">
            <Button variant="success" size="lg" className="px-8 text-base">
              Book a 15-minute call
              <ArrowRight />
            </Button>
          </Link>
        </div>
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
