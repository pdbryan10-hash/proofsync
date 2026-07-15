import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SeverityBadge, ExceptionStatusBadge } from '@/components/ui/status-badge';
import { ExceptionActions } from '@/components/exceptions/exception-actions';
import { prisma } from '@/lib/db/prisma';
import { cn, timeAgo } from '@/lib/utils';
import { EXCEPTION_TYPE_LABEL } from '@/lib/domain/enums';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_REVIEW', label: 'In review' },
  { key: 'RETRYING', label: 'Retrying' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'ALL', label: 'All' },
];

export default async function ExceptionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'OPEN' } = await searchParams;

  const [exceptions, counts] = await Promise.all([
    prisma.exception.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: { job: true },
    }),
    prisma.exception.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countByStatus: Record<string, number> = {};
  let all = 0;
  for (const c of counts) {
    countByStatus[c.status] = c._count._all;
    all += c._count._all;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-800">Exceptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The system never fails silently. Anything that needs human judgement lands here — resolve it and retry.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = f.key === 'ALL' ? all : countByStatus[f.key] ?? 0;
          const active = status === f.key;
          return (
            <Link
              key={f.key}
              href={`/exceptions?status=${f.key}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'border-navy-800 bg-navy-800 text-white' : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
              <span className={cn('rounded px-1.5 text-xs', active ? 'bg-white/20' : 'bg-muted')}>{count}</span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Concerto ref</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No exceptions in this view. {status === 'OPEN' && 'Everything is syncing cleanly.'}
                  </TableCell>
                </TableRow>
              )}
              {exceptions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><SeverityBadge severity={e.severity} /></TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/jobs/${e.jobId}`} className="font-mono text-xs font-medium text-navy-800 hover:underline">
                      {e.job.joblogicJobId}
                    </Link>
                    <p className="max-w-[160px] truncate text-xs text-muted-foreground">{e.job.siteName}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.job.concertoJobReference ?? <span className="text-danger-text">— missing —</span>}</TableCell>
                  <TableCell className="max-w-[280px]">
                    <p className="font-medium text-navy-800">{EXCEPTION_TYPE_LABEL[e.type as keyof typeof EXCEPTION_TYPE_LABEL] ?? e.type}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.description}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{timeAgo(e.createdAt)}</TableCell>
                  <TableCell><ExceptionStatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <ExceptionActions
                        exceptionId={e.id}
                        jobId={e.jobId}
                        type={e.type}
                        status={e.status}
                        concertoJobReference={e.job.concertoJobReference}
                      />
                    </div>
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
