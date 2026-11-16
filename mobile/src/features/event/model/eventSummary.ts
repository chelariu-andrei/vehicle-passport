import { en } from '@/shared/i18n/en';

import type { EventForm } from './eventForm';

export type SummaryRow = { label: string; value: string; emphasis?: boolean };

/** `148200` as `148 200`. */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** The facts the user is about to put in the car's history, in the order they are checked. */
export function eventSummary(values: EventForm, documents: number): SummaryRow[] {
  const rows: SummaryRow[] = [
    { label: en.event.check.type, value: en.event.type[values.type] },
    { label: en.event.check.date, value: values.date },
    { label: en.event.check.odometer, value: en.event.check.kilometres(groupThousands(values.odometerKm)), emphasis: true },
    { label: en.event.check.cost, value: `${values.costAmount} ${values.currency}` },
  ];
  if (values.notes !== '') rows.push({ label: en.event.check.notes, value: values.notes });
  if (documents > 0) rows.push({ label: en.event.check.documents, value: en.event.check.files(documents) });
  return rows;
}
