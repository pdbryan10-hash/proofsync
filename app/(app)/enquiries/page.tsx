import { Inbox, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/db/prisma';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

/** Ranks values by frequency — the demand signal. */
function tally(lists: string[][]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const list of lists) {
    for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function EnquiriesPage() {
  const enquiries = await prisma.enquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });

  const targetDemand = tally(enquiries.map((e) => parseList(e.targetSystems)));
  const sourceDemand = tally(enquiries.map((e) => parseList(e.sourceSystems)));
  const maxTarget = targetDemand[0]?.count ?? 1;
  const others = enquiries.map((e) => e.otherSystems).filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-800">Enquiries &amp; demand signal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every enquiry is a validation datapoint. This is which client systems the market is actually
          re-keying into — the evidence that ranks the connector roadmap.
        </p>
      </div>

      {enquiries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-4 font-medium text-navy-800">No enquiries yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Submissions from the sales page land here, with the systems they named.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* THE signal */}
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  Client systems most asked for
                </CardTitle>
                <CardDescription>Ranked by how many contractors named them. Build order, evidenced.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {targetDemand.length === 0 && <p className="text-sm text-muted-foreground">No systems named yet.</p>}
                {targetDemand.map((t) => (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm font-medium text-navy-800">{t.name}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-navy-800"
                        style={{ width: `${Math.max(6, (t.count / maxTarget) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-sm text-muted-foreground">{t.count}</span>
                  </div>
                ))}
                {others.length > 0 && (
                  <div className="mt-4 rounded-md bg-muted p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Named as &ldquo;other&rdquo; — platforms not on our list
                    </p>
                    <p className="mt-1 text-sm text-navy-800">{others.join(' · ')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Source systems</CardTitle>
                <CardDescription>What they complete jobs in.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {sourceDemand.length === 0 && <p className="text-sm text-muted-foreground">None named yet.</p>}
                {sourceDemand.map((s) => (
                  <Badge key={s.name} tone="navy">
                    {s.name} · {s.count}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* The people */}
          <Card>
            <CardHeader>
              <CardTitle>Who bit ({enquiries.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Re-keying into</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enquiries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {timeAgo(e.createdAt)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-navy-800">{e.name}</p>
                        <a href={`mailto:${e.email}`} className="text-xs text-info-text hover:underline">
                          {e.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">{e.company ?? '—'}</TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="flex flex-wrap gap-1">
                          {parseList(e.targetSystems).map((t) => (
                            <Badge key={t} tone="info">{t}</Badge>
                          ))}
                          {e.otherSystems && <Badge tone="warning">{e.otherSystems}</Badge>}
                          {parseList(e.targetSystems).length === 0 && !e.otherSystems && (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="flex flex-wrap gap-1">
                          {parseList(e.sourceSystems).map((s) => (
                            <Badge key={s} tone="neutral">{s}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {e.jobsPerMonth ?? '—'}
                      </TableCell>
                      <TableCell><Badge tone={e.status === 'NEW' ? 'success' : 'neutral'}>{e.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
