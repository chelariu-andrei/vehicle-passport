import { COMPONENT_CONFIG, COMPONENTS } from '../../model/components';
import type { Component } from '../../model/components';
import { en } from '@/shared/i18n/en';

import { Chip, ChipGroup } from './Chip';

/** Which parts of the car the entry touched. Any number, in the registry's order. */
export function ComponentPicker({ value, onChange }: { value: Component[]; onChange(next: Component[]): void }) {
  const toggle = (component: Component) => {
    const next = value.includes(component) ? value.filter((c) => c !== component) : [...value, component];
    onChange(COMPONENTS.filter((c) => next.includes(c)));
  };
  return (
    <ChipGroup label={en.event.components} role="group">
      {COMPONENTS.map((component) => (
        <Chip key={component} role="checkbox" label={COMPONENT_CONFIG[component].label()} selected={value.includes(component)} onPress={() => toggle(component)} />
      ))}
    </ChipGroup>
  );
}
