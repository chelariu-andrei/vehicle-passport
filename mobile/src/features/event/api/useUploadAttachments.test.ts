import { aVehicle, anEvent, installFakeApi } from '../../../../test/fake-api';
import { putFile } from '../../../../test/fakes/photos';
import { uploadAttachments } from './useUploadAttachments';

const VIN = 'WVWZZZ1JZXW000001';

// The mocked device files all have empty content, so every file after the first accepted one is a duplicate.
test('a refused file is a failure with its code and the rest still go', async () => {
  const api = installFakeApi();
  api.state.vehicles.push(aVehicle({ vin: VIN }));
  const event = anEvent();
  api.state.events[VIN] = [event];
  putFile('file:///a.jpg', 100);
  putFile('file:///b.jpg', 100);
  putFile('file:///c.pdf', 100);
  api.failNext('addAttachment', 422, 'attachment-limit');
  const outcome = await uploadAttachments(VIN, event.id, [
    { uri: 'file:///a.jpg', size: 100 },
    { uri: 'file:///b.jpg', size: 100 },
    { uri: 'file:///c.pdf', size: 100 },
  ]);
  expect(outcome.failed).toEqual([
    { index: 0, code: 'attachment-limit' },
    { index: 2, code: 'duplicate-document' },
  ]);
  expect(outcome.uploaded).toHaveLength(1);
});
