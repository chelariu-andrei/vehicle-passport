import { screen } from 'expo-router/testing-library';

import { aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

const EVENT_ID = '3f0c2f6e-5b0a-4d58-9d0e-1c7f2a9b4e11';

async function openDetail(source: 'MANUAL' | 'SCAN') {
  await openApp(`/vehicles/${SAMPLE_VIN}/events/${EVENT_ID}`, {
    seed: (api) => {
      api.state.vehicles.push(aVehicle());
      api.state.events[SAMPLE_VIN] = [anEvent({ id: EVENT_ID, source })];
    },
  });
  await screen.findByText('Source');
}

test('a manual entry never says who added it, since a previous owner may have', async () => {
  await openDetail('MANUAL');
  expect(screen.getByText('Added manually')).toBeTruthy();
  expect(screen.queryByText(/by you/i)).toBeNull();
});

test('a scanned entry names its source, not a person', async () => {
  await openDetail('SCAN');
  expect(screen.getByText('Scanned invoice')).toBeTruthy();
  expect(screen.queryByText(/\byou\b/i)).toBeNull();
});
