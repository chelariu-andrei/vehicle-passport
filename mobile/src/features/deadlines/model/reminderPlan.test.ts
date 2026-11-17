import type { components } from '@/shared/api/generated/schema';

import { REMINDER_CAP, reminderPlan, type PlanCar, type PlanPrefs } from './reminderPlan';

type DeadlineItem = components['schemas']['DeadlineItem'];
type DocumentKind = components['schemas']['DocumentKind'];
type DeadlineStatus = components['schemas']['DeadlineStatus'];

/** 09:00 local on a calendar day (month 1-12). */
const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min, 0);

/** 10 Jan 2027, 12:00 local. */
const NOW = at(2027, 1, 10, 12);

const ALL_ON: PlanPrefs = { documentDeadlines: true, reminderDays: [30, 7, 1], tireSeason: true };
const DOCS_ONLY: PlanPrefs = { ...ALL_ON, tireSeason: false };

function item(kind: DocumentKind, validUntil: string | null, status: DeadlineStatus = 'VALID'): DeadlineItem {
  return { kind, status, validUntil, daysLeft: null, eventId: null };
}

function car(vin: string, items: DeadlineItem[], lastTiresOn: string | null = null, carName = `Car ${vin}`): PlanCar {
  return { vin, carName, items, lastTiresOn };
}

const times = (plan: { fireAt: Date }[]) => plan.map((r) => r.fireAt.getTime());

describe('reminderPlan: documents', () => {
  it('gives a valid RCA reminders at 30, 7, 1 days and on the expiry day at 09:00', () => {
    const plan = reminderPlan([car('V1', [item('RCA', '2027-03-01')])], DOCS_ONLY, NOW);

    expect(times(plan)).toEqual(times([{ fireAt: at(2027, 1, 30) }, { fireAt: at(2027, 2, 22) }, { fireAt: at(2027, 2, 28) }, { fireAt: at(2027, 3, 1) }]));
    expect(plan.map((r) => r.title)).toEqual(['RCA expires in 30 days', 'RCA expires in 7 days', 'RCA expires in 1 day', 'RCA expires today']);
    for (const r of plan) {
      expect(r.data).toEqual({ vin: 'V1', kind: 'RCA' });
      expect(r.fireAt.getHours()).toBe(9);
      expect(r.fireAt.getMinutes()).toBe(0);
    }
  });

  it('leaves out reminder days that are not enabled but keeps the expiry day', () => {
    const plan = reminderPlan([car('V1', [item('ITP', '2027-03-01')])], { ...DOCS_ONLY, reminderDays: [7] }, NOW);
    expect(times(plan)).toEqual(times([{ fireAt: at(2027, 2, 22) }, { fireAt: at(2027, 3, 1) }]));

    const onlyExpiry = reminderPlan([car('V1', [item('ITP', '2027-03-01')])], { ...DOCS_ONLY, reminderDays: [] }, NOW);
    expect(times(onlyExpiry)).toEqual([at(2027, 3, 1).getTime()]);
    expect(onlyExpiry[0].title).toBe('ITP expires today');
  });

  it('drops a reminder moment that is already past', () => {
    const plan = reminderPlan([car('V1', [item('RCA', '2027-01-15', 'EXPIRING')])], DOCS_ONLY, NOW);
    expect(times(plan)).toEqual(times([{ fireAt: at(2027, 1, 14) }, { fireAt: at(2027, 1, 15) }]));
  });

  it('drops the expiry-day reminder when the document expires today and it is already past 09:00', () => {
    expect(reminderPlan([car('V1', [item('RCA', '2027-01-10', 'EXPIRING')])], DOCS_ONLY, NOW)).toEqual([]);
    expect(reminderPlan([car('V1', [item('RCA', '2027-01-10', 'EXPIRING')])], DOCS_ONLY, at(2027, 1, 10, 9))).toEqual([]);
  });

  it('keeps the expiry-day reminder when the document expires today and it is still before 09:00', () => {
    const plan = reminderPlan([car('V1', [item('RCA', '2027-01-10', 'EXPIRING')])], DOCS_ONLY, at(2027, 1, 10, 8, 59));
    expect(times(plan)).toEqual([at(2027, 1, 10).getTime()]);
  });

  it('gives nothing for EXPIRED, UNKNOWN and NOT_RECORDED, nor without a validUntil', () => {
    const plan = reminderPlan(
      [
        car('V1', [
          item('RCA', '2027-03-01', 'EXPIRED'),
          item('ITP', null, 'UNKNOWN'),
          item('CASCO', null, 'NOT_RECORDED'),
          item('ROVINIETA', '2027-03-01', 'NOT_RECORDED'),
          item('FIRST_AID_KIT', null, 'VALID'),
        ]),
      ],
      DOCS_ONLY,
      NOW,
    );
    expect(plan).toEqual([]);
  });

  it('gives no document reminders when documentDeadlines is off', () => {
    const plan = reminderPlan([car('V1', [item('RCA', '2027-03-01')])], { ...ALL_ON, documentDeadlines: false }, NOW);
    expect(plan.map((r) => r.data.kind)).toEqual(['TIRE_SUMMER', 'TIRE_WINTER']);
  });

  it('gives no reminder for the old date once the document is renewed', () => {
    const before = reminderPlan([car('V1', [item('RCA', '2027-02-01', 'EXPIRING')])], DOCS_ONLY, NOW);
    expect(times(before)).toContain(at(2027, 2, 1).getTime());

    const after = reminderPlan([car('V1', [item('RCA', '2028-02-01')])], DOCS_ONLY, NOW);
    expect(times(after)).not.toContain(at(2027, 2, 1).getTime());
    expect(times(after)).toEqual(times([{ fireAt: at(2028, 1, 2) }, { fireAt: at(2028, 1, 25) }, { fireAt: at(2028, 1, 31) }, { fireAt: at(2028, 2, 1) }]));
  });

  it('lands 29 Feb and 31 Dec validUntil on the right calendar date at 09:00', () => {
    const leap = reminderPlan([car('V1', [item('RCA', '2028-02-29')])], DOCS_ONLY, NOW);
    expect(times(leap)).toEqual(times([{ fireAt: at(2028, 1, 30) }, { fireAt: at(2028, 2, 22) }, { fireAt: at(2028, 2, 28) }, { fireAt: at(2028, 2, 29) }]));

    const leapCrossing = reminderPlan([car('V1', [item('RCA', '2028-03-01')])], { ...DOCS_ONLY, reminderDays: [1] }, NOW);
    expect(times(leapCrossing)).toEqual(times([{ fireAt: at(2028, 2, 29) }, { fireAt: at(2028, 3, 1) }]));

    const yearEnd = reminderPlan([car('V1', [item('ITP', '2027-12-31')])], DOCS_ONLY, NOW);
    expect(times(yearEnd)).toEqual(times([{ fireAt: at(2027, 12, 1) }, { fireAt: at(2027, 12, 24) }, { fireAt: at(2027, 12, 30) }, { fireAt: at(2027, 12, 31) }]));
    for (const r of [...leap, ...leapCrossing, ...yearEnd]) expect(r.fireAt.getHours()).toBe(9);
  });

  it('uses the car name in title and body', () => {
    const [r] = reminderPlan([car('V1', [item('CASCO', '2027-03-01')], null, 'Dacia Duster')], { ...DOCS_ONLY, reminderDays: [] }, NOW);
    expect(r.title).toBe('CASCO expires today');
    expect(r.body).toBe('Dacia Duster. Open to review.');

    const tires = reminderPlan([car('V1', [], null, 'Dacia Duster')], { ...ALL_ON, documentDeadlines: false }, NOW);
    expect(tires.map((t) => t.title)).toEqual(['Time for summer tires', 'Time for winter tires']);
    for (const t of tires) expect(t.body).toBe('Dacia Duster. Check your tires.');
  });
});

describe('reminderPlan: tire season', () => {
  const TIRES_ONLY: PlanPrefs = { ...ALL_ON, documentDeadlines: false };

  it('reminds on the next 15 Oct and the next 1 Apr at 09:00, per car', () => {
    const plan = reminderPlan([car('V1', []), car('V2', [])], TIRES_ONLY, NOW);
    expect(plan.map((r) => [r.data.vin, r.data.kind, r.fireAt.getTime()])).toEqual([
      ['V1', 'TIRE_SUMMER', at(2027, 4, 1).getTime()],
      ['V2', 'TIRE_SUMMER', at(2027, 4, 1).getTime()],
      ['V1', 'TIRE_WINTER', at(2027, 10, 15).getTime()],
      ['V2', 'TIRE_WINTER', at(2027, 10, 15).getTime()],
    ]);
  });

  it('moves to next year once the date has passed', () => {
    const plan = reminderPlan([car('V1', [])], TIRES_ONLY, at(2027, 10, 15, 10));
    expect(times(plan)).toEqual(times([{ fireAt: at(2028, 4, 1) }, { fireAt: at(2028, 10, 15) }]));
  });

  it('skips the reminder when tires were changed within the 30 days up to it, keeps it at 31 days', () => {
    const skipped = reminderPlan([car('V1', [], '2027-03-02')], TIRES_ONLY, NOW);
    expect(skipped.map((r) => r.data.kind)).toEqual(['TIRE_WINTER']);

    const onTheDay = reminderPlan([car('V1', [], '2027-04-01')], TIRES_ONLY, NOW);
    expect(onTheDay.map((r) => r.data.kind)).toEqual(['TIRE_WINTER']);

    const kept = reminderPlan([car('V1', [], '2027-03-01')], TIRES_ONLY, NOW);
    expect(kept.map((r) => r.data.kind)).toEqual(['TIRE_SUMMER', 'TIRE_WINTER']);
  });

  it('gives no tire reminders when tireSeason is off', () => {
    expect(reminderPlan([car('V1', [])], { ...TIRES_ONLY, tireSeason: false }, NOW)).toEqual([]);
  });
});

describe('reminderPlan: cap', () => {
  it('keeps the earliest 60 over 3 cars, sorted by fire time', () => {
    const kinds: DocumentKind[] = ['ITP', 'RCA', 'CASCO', 'ROVINIETA', 'FIRE_EXTINGUISHER', 'FIRST_AID_KIT'];
    const docs = (year: number) => kinds.map((k, i) => item(k, `${year}-${String(i + (year === 2027 ? 2 : 6)).padStart(2, '0')}-${year === 2027 ? 15 : '01'}`));
    const cars = [car('V1', docs(2027)), car('V2', docs(2027)), car('V3', docs(2028))];

    const plan = reminderPlan(cars, ALL_ON, NOW);

    expect(REMINDER_CAP).toBe(60);
    expect(plan).toHaveLength(60);
    const t = times(plan);
    expect(t).toEqual([...t].sort((a, b) => a - b));
    expect(plan.filter((r) => r.data.vin === 'V1')).toHaveLength(26);
    expect(plan.filter((r) => r.data.vin === 'V2')).toHaveLength(26);
    expect(plan.filter((r) => r.data.vin === 'V3')).toHaveLength(8);
    expect(plan[59].fireAt.getTime()).toBe(at(2028, 6, 24).getTime());
    expect(plan[59].data).toEqual({ vin: 'V3', kind: 'RCA' });
  });
});
