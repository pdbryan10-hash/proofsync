/** Human labels for Concerto target fields, shared across UI and audit. */
export const TARGET_FIELD_LABELS: Record<string, string> = {
  contractorCompletionNotes: 'Completion notes',
  workCompletionDescription: 'Work completed',
  actualLabourDuration: 'Time on site',
  actualArrivalTime: 'Arrival time',
  actualDepartureTime: 'Departure time',
  actualCompletionDate: 'Completion date',
  contractorCost: 'Contractor cost',
  followOnRequired: 'Follow-on work',
};

export function targetFieldLabel(field: string): string {
  return TARGET_FIELD_LABELS[field] ?? field;
}

export const TRANSFORMATION_LABELS: Record<string, string> = {
  DIRECT: 'Direct',
  DATE_FORMAT: 'Date format',
  DATETIME_FORMAT: 'Date & time',
  MINUTES_TO_HOURS: 'Minutes → hours',
  NUMBER_FORMAT: 'Number format',
  CURRENCY_FORMAT: 'Currency',
  BOOLEAN_TO_TEXT: 'Boolean → text',
  STATUS_MAP: 'Status map',
  CONCATENATE: 'Concatenate',
  CUSTOM: 'Custom',
};
