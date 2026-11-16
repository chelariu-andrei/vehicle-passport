import { useQuery } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

import type { LegalType } from '../model/display';
import type { LegalLocale } from '../model/locale';

const HOUR = 60 * 60 * 1000;

export function useLegalDocuments(locale: LegalLocale) {
  return useQuery({
    queryKey: qk.legalDocuments(locale),
    queryFn: async () => unwrap(await api.GET('/public/legal/documents', { params: { query: { locale } } })).documents,
    staleTime: HOUR,
  });
}

export function useLegalDocument(type: LegalType, locale: LegalLocale, enabled = true) {
  return useQuery({
    queryKey: qk.legalDocument(type, locale),
    queryFn: async () => unwrap(await api.GET('/public/legal/documents/{type}', { params: { path: { type }, query: { locale } } })),
    staleTime: HOUR,
    enabled,
  });
}
