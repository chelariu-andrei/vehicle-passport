import { qk } from '@/shared/api';

test('the deadlines key sits under the timeline key, so any event change refreshes it', () => {
  const timeline = qk.timeline('V1');
  expect(qk.deadlines('V1').slice(0, timeline.length)).toEqual([...timeline]);
  expect(qk.deadlines('V1')).not.toEqual(qk.deadlines('V2'));
});
