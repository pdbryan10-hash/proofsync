import { transformField, type FieldMappingLike } from './field-transformer';

/**
 * Turns Joblogic completion data + field mappings + client policy into a set of
 * planned Concerto changes. This is the SINGLE source of truth used by both:
 *   - the Job Detail "Field Mapping" / "Overview" tabs (preview, no writes), and
 *   - JobCompletionSyncService (execution).
 * so what the operator previews is exactly what the engine applies.
 */

export type PlannedChangeStatus =
  | 'WILL_UPDATE'
  | 'ALREADY_MATCHES'
  | 'EXCLUDED_BY_RULE'
  | 'NEEDS_REVIEW';

export interface PlannedChange {
  sourceField: string;
  targetField: string;
  transformationType: string;
  required: boolean;
  category: PolicyCategory;
  sourceValue: unknown;
  sourcePreview: string;
  machineValue: unknown;
  targetPreview: string;
  currentTargetValue: unknown;
  currentTargetPreview: string;
  status: PlannedChangeStatus;
  error?: string;
}

export type PolicyCategory =
  | 'completionNotes'
  | 'times'
  | 'costs'
  | 'materials'
  | 'other';

export interface ClientPolicy {
  syncCompletionNotes: boolean;
  syncTimes: boolean;
  syncCosts: boolean;
  syncMaterials: boolean;
}

export interface SourceCompletion {
  arrivalTime: string | null;
  departureTime: string | null;
  timeOnSiteMinutes: number | null;
  workCompleted: string | null;
  engineerNotes: string | null;
  labourCost: number | null;
  materialsCost: number | null;
  totalCost: number | null;
  followOnWorkRequired: boolean;
  followOnWorkNotes: string | null;
  completedAt: string | null;
}

/** Maps a Joblogic source field to the client-policy category that governs it. */
export function categoryForSourceField(sourceField: string): PolicyCategory {
  switch (sourceField) {
    case 'engineerNotes':
    case 'workCompleted':
    case 'followOnWorkNotes':
    case 'followOnWorkRequired':
    case 'completedAt':
      return 'completionNotes';
    case 'arrivalTime':
    case 'departureTime':
    case 'timeOnSiteMinutes':
      return 'times';
    case 'labourCost':
    case 'totalCost':
      return 'costs';
    case 'materialsCost':
      return 'materials';
    default:
      return 'other';
  }
}

function policyAllows(category: PolicyCategory, policy: ClientPolicy): boolean {
  switch (category) {
    case 'completionNotes':
      return policy.syncCompletionNotes;
    case 'times':
      return policy.syncTimes;
    case 'costs':
      return policy.syncCosts;
    case 'materials':
      return policy.syncMaterials;
    case 'other':
      return true;
  }
}

function readSourceValue(field: string, c: SourceCompletion): unknown {
  return (c as unknown as Record<string, unknown>)[field] ?? null;
}

function previewOf(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function resolvePlannedChanges(params: {
  mappings: (FieldMappingLike & { active?: boolean })[];
  completion: SourceCompletion;
  policy: ClientPolicy;
  targetFields: Record<string, unknown> | null;
  extra?: Record<string, unknown>;
}): PlannedChange[] {
  const { mappings, completion, policy, targetFields, extra } = params;

  return mappings
    .filter((m) => m.active !== false)
    .map((mapping) => {
      const category = categoryForSourceField(mapping.sourceField);
      const sourceValue = readSourceValue(mapping.sourceField, completion);
      const currentTargetValue = targetFields ? targetFields[mapping.targetField] ?? null : null;
      const result = transformField(mapping, sourceValue, extra);

      const base = {
        sourceField: mapping.sourceField,
        targetField: mapping.targetField,
        transformationType: mapping.transformationType,
        required: !!mapping.required,
        category,
        sourceValue,
        sourcePreview: previewOf(sourceValue),
        machineValue: result.value,
        targetPreview: result.preview,
        currentTargetValue,
        currentTargetPreview: previewOf(currentTargetValue),
      };

      if (!policyAllows(category, policy)) {
        return { ...base, status: 'EXCLUDED_BY_RULE' as const };
      }
      if (!result.ok) {
        return { ...base, status: 'NEEDS_REVIEW' as const, error: result.error };
      }
      if (result.value === null || result.value === undefined) {
        // Nothing to write (blank, non-required source).
        return { ...base, status: 'ALREADY_MATCHES' as const };
      }
      const matches = JSON.stringify(result.value) === JSON.stringify(currentTargetValue);
      return { ...base, status: matches ? ('ALREADY_MATCHES' as const) : ('WILL_UPDATE' as const) };
    });
}

/** The subset that will actually be written to Concerto. */
export function buildUpdatePayload(changes: PlannedChange[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const c of changes) {
    if (c.status === 'WILL_UPDATE') payload[c.targetField] = c.machineValue;
  }
  return payload;
}
