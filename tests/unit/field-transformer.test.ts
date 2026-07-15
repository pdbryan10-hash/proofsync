import { describe, it, expect } from 'vitest';
import { transformField, minutesToHoursLabel } from '@/lib/sync/field-transformer';

describe('minutesToHoursLabel', () => {
  it('formats hours and minutes', () => {
    expect(minutesToHoursLabel(127)).toBe('2h 7m');
    expect(minutesToHoursLabel(60)).toBe('1h');
    expect(minutesToHoursLabel(45)).toBe('45m');
    expect(minutesToHoursLabel(0)).toBe('0m');
  });
});

describe('transformField', () => {
  it('DIRECT passes the value through', () => {
    const r = transformField({ sourceField: 'notes', targetField: 'n', transformationType: 'DIRECT' }, 'Replaced battery');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('Replaced battery');
  });

  it('MINUTES_TO_HOURS previews h/m and stores decimal hours', () => {
    const r = transformField({ sourceField: 't', targetField: 'd', transformationType: 'MINUTES_TO_HOURS' }, 127);
    expect(r.ok).toBe(true);
    expect(r.preview).toBe('2h 7m');
    expect(r.value).toBeCloseTo(2.12, 2);
  });

  it('CURRENCY_FORMAT formats GBP', () => {
    const r = transformField({ sourceField: 'c', targetField: 'x', transformationType: 'CURRENCY_FORMAT' }, 160.5);
    expect(r.preview).toContain('160.50');
  });

  it('BOOLEAN_TO_TEXT uses configured text', () => {
    const r = transformField(
      { sourceField: 'f', targetField: 'x', transformationType: 'BOOLEAN_TO_TEXT', transformConfig: JSON.stringify({ trueText: 'Yes', falseText: 'No' }) },
      false,
    );
    expect(r.value).toBe('No');
  });

  it('STATUS_MAP maps known values and flags unknown', () => {
    const mapping = { sourceField: 's', targetField: 'x', transformationType: 'STATUS_MAP', transformConfig: JSON.stringify({ map: { Complete: 'Completed' } }) };
    expect(transformField(mapping, 'Complete').value).toBe('Completed');
    const unknown = transformField(mapping, 'Weird');
    expect(unknown.ok).toBe(false);
  });

  it('flags a required field that is missing', () => {
    const r = transformField({ sourceField: 'x', targetField: 'y', transformationType: 'DIRECT', required: true }, null);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('treats an optional missing field as empty (ok, no value)', () => {
    const r = transformField({ sourceField: 'x', targetField: 'y', transformationType: 'DIRECT' }, null);
    expect(r.ok).toBe(true);
    expect(r.value).toBeNull();
  });

  it('CONCATENATE interpolates a template', () => {
    const r = transformField(
      { sourceField: 'w', targetField: 'x', transformationType: 'CONCATENATE', transformConfig: JSON.stringify({ template: '{value} — by {engineerName}' }) },
      'Works done',
      { engineerName: 'Mark Taylor' },
    );
    expect(r.value).toBe('Works done — by Mark Taylor');
  });
});
