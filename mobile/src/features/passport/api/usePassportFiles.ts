import { useMutation, useQuery } from '@tanstack/react-query';

import { api, authHeaders, saveAndShare, unwrap } from '@/shared/api';

/**
 * The QR is fetched by `expo-image` itself, with the bearer token as a header, so it does not pass through `api`.
 * The headers come from a query that is never cached: every mount reads the token as it is now.
 */
export function usePassportQr(id: string, enabled: boolean) {
  const headers = useQuery({
    queryKey: ['passport-qr', id],
    queryFn: authHeaders,
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
  const source = headers.data ? { uri: `${process.env.EXPO_PUBLIC_API_URL ?? ''}/passports/${id}/qr`, headers: headers.data } : undefined;
  return { source, reload: () => void headers.refetch() };
}

/** Downloads the PDF through the API client (P3) and opens the share sheet. */
export function useSavePassportPdf(id: string, vin: string) {
  return useMutation({
    mutationFn: async () => {
      const result = await api.GET('/passports/{id}/pdf', { params: { path: { id } }, parseAs: 'arrayBuffer' });
      const bytes = unwrap(result) as ArrayBuffer;
      await saveAndShare(bytes, result.response.headers.get('content-type') ?? 'application/pdf', `passport-${vin}`);
    },
  });
}
