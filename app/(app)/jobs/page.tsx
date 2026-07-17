import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SyncStatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { JobsFilterBar } from '@/components/jobs/jobs-filter-bar';
import { listJobs, getJobCountsByStatus } from '@/lib/services/jobs';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; from?: string; to?: string }>;
}) {
  const { status, search, from, to } = await searchParams;
  const [jobs, counts] = await Promise.all([
    listJobs({ status, search, from, to }),
    getJobCountsByStatus(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-800">Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completed Joblogic jobs and their sync state into the matching Concerto record.
        </p>
      </div>

      <JobsFilterBar counts={counts} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concerto ref</TableHead>
                <TableHead>Joblogic ID</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Engineer</TableHead>
                <TableHead>Joblogic</TableHead>
                <TableHead>Concerto</TableHead>
                <TableHead>Sync status</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    No jobs match the current filter.
                  </TableCell>
                </TableRow>
              )}
              {jobs.map((job) => (
                <TableRow key={job.id} data-clickable="true" className="group relative">
                  <TableCell className="font-mono text-xs font-semibold text-navy-800">
                    <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0">
                      {job.concertoJobReference ?? <span className="text-danger-text">— missing —</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{job.joblogicJobId}</TableCell>
                  <TableCell className="max-w-[160px] truncate font-medium">{job.siteName}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">{job.jobDescription}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{job.engineerName ?? '—'}</TableCell>
                  <TableCell>
                    <Badge tone={job.joblogicStatus === 'Complete' ? 'success' : 'neutral'}>{job.joblogicStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge tone={job.concertoStatus === 'Completed' ? 'success' : 'info'}>{job.concertoStatus}</Badge>
                  </TableCell>
                  <TableCell><SyncStatusBadge status={job.syncStatus} /></TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{timeAgo(job.lastSyncAt)}</TableCell>
                  <TableCell className="relative">
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
