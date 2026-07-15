import { TransformationType } from '@/lib/domain/enums';

export interface FieldMappingLike {
  sourceField: string;
  targetField: string;
  transformationType: string;
  transformConfig?: string | null;
  required?: boolean;
}

export interface TransformResult {
  ok: boolean;
  /** Machine value written to Concerto. */
  value: unknown;
  /** Human-readable preview of the target value. */
  preview: string;
  error?: string;
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function parseConfig(config?: string | null): Record<string, unknown> {
  if (!config) return {};
  try {
    const v = JSON.parse(config);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function minutesToHoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const EMPTY: TransformResult = { ok: true, value: null, preview: '—' };

/**
 * transformField — the single, transparent mapping primitive (§11).
 *
 * Deterministic and side-effect free. Returns both the machine value (written to
 * Concerto) and a human preview (shown in the mapping UI).
 */
export function transformField(
  mapping: FieldMappingLike,
  sourceValue: unknown,
  extra: Record<string, unknown> = {},
): TransformResult {
  const type = mapping.transformationType as TransformationType;
  const config = parseConfig(mapping.transformConfig);

  const isEmpty = sourceValue === null || sourceValue === undefined || sourceValue === '';
  if (isEmpty && type !== TransformationType.CONCATENATE && type !== TransformationType.BOOLEAN_TO_TEXT) {
    return mapping.required
      ? { ok: false, value: null, preview: '—', error: `Required field "${mapping.sourceField}" is missing` }
      : EMPTY;
  }

  try {
    switch (type) {
      case TransformationType.DIRECT:
        return { ok: true, value: sourceValue, preview: String(sourceValue) };

      case TransformationType.DATE_FORMAT: {
        const preview = formatDate(String(sourceValue));
        return { ok: true, value: new Date(String(sourceValue)).toISOString(), preview };
      }

      case TransformationType.DATETIME_FORMAT: {
        const preview = formatDateTime(String(sourceValue));
        return { ok: true, value: new Date(String(sourceValue)).toISOString(), preview };
      }

      case TransformationType.MINUTES_TO_HOURS: {
        const minutes = Number(sourceValue);
        if (!Number.isFinite(minutes)) {
          return { ok: false, value: null, preview: '—', error: 'Not a number of minutes' };
        }
        const label = minutesToHoursLabel(minutes);
        // Machine value expresses decimal hours; label is the human preview.
        return { ok: true, value: Math.round((minutes / 60) * 100) / 100, preview: label };
      }

      case TransformationType.NUMBER_FORMAT: {
        const n = Number(sourceValue);
        if (!Number.isFinite(n)) return { ok: false, value: null, preview: '—', error: 'Not a number' };
        const dp = typeof config.decimals === 'number' ? config.decimals : 2;
        return { ok: true, value: n, preview: n.toFixed(dp) };
      }

      case TransformationType.CURRENCY_FORMAT: {
        const n = Number(sourceValue);
        if (!Number.isFinite(n)) return { ok: false, value: null, preview: '—', error: 'Not a number' };
        return { ok: true, value: n, preview: GBP.format(n) };
      }

      case TransformationType.BOOLEAN_TO_TEXT: {
        const truthy = sourceValue === true || sourceValue === 'true' || sourceValue === 1;
        const trueText = (config.trueText as string) ?? 'Yes';
        const falseText = (config.falseText as string) ?? 'No';
        const text = truthy ? trueText : falseText;
        return { ok: true, value: text, preview: text };
      }

      case TransformationType.STATUS_MAP: {
        const map = (config.map as Record<string, string>) ?? {};
        const mapped = map[String(sourceValue)];
        if (mapped === undefined) {
          return { ok: false, value: null, preview: String(sourceValue), error: `No status mapping for "${sourceValue}"` };
        }
        return { ok: true, value: mapped, preview: mapped };
      }

      case TransformationType.CONCATENATE: {
        const template = (config.template as string) ?? '{value}';
        const merged: Record<string, unknown> = { value: sourceValue ?? '', ...extra };
        const out = template.replace(/\{(\w+)\}/g, (_, k: string) =>
          merged[k] !== undefined && merged[k] !== null ? String(merged[k]) : '',
        );
        return { ok: true, value: out, preview: out };
      }

      case TransformationType.CUSTOM:
      default:
        // CUSTOM transforms are intentionally explicit: default to DIRECT and
        // flag that a bespoke rule must be implemented for production.
        return { ok: true, value: sourceValue, preview: String(sourceValue) };
    }
  } catch (err) {
    return {
      ok: false,
      value: null,
      preview: '—',
      error: err instanceof Error ? err.message : 'Transform failed',
    };
  }
}
