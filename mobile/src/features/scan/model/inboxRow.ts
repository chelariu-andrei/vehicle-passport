import type { components } from '@/shared/api/generated/schema';
import { en } from '@/shared/i18n/en';

export type ScanStatus = components['schemas']['ScanStatus'];
export type InboxAction = 'none' | 'review' | 'failed' | 'dismiss';

/** What the inbox shows for a job in this status (integration 3.4.2). `remove` rows leave the inbox. */
export function inboxRow(status: ScanStatus): { label: string; action: InboxAction; remove: boolean } {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
      return { label: en.scans.status.reading, action: 'none', remove: false };
    case 'EXTRACTED':
      return { label: en.scans.status.ready, action: 'review', remove: false };
    case 'CONFIRMED':
      return { label: en.scans.status.confirmed, action: 'none', remove: true };
    case 'REJECTED':
      return { label: en.scans.status.rejected, action: 'none', remove: true };
    case 'FAILED':
      return { label: en.scans.status.failed, action: 'failed', remove: false };
    case 'CANCELLED':
      return { label: en.scans.status.cancelled, action: 'dismiss', remove: false };
  }
}

/** Jobs that are still being read keep being polled. */
export const isActive = (status: ScanStatus | undefined): boolean => status === 'PENDING' || status === 'PROCESSING';
