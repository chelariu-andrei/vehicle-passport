import type { Look } from '@/shared/viewer';

export type PanelProps = { look: Look; onChange: (next: Look) => void };
export type Topic = 'shape' | 'paint' | 'wheels' | 'glass' | 'plate';
export const TOPICS: readonly Topic[] = ['shape', 'paint', 'wheels', 'glass', 'plate'];
export const TOPIC_VIEW: Record<Topic, 'front' | 'side' | 'rear' | 'top'> = {
  shape: 'front',
  paint: 'front',
  wheels: 'side',
  glass: 'top',
  plate: 'rear',
};
