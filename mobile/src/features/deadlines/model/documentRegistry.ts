import type { components } from '@/shared/api/generated/schema';
import type { IconName } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { EventType } from '@/features/event/model/eventTypes';

export type DocumentKind = components['schemas']['DocumentKind'];

/** The fixed order of the endpoint and of the screen. */
export const DOCUMENT_ORDER: readonly DocumentKind[] = ['ITP', 'RCA', 'CASCO', 'ROVINIETA', 'FIRE_EXTINGUISHER', 'FIRST_AID_KIT'];

export type EventPreset = {
  type: EventType;
  coverage?: 'RCA' | 'CASCO';
  item?: 'FIRE_EXTINGUISHER' | 'FIRST_AID_KIT';
};

export type DocumentConfig = {
  label: () => string;
  icon: IconName;
  /** Only changes the copy ("Optional · Add"), never the colour. */
  optional: boolean;
  /** What the new-event form starts with when the user adds this document. */
  preset: EventPreset;
};

export const DOCUMENT_CONFIG: Record<DocumentKind, DocumentConfig> = {
  ITP: { label: () => en.deadlines.kind.ITP, icon: 'car', optional: false, preset: { type: 'ITP' } },
  RCA: { label: () => en.deadlines.kind.RCA, icon: 'shield', optional: false, preset: { type: 'INSURANCE', coverage: 'RCA' } },
  CASCO: { label: () => en.deadlines.kind.CASCO, icon: 'shield', optional: true, preset: { type: 'INSURANCE', coverage: 'CASCO' } },
  ROVINIETA: { label: () => en.deadlines.kind.ROVINIETA, icon: 'doc', optional: false, preset: { type: 'ROVINIETA' } },
  FIRE_EXTINGUISHER: {
    label: () => en.deadlines.kind.FIRE_EXTINGUISHER,
    icon: 'alert',
    optional: false,
    preset: { type: 'SAFETY_EQUIPMENT', item: 'FIRE_EXTINGUISHER' },
  },
  FIRST_AID_KIT: {
    label: () => en.deadlines.kind.FIRST_AID_KIT,
    icon: 'plus',
    optional: false,
    preset: { type: 'SAFETY_EQUIPMENT', item: 'FIRST_AID_KIT' },
  },
};
