import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import type { FakeApi, VehicleResponse } from '../fake-api';
import { aFuelEntry, aFuelStats, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

const f = en.fuelLog.form;
const newUrl = `/vehicles/${SAMPLE_VIN}/fuel/new`;
// The fuel screen is where "back" lands; a stand-in keeps these tests about the form alone.
const routes = { 'vehicles/[vin]/fuel/index': () => null };

afterEach(() => onlineManager.setOnline(true));

function seedWith(car: Partial<VehicleResponse> = {}, extra?: (api: FakeApi) => void) {
  return (api: FakeApi) => {
    api.state.vehicles.push(aVehicle(car));
    extra?.(api);
  };
}

const open = (url: string, seed: (api: FakeApi) => void) => openApp(url, { seed, routes });
const saveButton = () => screen.getByRole('button', { name: f.save });
const type = async (label: string, value: string) => fireEvent.changeText(await screen.findByLabelText(label), value);

test('the odometer is prefilled with the last known km', async () => {
  await open(newUrl, seedWith({}, (api) => (api.state.fuelStats[SAMPLE_VIN] = aFuelStats({ lastOdometerKm: 84210 }))));
  await waitFor(() => expect(screen.getByLabelText(f.odometer)).toHaveDisplayValue('84210'));
});

test('typing quantity and total shows the computed price, with a decimal comma', async () => {
  await open(newUrl, seedWith());
  await type(f.quantityLitres, '38,2');
  await type(f.totalIn('RON'), '312');
  expect(screen.getByLabelText(f.priceLitre)).toHaveDisplayValue('8.168');
  expect(screen.getByText(f.computed)).toBeTruthy();
});

test('Save is disabled until the required fields are valid', async () => {
  await open(newUrl, seedWith());
  await type(f.odometer, '84210');
  expect(saveButton()).toBeDisabled();
  await type(f.quantityLitres, '38.2');
  expect(saveButton()).toBeDisabled();
  await type(f.totalIn('RON'), '312');
  expect(saveButton()).toBeEnabled();
  await type(f.quantityLitres, '0');
  expect(saveButton()).toBeDisabled();
});

test('saving posts only quantity and total, then goes back with a toast', async () => {
  const fake = await open(newUrl, seedWith());
  await type(f.odometer, '84210');
  await type(f.quantityLitres, '38.2');
  await type(f.priceLitre, '8.17');
  await fireEvent.press(saveButton());
  await waitFor(() => expect(fake.callsTo('addFuelEntry')).toHaveLength(1));
  const body = fake.callsTo('addFuelEntry')[0].body as Record<string, unknown>;
  expect(body).toMatchObject({ odometerKm: 84210, fuelType: 'DIESEL', quantity: 38.2, total: 312.09, currency: 'RON', fullTank: true });
  expect(body).not.toHaveProperty('unitPrice');
  expect(await screen.findByText(f.saved)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname(`/vehicles/${SAMPLE_VIN}/fuel`));
});

test('the currency can be changed under More details and is what gets sent', async () => {
  const fake = await open(newUrl, seedWith());
  await type(f.odometer, '84210');
  await type(f.quantityLitres, '38.2');
  await type(f.totalIn('RON'), '312');
  await fireEvent.press(await screen.findByRole('button', { name: f.moreDetails }));
  await type(f.currency, 'eur');
  expect(screen.getByLabelText(f.totalIn('EUR'))).toBeTruthy();
  await fireEvent.press(saveButton());
  await waitFor(() => expect(fake.callsTo('addFuelEntry')).toHaveLength(1));
  expect(fake.callsTo('addFuelEntry')[0].body).toMatchObject({ currency: 'EUR' });
});

test('station and note stop at the limits the server accepts', async () => {
  await open(newUrl, seedWith());
  await fireEvent.press(await screen.findByRole('button', { name: f.moreDetails }));
  expect(await screen.findByLabelText(f.station)).toHaveProp('maxLength', 60);
  expect(screen.getByLabelText(f.note)).toHaveProp('maxLength', 200);
});

test('a fill-up that closes a full-tank segment says its consumption in the toast', async () => {
  await open(newUrl, seedWith({}, (api) => (api.state.fuel[SAMPLE_VIN] = [aFuelEntry({ date: '2026-10-01', odometerKm: 10000 })])));
  await waitFor(() => expect(screen.getByLabelText(f.odometer)).toHaveDisplayValue('10000'));
  await type(f.odometer, '10500');
  await type(f.quantityLitres, '35');
  await type(f.totalIn('RON'), '262.5');
  await fireEvent.press(saveButton());
  expect(await screen.findByText(f.savedWithConsumption('7.0 L/100 km'))).toBeTruthy();
});

test('turning Full tank off explains where consumption comes from', async () => {
  await open(newUrl, seedWith());
  expect(await screen.findByRole('switch', { name: f.fullTank })).toBeTruthy();
  expect(screen.queryByText(f.partialCaption)).toBeNull();
  await fireEvent(screen.getByRole('switch', { name: f.fullTank }), 'valueChange', false);
  expect(screen.getByText(f.partialCaption)).toBeTruthy();
});

test('a lower km is only a hint, and the server refusal shows on the km field and keeps the form', async () => {
  const fake = await open(
    newUrl,
    seedWith({}, (api) => {
      api.state.fuelStats[SAMPLE_VIN] = aFuelStats({ lastOdometerKm: 84210 });
      api.failNext('addFuelEntry', 422, 'odometer-inconsistent');
    }),
  );
  await waitFor(() => expect(screen.getByLabelText(f.odometer)).toHaveDisplayValue('84210'));
  await type(f.odometer, '84000');
  expect(screen.getByText(f.belowLast('84 210'))).toBeTruthy();
  await type(f.quantityLitres, '38.2');
  await type(f.totalIn('RON'), '312');
  expect(saveButton()).toBeEnabled();
  await fireEvent.press(saveButton());
  expect(await screen.findByText(f.odometerInconsistent)).toBeTruthy();
  expect(fake.callsTo('addFuelEntry')).toHaveLength(1);
  expect(screen).toHavePathname(newUrl);
  expect(screen.getByLabelText(f.quantityLitres)).toHaveDisplayValue('38.2');
});

test('a hybrid switches units and Grade/Charging with the fuel type, keeping the typed numbers', async () => {
  await open(newUrl, seedWith({ fuel: 'HYBRID' }));
  const electric = await screen.findByRole('button', { name: en.fuelLog.type.ELECTRIC });
  expect(screen.getByRole('button', { name: en.fuelLog.type.PETROL }).props.accessibilityState).toMatchObject({ selected: true });
  await type(f.quantityLitres, '30');
  await type(f.totalIn('RON'), '240');
  await fireEvent.press(screen.getByRole('button', { name: f.moreDetails }));
  expect(screen.getByText(en.fuelLog.grade.label)).toBeTruthy();
  await fireEvent.press(electric);
  expect(screen.getByLabelText(f.quantityKwh)).toHaveDisplayValue('30');
  expect(screen.getByLabelText(f.priceKwh)).toHaveDisplayValue('8');
  expect(screen.getByText(en.fuelLog.charge.label)).toBeTruthy();
  expect(screen.queryByText(en.fuelLog.grade.label)).toBeNull();
});

test('an OTHER car must pick the fuel before saving', async () => {
  await open(newUrl, seedWith({ fuel: 'OTHER' }));
  await type(f.odometer, '1000');
  await type(f.quantityLitres, '30');
  await type(f.totalIn('RON'), '240');
  expect(saveButton()).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: en.fuelLog.type.LPG }));
  expect(saveButton()).toBeEnabled();
});

test('an electric car shows kWh and Charging, not Grade', async () => {
  await open(newUrl, seedWith({ fuel: 'ELECTRIC' }));
  expect(await screen.findByLabelText(f.quantityKwh)).toBeTruthy();
  expect(screen.getByLabelText(f.priceKwh)).toBeTruthy();
  expect(screen.queryByRole('button', { name: en.fuelLog.type.ELECTRIC })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: f.moreDetails }));
  expect(screen.getByText(en.fuelLog.charge.label)).toBeTruthy();
  expect(screen.getByRole('button', { name: en.fuelLog.charge.DC_FAST })).toBeTruthy();
  expect(screen.queryByText(en.fuelLog.grade.label)).toBeNull();
});

test('a quantity above a sane tank asks once', async () => {
  const fake = await open(newUrl, seedWith({}, (api) => api.failNext('addFuelEntry', 422, 'odometer-inconsistent')));
  await type(f.odometer, '84210');
  await type(f.quantityLitres, '201');
  await type(f.totalIn('RON'), '1600');
  await fireEvent.press(saveButton());
  expect(await screen.findByText(f.largeTitle)).toBeTruthy();
  expect(fake.callsTo('addFuelEntry')).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: f.largeConfirm }));
  await waitFor(() => expect(fake.callsTo('addFuelEntry')).toHaveLength(1));
  expect(await screen.findByText(f.odometerInconsistent)).toBeTruthy();
  await fireEvent.press(saveButton());
  await waitFor(() => expect(fake.callsTo('addFuelEntry')).toHaveLength(2));
  expect(screen.queryByText(f.largeTitle)).toBeNull();
});

test('More details is collapsed by default, with a Today chip in the header', async () => {
  await open(newUrl, seedWith());
  const toggle = await screen.findByRole('button', { name: f.moreDetails });
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  expect(screen.queryByLabelText(f.station)).toBeNull();
  expect(screen.queryByText(f.missed)).toBeNull();
  expect(screen.getByText(f.today)).toBeTruthy();
  await fireEvent.press(toggle);
  expect(screen.getByLabelText(f.station)).toBeTruthy();
  expect(screen.getByLabelText(f.note)).toBeTruthy();
  expect(screen.getByText(f.missed)).toBeTruthy();
  expect(screen.getByText(f.date)).toBeTruthy();
});

test('the Today chip opens More details', async () => {
  await open(newUrl, seedWith());
  await fireEvent.press(await screen.findByText(f.today));
  expect(screen.getByLabelText(f.station)).toBeTruthy();
});

test('station is carried over from the last entry', async () => {
  await open(newUrl, seedWith({}, (api) => (api.state.fuel[SAMPLE_VIN] = [aFuelEntry({ station: 'Petrom' })])));
  await fireEvent.press(await screen.findByRole('button', { name: f.moreDetails }));
  await waitFor(() => expect(screen.getByLabelText(f.station)).toHaveDisplayValue('Petrom'));
});

describe('edit', () => {
  const entry = aFuelEntry({ quantity: 40, total: 300, unitPrice: 7.5, odometerKm: 12000 });
  const editUrl = `/vehicles/${SAMPLE_VIN}/fuel/${entry.id}`;
  const seed = seedWith({}, (api) => (api.state.fuel[SAMPLE_VIN] = [{ ...entry }]));

  it('loads the entry and saves it with PUT', async () => {
    const fake = await open(editUrl, seed);
    expect(await screen.findByLabelText(f.odometer)).toHaveDisplayValue('12000');
    expect(screen.getByText(en.fuelLog.edit)).toBeTruthy();
    expect(screen.getByLabelText(f.quantityLitres)).toHaveDisplayValue('40');
    expect(screen.getByLabelText(f.totalIn('RON'))).toHaveDisplayValue('300');
    expect(screen.getByLabelText(f.priceLitre)).toHaveDisplayValue('7.5');
    await type(f.totalIn('RON'), '320');
    await fireEvent.press(saveButton());
    await waitFor(() => expect(fake.callsTo('updateFuelEntry')).toHaveLength(1));
    expect(fake.callsTo('updateFuelEntry')[0].body).toMatchObject({ quantity: 40, total: 320 });
  });

  it('asks before deleting', async () => {
    const fake = await open(editUrl, seed);
    await fireEvent.press(await screen.findByRole('button', { name: f.delete }));
    expect(await screen.findByText(f.deleteTitle)).toBeTruthy();
    expect(fake.callsTo('deleteFuelEntry')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: f.deleteKeep }));
    await waitFor(() => expect(screen.queryByText(f.deleteTitle)).toBeNull());
    expect(fake.callsTo('deleteFuelEntry')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: f.delete }));
    await fireEvent.press(await screen.findByRole('button', { name: f.deleteConfirm }));
    await waitFor(() => expect(fake.callsTo('deleteFuelEntry')).toHaveLength(1));
    await waitFor(() => expect(screen).toHavePathname(`/vehicles/${SAMPLE_VIN}/fuel`));
    expect(fake.state.fuel[SAMPLE_VIN]).toHaveLength(0);
  });

  it('says so when the entry is gone', async () => {
    await open(`/vehicles/${SAMPLE_VIN}/fuel/${globalThis.crypto.randomUUID()}`, seed);
    expect(await screen.findByText(f.notFound)).toBeTruthy();
  });
});

test('offline shows the banner and blocks Save', async () => {
  const fake = await open(newUrl, seedWith());
  await type(f.odometer, '84210');
  await type(f.quantityLitres, '38.2');
  await type(f.totalIn('RON'), '312');
  expect(saveButton()).toBeEnabled();
  await act(async () => onlineManager.setOnline(false));
  expect(screen.getByText(en.errors.offlineBanner)).toBeTruthy();
  expect(saveButton()).toBeDisabled();
  await fireEvent.press(saveButton());
  expect(fake.callsTo('addFuelEntry')).toHaveLength(0);
});
