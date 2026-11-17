import { anEvent } from '../../../../test/fake-api';
import { COMPONENT_CONFIG, COMPONENTS } from './components';
import { EVENT_TYPE_CONFIG, EVENT_TYPES, eventSubtitle, eventTitle, type EventType } from './eventTypes';

const ALL_TYPES: EventType[] = ['SERVICE', 'REPAIR', 'TIRES', 'ITP', 'ROVINIETA', 'INSURANCE', 'SAFETY_EQUIPMENT', 'OTHER'];
const ALL_COMPONENTS = [
  'ENGINE',
  'TRANSMISSION',
  'BRAKES',
  'SUSPENSION',
  'STEERING',
  'TIRES_WHEELS',
  'ELECTRICAL',
  'CLIMATE',
  'BODY',
  'EXHAUST',
  'INTERIOR',
  'FLUIDS',
  'OTHER',
] as const;

test('every event type has a config, in display order', () => {
  expect([...EVENT_TYPES]).toEqual(ALL_TYPES);
  for (const type of ALL_TYPES) {
    const config = EVENT_TYPE_CONFIG[type];
    expect(config).toBeDefined();
    expect(config.label()).not.toBe('');
  }
});

test('the rules of each type mirror the domain table', () => {
  expect(EVENT_TYPE_CONFIG.SERVICE).toMatchObject({ odometer: 'required', validity: 'none', details: null, customLabel: false });
  expect(EVENT_TYPE_CONFIG.ITP).toMatchObject({ odometer: 'required', validity: 'untilOptional', details: 'ITP' });
  expect(EVENT_TYPE_CONFIG.ROVINIETA).toMatchObject({ odometer: 'optional', validity: 'computed', details: 'ROVINIETA' });
  expect(EVENT_TYPE_CONFIG.INSURANCE).toMatchObject({ odometer: 'optional', validity: 'range', details: 'INSURANCE' });
  expect(EVENT_TYPE_CONFIG.SAFETY_EQUIPMENT).toMatchObject({ validity: 'untilRequired', details: 'SAFETY_EQUIPMENT' });
  expect(EVENT_TYPE_CONFIG.OTHER).toMatchObject({ odometer: 'optional', validity: 'none', customLabel: true });
});

test('default components and document hints', () => {
  expect(EVENT_TYPE_CONFIG.TIRES.defaultComponents).toEqual(['TIRES_WHEELS']);
  for (const type of ALL_TYPES.filter((t) => t !== 'TIRES')) expect(EVENT_TYPE_CONFIG[type].defaultComponents).toEqual([]);
  expect(EVENT_TYPE_CONFIG.INSURANCE.documentHint?.()).toBe('Attach the policy (photo or PDF)');
  expect(EVENT_TYPE_CONFIG.ITP.documentHint?.()).toBe('Attach the inspection report');
  expect(EVENT_TYPE_CONFIG.ROVINIETA.documentHint?.()).toBe('Attach the receipt');
  expect(EVENT_TYPE_CONFIG.SAFETY_EQUIPMENT.documentHint?.()).toBe('Attach the receipt or a photo of the label');
  for (const type of ['SERVICE', 'REPAIR', 'TIRES', 'OTHER'] as const) expect(EVENT_TYPE_CONFIG[type].documentHint).toBeNull();
});

test('every component has an icon and a label', () => {
  expect([...COMPONENTS]).toEqual([...ALL_COMPONENTS]);
  for (const component of ALL_COMPONENTS) {
    expect(COMPONENT_CONFIG[component].icon).toBeTruthy();
    expect(COMPONENT_CONFIG[component].label()).not.toBe('');
  }
});

describe('eventTitle', () => {
  test('OTHER shows its custom label', () => {
    expect(eventTitle(anEvent({ type: 'OTHER', customLabel: 'Ceramic coating' }))).toBe('Ceramic coating');
  });
  test('a scan shows the service name, else the label of the type', () => {
    expect(eventTitle(anEvent({ details: { kind: 'SCAN', serviceName: 'Oil change' } }))).toBe('Oil change');
    expect(eventTitle(anEvent({ type: 'TIRES', details: null }))).toBe('Tires');
    expect(eventTitle(anEvent({ details: { kind: 'SCAN', serviceName: null } }))).toBe('Service');
  });
  test('insurance shows coverage and insurer', () => {
    expect(eventTitle(anEvent({ type: 'INSURANCE', details: { kind: 'INSURANCE', coverage: 'RCA', insurer: 'Allianz' } }))).toBe('RCA · Allianz');
  });
  test('safety equipment shows the item', () => {
    expect(eventTitle(anEvent({ type: 'SAFETY_EQUIPMENT', details: { kind: 'SAFETY_EQUIPMENT', item: 'FIRE_EXTINGUISHER' } }))).toBe('Fire extinguisher');
    expect(eventTitle(anEvent({ type: 'SAFETY_EQUIPMENT', details: { kind: 'SAFETY_EQUIPMENT', item: 'FIRST_AID_KIT' } }))).toBe('First-aid kit');
  });
  test('a repair shows the label of its type', () => {
    expect(eventTitle(anEvent({ type: 'REPAIR', details: null }))).toBe('Repair');
  });
});

describe('eventSubtitle', () => {
  test('kilometres, then cost', () => {
    expect(eventSubtitle(anEvent({ odometerKm: 98400, costAmount: 450, currency: 'RON' }))).toBe('98 400 km · 450 RON');
    expect(eventSubtitle(anEvent({ odometerKm: 900, costAmount: 149.5, currency: 'EUR' }))).toBe('900 km · 149.5 EUR');
  });
  test('kilometres are omitted when null', () => {
    expect(eventSubtitle(anEvent({ type: 'OTHER', customLabel: 'x', odometerKm: null, costAmount: 80, currency: 'RON' }))).toBe('80 RON');
  });
  test('validity types show the end date, then cost', () => {
    expect(eventSubtitle(anEvent({ type: 'INSURANCE', odometerKm: null, validUntil: '2027-03-12', costAmount: 1250, currency: 'RON' }))).toBe(
      'until 12 Mar 2027 · 1 250 RON',
    );
  });
  test('a validity type without an end date falls back to the odometer line', () => {
    expect(eventSubtitle(anEvent({ type: 'ITP', odometerKm: 1000, validUntil: null, costAmount: 100, currency: 'RON' }))).toBe('1 000 km · 100 RON');
  });
});
