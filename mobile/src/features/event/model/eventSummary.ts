import { en } from '@/shared/i18n/en';

import { COMPONENT_CONFIG } from './components';
import type { EventForm } from './eventForm';
import { EVENT_TYPE_CONFIG } from './eventTypes';
import { rovinietaEnd } from './validity';

export type SummaryRow = { label: string; value: string; emphasis?: boolean };

const c = en.event.check;

/** `148200` as `148 200`. */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** The rows a type's own details add, in the order they are checked. */
function detailRows(values: EventForm): SummaryRow[] {
  const details = values.details;
  switch (details?.kind) {
    case 'INSURANCE':
      return [
        { label: c.coverage, value: en.event.coverageValue[details.coverage] },
        { label: c.insurer, value: details.insurer },
        ...(details.policyNumber ? [{ label: c.policyNumber, value: details.policyNumber }] : []),
      ];
    case 'ROVINIETA':
      return [{ label: c.duration, value: en.event.durationOption[details.duration] }];
    case 'ITP':
      return [
        ...(details.station ? [{ label: c.station, value: details.station }] : []),
        ...(details.result ? [{ label: c.result, value: en.event.itpResultValue[details.result] }] : []),
      ];
    case 'SAFETY_EQUIPMENT':
      return [{ label: c.item, value: en.event.safetyItem[details.item] }];
    default:
      return [];
  }
}

/** The facts the user is about to put in the car's history, in the order they are checked. */
export function eventSummary(values: EventForm, documents: number): SummaryRow[] {
  const config = EVENT_TYPE_CONFIG[values.type];
  const rovinietaDetails = values.details?.kind === 'ROVINIETA' ? values.details : null;
  const validUntil = rovinietaDetails && values.validFrom ? rovinietaEnd(values.validFrom, rovinietaDetails.duration) : values.validUntil;
  const rows: SummaryRow[] = [
    { label: c.type, value: config.label() },
    { label: c.date, value: values.date },
    ...(config.customLabel && values.customLabel ? [{ label: c.name, value: values.customLabel }] : []),
    ...detailRows(values),
  ];
  if (values.odometerKm !== null) rows.push({ label: c.odometer, value: c.kilometres(groupThousands(values.odometerKm)), emphasis: true });
  if (values.validFrom) rows.push({ label: c.validFrom, value: values.validFrom });
  if (validUntil) rows.push({ label: c.validUntil, value: validUntil });
  rows.push({ label: c.cost, value: `${values.costAmount} ${values.currency}` });
  if (values.components.length > 0) rows.push({ label: c.components, value: values.components.map((x) => COMPONENT_CONFIG[x].label()).join(', ') });
  for (const field of values.customFields) rows.push({ label: field.label, value: field.value });
  if (values.notes !== '') rows.push({ label: c.notes, value: values.notes });
  if (documents > 0) rows.push({ label: c.documents, value: c.files(documents) });
  return rows;
}
