import type { components } from '@/shared/api/generated/schema';

import { Fact } from './Fact';

/** The user's own name and value rows, in the order they were saved. */
export function CustomFieldsView({ fields }: { fields: readonly components['schemas']['CustomField'][] }) {
  return (
    <>
      {fields.map((field, index) => (
        <Fact key={`${field.label}-${index}`} label={field.label} value={field.value} />
      ))}
    </>
  );
}
