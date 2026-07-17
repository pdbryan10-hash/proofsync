import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, User, Calendar, Wrench, FileText, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  SyncStatusBadge,
  PlannedChangeBadge,
  RunStatusBadge,
  TransferStatusBadge,
} from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { SyncPanel } from '@/components/sync/sync-panel';
import { SyncTimeline } from '@/components/sync/sync-timeline';
import { getJobDetail } from '@/lib/services/jobs';
import { getJobSyncPreview } from '@/lib/sync/preview';
import { getEstimatedManualMinutesPerJob } from '@/lib/config';
import { targetFieldLabel, TRANSFORMATION_LABELS } from '@/lib/domain/field-labels';
import { formatDateTime, formatBytes, formatDuration } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, preview] = await Promise.all([getJobDetail(id), getJobSyncPreview(id)]);
  if (!job) notFound();

  const latestRun = job.syncRuns[0];
  const changes = preview?.changes ?? [];
  const visibleChanges = changes.filter((c) => c.status !== 'ALREADY_MATCHES' || c.currentTargetValue != null);

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy-800">
        <ArrowLeft className="size-4" />
        Back to jobs
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HeaderField label="Concerto reference" value={job.concertoJobReference ?? '— missing —'} mono highlight={!job.concertoJobReference} />
              <HeaderField label="Joblogic ID" value={job.joblogicJobId} mono />
              <HeaderField label="Site" value={job.siteName} />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sync status</p>
                <div className="mt-1"><SyncStatusBadge status={job.syncStatus} /></div>
              </div>
            </div>
          </div>
          <p className="mt-4 border-t border-border pt-4 text-sm font-medium text-navy-800">{job.jobDescription}</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{job.siteAddress}</span>
            <span className="inline-flex items-center gap-1.5"><User className="size-3.5" />{job.engineerName ?? 'Unassigned'}</span>
            {job.assetReference && <span className="inline-flex items-center gap-1.5"><Wrench className="size-3.5" />{job.assetReference}</span>}
            <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" />Completed {formatDateTime(job.completedAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Open exceptions banner */}
      {job.exceptions.some((e) => ['OPEN', 'IN_REVIEW', 'RETRYING'].includes(e.status)) && (
        <Card className="border-warning-soft bg-warning-soft/30">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-warning-text">{job.exceptions[0]!.title}</p>
              <p className="text-sm text-navy-800">{job.exceptions[0]!.description}</p>
            </div>
            <Link href="/exceptions" className="shrink-0 text-sm font-medium text-warning-text hover:underline">
              Resolve on Exceptions →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Sync action */}
      <Card>
        <CardHeader>
          <CardTitle>Sync to Concerto</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncPanel
            jobId={job.id}
            concertoReference={job.concertoJobReference}
            syncStatus={job.syncStatus}
            estimatedMinutesPerJob={getEstimatedManualMinutesPerJob()}
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mapping">Field mapping</TabsTrigger>
          <TabsTrigger value="documents">Documents ({job.documents.length})</TabsTrigger>
          <TabsTrigger value="history">Sync history ({job.syncRuns.length})</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b border-border bg-muted/40">
                <CardTitle className="flex items-center gap-2"><FileText className="size-4" />Joblogic — source (now)</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {visibleChanges.map((c) => (
                  <div key={`src-${c.targetField}`} className="px-5 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{targetFieldLabel(c.targetField)}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-navy-800">{c.sourcePreview}</p>
                      {c.transformationType !== 'DIRECT' && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {TRANSFORMATION_LABELS[c.transformationType] ?? c.transformationType}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="border-b border-border bg-muted/40">
                <CardTitle className="flex items-center gap-2"><ArrowRight className="size-4" />Concerto — target</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {visibleChanges.map((c) => (
                  <div key={`tgt-${c.targetField}`} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{targetFieldLabel(c.targetField)}</p>
                      <p className={`mt-0.5 truncate text-sm ${c.currentTargetValue == null ? 'italic text-muted-foreground' : 'text-navy-800'}`}>
                        {c.currentTargetValue == null ? 'Currently blank' : c.currentTargetPreview}
                      </p>
                    </div>
                    {c.transformationType !== 'DIRECT' &&
                    c.status === 'ALREADY_MATCHES' &&
                    c.sourcePreview !== c.currentTargetPreview ? (
                      <Badge tone="success" className="shrink-0 whitespace-nowrap">Matched · converted</Badge>
                    ) : (
                      <PlannedChangeBadge status={c.status} />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          {!preview?.targetFound && job.concertoJobReference && (
            <p className="mt-4 text-sm text-danger-text">
              No Concerto target found for {job.concertoJobReference}. The comparison above shows source values only.
            </p>
          )}
        </TabsContent>

        {/* FIELD MAPPING */}
        <TabsContent value="mapping">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Joblogic field</TableHead>
                    <TableHead>Transformation</TableHead>
                    <TableHead>Concerto field</TableHead>
                    <TableHead>Source value</TableHead>
                    <TableHead>Target preview</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map((c) => (
                    <TableRow key={c.targetField}>
                      <TableCell className="font-mono text-xs text-navy-800">{c.sourceField}</TableCell>
                      <TableCell><Badge tone="neutral">{TRANSFORMATION_LABELS[c.transformationType] ?? c.transformationType}</Badge></TableCell>
                      <TableCell className="font-mono text-xs text-navy-800">{c.targetField}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{c.sourcePreview}</TableCell>
                      <TableCell className="max-w-[220px] truncate font-medium">{c.targetPreview}</TableCell>
                      <TableCell><PlannedChangeBadge status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Fields excluded by rule reflect this client&apos;s sync policy (e.g. costs off). Adjust under Settings → Mappings.
          </p>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source → Target</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Transfer status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.documents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No documents on this job.</TableCell>
                    </TableRow>
                  )}
                  {job.documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="flex items-center gap-2 font-medium text-navy-800">
                        <FileText className="size-4 text-muted-foreground" />{d.filename}
                      </TableCell>
                      <TableCell><Badge tone="neutral">{d.documentType.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">Joblogic <ArrowRight className="inline size-3" /> Concerto</TableCell>
                      <TableCell className="text-muted-foreground">{formatBytes(d.sizeBytes)}</TableCell>
                      <TableCell><TransferStatusBadge status={d.transferStatus} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SYNC HISTORY */}
        <TabsContent value="history">
          {job.syncRuns.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">This job has not been synced yet.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {job.syncRuns.map((run) => (
                <Card key={run.id}>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border">
                    <div className="flex items-center gap-3">
                      <RunStatusBadge status={run.status} />
                      <span className="text-xs text-muted-foreground">
                        Attempt {run.attemptNumber} · {run.triggerType.toLowerCase()} · {formatDateTime(run.startedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{run.fieldsUpdated} fields</span>
                      <span>{run.documentsTransferred} docs</span>
                      <span>{formatDuration(run.durationMs)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <SyncTimeline events={run.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {latestRun?.status === 'EXCEPTION' && (
        <p className="text-center text-xs text-muted-foreground">
          Latest attempt raised an exception — see the Exceptions page to review and retry.
        </p>
      )}
    </div>
  );
}

function HeaderField({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? 'text-danger-text' : 'text-navy-800'} ${mono ? 'font-mono text-base' : ''}`}>{value}</p>
    </div>
  );
}
