import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db/prisma';
import { TRANSFORMATION_LABELS, targetFieldLabel } from '@/lib/domain/field-labels';
import { toggleMapping, updateClientSettings } from './actions';

export const dynamic = 'force-dynamic';

const CLIENT_SETTINGS: { key: string; label: string; help: string }[] = [
  { key: 'syncCompletionNotes', label: 'Sync completion notes', help: 'Engineer notes & work-completed description' },
  { key: 'syncTimes', label: 'Sync time on site', help: 'Arrival, departure and labour duration' },
  { key: 'syncCosts', label: 'Sync costs', help: 'Contractor / labour cost values' },
  { key: 'syncMaterials', label: 'Sync materials', help: 'Materials cost values' },
  { key: 'syncDocuments', label: 'Sync certificates & documents', help: 'Permitted document categories only' },
  { key: 'syncStatus', label: 'Update Concerto status', help: 'Move the Concerto job status forward' },
  { key: 'requireApprovalBeforeClose', label: 'Require approval before close', help: 'Never auto-close; a human confirms' },
];

export default async function MappingsSettingsPage() {
  const [client, mappings] = await Promise.all([
    prisma.client.findFirst(),
    prisma.fieldMapping.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-800">Settings — mappings & policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control which fields and documents flow from Joblogic into Concerto for {client?.name ?? 'this client'}.
        </p>
      </div>

      {/* Client sync policy */}
      {client && (
        <Card>
          <CardHeader>
            <CardTitle>Client sync policy — {client.name}</CardTitle>
            <CardDescription>These rules gate every sync. Costs are typically off unless the client permits them.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateClientSettings} className="space-y-4">
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                {CLIENT_SETTINGS.map((s) => (
                  <label key={s.key} className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      name={s.key}
                      defaultChecked={Boolean((client as unknown as Record<string, boolean>)[s.key])}
                      className="mt-0.5 size-4 accent-[#262a63]"
                    />
                    <span>
                      <span className="block text-sm font-medium text-navy-800">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.help}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">Save policy</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Field mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Field mappings</CardTitle>
          <CardDescription>Joblogic → Concerto field transforms. Enable/disable or mark required.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joblogic field</TableHead>
                <TableHead>Transformation</TableHead>
                <TableHead>Concerto field</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs text-navy-800">{m.sourceField}</TableCell>
                  <TableCell><Badge tone="neutral">{TRANSFORMATION_LABELS[m.transformationType] ?? m.transformationType}</Badge></TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-navy-800">{m.targetField}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{targetFieldLabel(m.targetField)}</span>
                  </TableCell>
                  <TableCell><ToggleForm id={m.id} field="required" value={m.required} onLabel="Required" offLabel="Optional" /></TableCell>
                  <TableCell><ToggleForm id={m.id} field="active" value={m.active} onLabel="Active" offLabel="Disabled" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/** Server-action toggle rendered as a form button (no client JS required). */
function ToggleForm({
  id,
  field,
  value,
  onLabel,
  offLabel,
}: {
  id: string;
  field: 'active' | 'required';
  value: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <form action={toggleMapping}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={(!value).toString()} />
      <button
        type="submit"
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
          value
            ? 'border-success-soft bg-success-soft text-success-text hover:opacity-80'
            : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
        }`}
      >
        <span className={`size-1.5 rounded-full ${value ? 'bg-success' : 'bg-muted-foreground'}`} />
        {value ? onLabel : offLabel}
      </button>
    </form>
  );
}
