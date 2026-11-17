import { screen } from 'expo-router/testing-library';

import { lockedEvents } from '@/features/event';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

const EVENT_ID = '3f0c2f6e-5b0a-4d58-9d0e-1c7f2a9b4e11';
const detailUrl = `/vehicles/${SAMPLE_VIN}/events/${EVENT_ID}`;

const open = (event: Partial<ReturnType<typeof anEvent>>) =>
  openApp(detailUrl, {
    seed: (api: FakeApi) => {
      api.state.vehicles.push(aVehicle());
      api.state.events[SAMPLE_VIN] = [anEvent({ id: EVENT_ID, ...event })];
    },
  });

/** The title and the type row can repeat a value, so a row only has to appear at least once. */
const row = async (label: string, value: string) => {
  expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(value).length).toBeGreaterThan(0);
};

beforeEach(() => lockedEvents.clear());

test('insurance shows insurer, coverage, policy and validity range', async () => {
  await open({
    type: 'INSURANCE',
    validFrom: '2026-01-10',
    validUntil: '2027-01-09',
    details: { kind: 'INSURANCE', coverage: 'CASCO', insurer: 'Allianz', policyNumber: 'P-123' },
  });
  await row(en.event.check.insurer, 'Allianz');
  await row(en.event.check.coverage, en.event.coverageValue.CASCO);
  await row(en.event.check.policyNumber, 'P-123');
  await row(en.event.check.validFrom, '2026-01-10');
  await row(en.event.check.validUntil, '2027-01-09');
});

test('rovinieta shows its duration', async () => {
  await open({ type: 'ROVINIETA', odometerKm: null, validFrom: '2026-01-10', validUntil: '2026-01-16', details: { kind: 'ROVINIETA', duration: 'SEVEN_DAYS' } });
  await row(en.event.check.duration, en.event.durationOption.SEVEN_DAYS);
  expect(screen.queryByText(en.event.odometer)).toBeNull();
});

test('itp shows station and result', async () => {
  await open({ type: 'ITP', details: { kind: 'ITP', station: 'RAR Cluj', result: 'PASSED_WITH_REMARKS' } });
  await row(en.event.check.station, 'RAR Cluj');
  await row(en.event.check.result, en.event.itpResultValue.PASSED_WITH_REMARKS);
});

test('an ITP event with legacy scan details still renders them', async () => {
  await open({ type: 'ITP', details: { kind: 'SCAN', serviceName: 'Test Station', parts: [], labor: null } });
  await row(en.event.serviceName, 'Test Station');
});

test('safety equipment shows the item', async () => {
  await open({ type: 'SAFETY_EQUIPMENT', details: { kind: 'SAFETY_EQUIPMENT', item: 'FIRE_EXTINGUISHER' } });
  await row(en.event.check.item, en.event.safetyItem.FIRE_EXTINGUISHER);
});

test('scan details show service, parts and labor', async () => {
  await open({ source: 'SCAN', details: { kind: 'SCAN', serviceName: 'Auto Service', parts: [{ name: 'Filter', qty: 2, price: 30 }], labor: 120 } });
  await row(en.event.serviceName, 'Auto Service');
  expect(screen.getByText(en.event.part('Filter', 2, 30))).toBeTruthy();
  await row(en.event.labor, '120');
});

test('custom fields appear in order and component chips are listed', async () => {
  await open({
    customFields: [
      { label: 'Zeta', value: 'one' },
      { label: 'Alpha', value: 'two' },
    ],
    components: ['BRAKES', 'ENGINE'],
  });
  await row('Zeta', 'one');
  await row('Alpha', 'two');
  const labels = screen.getAllByText(/^(Zeta|Alpha)$/).map((n) => n.props.children);
  expect(labels).toEqual(['Zeta', 'Alpha']);
  expect(screen.getByText(en.event.check.components)).toBeTruthy();
  expect(screen.getByText(en.event.component.BRAKES)).toBeTruthy();
  expect(screen.getByText(en.event.component.ENGINE)).toBeTruthy();
});

test('an event with no details and a known odometer shows the km row', async () => {
  await open({ details: null });
  await row(en.event.odometer, '84,200');
});
