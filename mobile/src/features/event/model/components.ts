import type { components } from '@/shared/api/generated/schema';
import type { IconName } from '@/shared/design';
import { en } from '@/shared/i18n/en';

export type Component = components['schemas']['Component'];

/** Display order of the component chips. */
export const COMPONENTS: readonly Component[] = [
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
];

/** A missing component fails to compile. */
export const COMPONENT_CONFIG: Record<Component, { icon: IconName; label: () => string }> = {
  ENGINE: { icon: 'wrench', label: () => en.event.component.ENGINE },
  TRANSMISSION: { icon: 'rotate', label: () => en.event.component.TRANSMISSION },
  BRAKES: { icon: 'alert', label: () => en.event.component.BRAKES },
  SUSPENSION: { icon: 'down', label: () => en.event.component.SUSPENSION },
  STEERING: { icon: 'wheel', label: () => en.event.component.STEERING },
  TIRES_WHEELS: { icon: 'wheel', label: () => en.event.component.TIRES_WHEELS },
  ELECTRICAL: { icon: 'scan', label: () => en.event.component.ELECTRICAL },
  CLIMATE: { icon: 'sparkle', label: () => en.event.component.CLIMATE },
  BODY: { icon: 'car', label: () => en.event.component.BODY },
  EXHAUST: { icon: 'road', label: () => en.event.component.EXHAUST },
  INTERIOR: { icon: 'user', label: () => en.event.component.INTERIOR },
  FLUIDS: { icon: 'paint', label: () => en.event.component.FLUIDS },
  OTHER: { icon: 'more', label: () => en.event.component.OTHER },
};
