import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';
import { toast } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

export type Settings = components['schemas']['SettingsDto'];

/** GET /me/settings. `enabled` stays off until the account may use the app (the server refuses settings before the terms are accepted). */
export function useSettings(enabled = true) {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async () => unwrap(await api.GET('/me/settings')),
    enabled,
  });
}

/**
 * PUT /me/settings with the whole object. The cached settings change at once and are put back, with a toast, if the server
 * refuses. `change` edits the latest cached settings, so quick successive changes build on each other.
 */
export function useUpdateSettings() {
  const client = useQueryClient();
  const s = useStrings();
  const mutation = useMutation({
    mutationFn: async (next: Settings) => unwrap(await api.PUT('/me/settings', { body: next })),
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey: qk.settings });
      const previous = client.getQueryData<Settings>(qk.settings);
      client.setQueryData<Settings>(qk.settings, next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) client.setQueryData(qk.settings, context.previous);
      toast(s.settings.saveFailed);
    },
    onSuccess: (saved) => {
      client.setQueryData(qk.settings, saved);
    },
  });
  const { mutate } = mutation;
  const change = (edit: (current: Settings) => Settings) => {
    const current = client.getQueryData<Settings>(qk.settings);
    if (current) mutate(edit(current));
  };
  return { ...mutation, change };
}
