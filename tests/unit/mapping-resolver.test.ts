import { describe, it, expect } from 'vitest';
import { resolvePlannedChanges, buildUpdatePayload, categoryForSourceField, type SourceCompletion } from '@/lib/sync/mapping-resolver';

const completion: SourceCompletion = {
  arrivalTime: null,
  departureTime: null,
  timeOnSiteMinutes: 127,
  workCompleted: 'Replaced battery pack',
  engineerNotes: 'All tested',
  labourCost: 100,
  materialsCost: 20,
  totalCost: 120,
  followOnWorkRequired: false,
  followOnWorkNotes: null,
  completedAt: '2026-07-14T15:42:00.000Z',
};

const mappings = [
  { sourceField: 'engineerNotes', targetField: 'contractorCompletionNotes', transformationType: 'DIRECT' },
  { sourceField: 'timeOnSiteMinutes', targetField: 'actualLabourDuration', transformationType: 'MINUTES_TO_HOURS' },
  { sourceField: 'totalCost', targetField: 'contractorCost', transformationType: 'CURRENCY_FORMAT' },
];

describe('categoryForSourceField', () => {
  it('classifies fields by policy category', () => {
    expect(categoryForSourceField('engineerNotes')).toBe('completionNotes');
    expect(categoryForSourceField('timeOnSiteMinutes')).toBe('times');
    expect(categoryForSourceField('totalCost')).toBe('costs');
  });
});

describe('resolvePlannedChanges', () => {
  it('marks blank-target fields as WILL_UPDATE and excludes costs when policy is off', () => {
    const changes = resolvePlannedChanges({
      mappings,
      completion,
      policy: { syncCompletionNotes: true, syncTimes: true, syncCosts: false, syncMaterials: false },
      targetFields: {},
    });
    const byField = Object.fromEntries(changes.map((c) => [c.targetField, c.status]));
    expect(byField.contractorCompletionNotes).toBe('WILL_UPDATE');
    expect(byField.actualLabourDuration).toBe('WILL_UPDATE');
    expect(byField.contractorCost).toBe('EXCLUDED_BY_RULE');
  });

  it('marks an identical target as ALREADY_MATCHES', () => {
    const changes = resolvePlannedChanges({
      mappings,
      completion,
      policy: { syncCompletionNotes: true, syncTimes: true, syncCosts: true, syncMaterials: true },
      targetFields: { contractorCompletionNotes: 'All tested' },
    });
    const notes = changes.find((c) => c.targetField === 'contractorCompletionNotes');
    expect(notes?.status).toBe('ALREADY_MATCHES');
  });

  it('buildUpdatePayload only includes WILL_UPDATE fields', () => {
    const changes = resolvePlannedChanges({
      mappings,
      completion,
      policy: { syncCompletionNotes: true, syncTimes: true, syncCosts: false, syncMaterials: false },
      targetFields: {},
    });
    const payload = buildUpdatePayload(changes);
    expect(payload).toHaveProperty('contractorCompletionNotes');
    expect(payload).toHaveProperty('actualLabourDuration');
    expect(payload).not.toHaveProperty('contractorCost');
  });
});
