import { useQuery } from '@tanstack/react-query';

import { qk } from '@/shared/api';

import { fetchFullTimeline } from '../model/timeline';

export function useTimeline(vin: string) {
  return useQuery({ queryKey: qk.timeline(vin), queryFn: () => fetchFullTimeline(vin), meta: { vin } });
}
