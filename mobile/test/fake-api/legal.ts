/* Fake handlers for the public legal operations. English only: any other locale falls back to it, as the server does. */
import type { components } from '@/shared/api/generated/schema';
import { CURRENT_LEGAL_VERSION } from './account';
import type { Handler } from './handlers';

type Schemas = components['schemas'];

export const LEGAL_DOCUMENTS: Schemas['LegalDocument'][] = [
  {
    type: 'terms',
    version: CURRENT_LEGAL_VERSION,
    locale: 'en',
    title: 'Terms of Service',
    effectiveDate: '2026-01-01',
    bodyMarkdown: '# Terms of Service\n\n## Your account\n\nYou keep your **garage** accurate.\n\n- Be honest\n- Be kind\n\nSee [our site](https://example.com/terms).',
  },
  {
    type: 'privacy',
    version: CURRENT_LEGAL_VERSION,
    locale: 'en',
    title: 'Privacy Policy',
    effectiveDate: '2026-01-15',
    bodyMarkdown: '# Privacy Policy\n\nWe keep only what the app needs.',
  },
  {
    type: 'data-sharing',
    version: CURRENT_LEGAL_VERSION,
    locale: 'en',
    title: 'Data sharing',
    effectiveDate: '2026-02-01',
    bodyMarkdown: '# Data sharing\n\nNothing is shared without a passport you create.',
  },
];

const listLegalDocuments: Handler = () => ({
  status: 200,
  body: { documents: LEGAL_DOCUMENTS.map(({ bodyMarkdown: _body, ...summary }) => summary) },
});

const getLegalDocument: Handler = (c) => {
  const doc = LEGAL_DOCUMENTS.find((d) => d.type === c.params.type);
  if (doc) return { status: 200, body: doc };
  const code = 'legal-document-not-found';
  return { status: 404, contentType: 'application/problem+json', body: { type: `urn:vehicle-passport:${code}`, title: code, status: 404, detail: code, code } };
};

export const publicHandlers: Record<string, Handler> = { listLegalDocuments, getLegalDocument };
