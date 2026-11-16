import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { errorMessage, isApiError } from '@/shared/api';
import { Button, ConfirmSheet, Text, toast, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useAttachments } from '../api/useAttachments';
import type { AttachmentResponse } from '../api/useAttachments';
import { useDeleteAttachment } from '../api/useDeleteAttachment';
import { useOpenAttachment } from '../api/useOpenAttachment';
import { useUploadAttachments } from '../api/useUploadAttachments';
import { useIsLocked } from '../model/lockedEvents';
import type { PreparedFile } from '../model/preparedFile';
import { MAX_STAGED } from '../model/stagedFiles';
import { DocumentsSection } from './DocumentsSection';

export type UploadFailure = { failed: number; total: number; duplicates: number };

/** What a row is called: photos and PDFs are numbered in list order, a scan's source is named for what it is. */
function rowNames(attachments: AttachmentResponse[]): string[] {
  let photos = 0;
  let pdfs = 0;
  return attachments.map((a) => {
    if (a.kind === 'SCAN_SOURCE') return en.event.documents.scanSource;
    return a.contentType === 'application/pdf' ? en.event.documents.pdf(++pdfs) : en.event.documents.photo(++photos);
  });
}

function Row({ vin, eventId, attachment, name, onDelete }: { vin: string; eventId: string; attachment: AttachmentResponse; name: string; onDelete?: () => void }) {
  const open = useOpenAttachment(vin, eventId, attachment.id, name);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        disabled={open.isPending}
        onPress={() => open.mutate(undefined, { onError: (error) => toast(errorMessage(error)) })}
        style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}
      >
        <Text variant="body-lg">{name}</Text>
      </Pressable>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={en.event.documents.deleteDocument(name)}
          onPress={onDelete}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text variant="title">{en.event.documents.removeMark}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The documents of one saved event. A later owner cannot list them, so they get the count and the restricted copy;
 * the list is not even asked for once the event is known to be locked.
 *
 * Retry cannot resend the files that failed (they are gone once the form closes), so it opens the same picker as
 * "Add document" and the person chooses them again.
 */
export function AttachmentList({ vin, eventId, count, initialFailure }: { vin: string; eventId: string; count: number; initialFailure: UploadFailure | null }) {
  const locked = useIsLocked(eventId);
  const list = useAttachments(vin, eventId, !locked);
  const remove = useDeleteAttachment(vin, eventId);
  const upload = useUploadAttachments(vin, eventId);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<UploadFailure | null>(initialFailure);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const restricted = locked || (list.isError && isApiError(list.error, 'document-restricted'));
  if (restricted) {
    return (
      <View style={{ gap: tokens.space['space-1'] }}>
        <Text variant="label" color="ink-muted">
          {en.event.documents.title}
        </Text>
        <Text variant="body-lg">{en.event.documents.count(count)}</Text>
        <Text color="ink-muted">{en.errors.codes['document-restricted']}</Text>
      </View>
    );
  }

  const attachments = list.data ?? [];
  const names = rowNames(attachments);
  const full = attachments.length >= MAX_STAGED;

  const send = (files: PreparedFile[]) => {
    if (files.length === 0 || upload.isPending) return;
    upload.mutate(files, {
      onSuccess: (outcome) => {
        const duplicates = outcome.failed.filter((f) => f.code === 'duplicate-document').length;
        const succeeded = files.length - outcome.failed.length;
        // The banner counts what is still missing out of what was meant to go, across retries.
        const failed = Math.max(0, (failure?.failed ?? 0) - succeeded) + outcome.failed.length;
        setFailure(failed > 0 ? { failed, total: failure?.total ?? files.length, duplicates: (failure?.duplicates ?? 0) + duplicates } : null);
        setAdding(false);
      },
      onError: (error) => {
        setFailure(failure ?? { failed: files.length, total: files.length, duplicates: 0 });
        toast(errorMessage(error));
      },
    });
  };

  const confirmDelete = () => {
    if (!deleting || remove.isPending) return;
    remove.mutate(deleting.id, {
      onSuccess: () => setDeleting(null),
      onError: (error) => {
        setDeleting(null);
        toast(errorMessage(error));
      },
    });
  };

  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="label" color="ink-muted">
        {en.event.documents.title}
      </Text>
      {failure ? (
        <View style={{ gap: tokens.space['space-2'] }}>
          <Text color="danger" accessibilityRole="alert">
            {en.event.documents.failedUploads(failure.failed, failure.total)}
            {failure.duplicates > 0 ? ` ${en.event.documents.duplicateUploads(failure.duplicates)}` : ''}
          </Text>
          <Button kind="secondary" title={en.event.documents.retry} onPress={() => setAdding(true)} />
        </View>
      ) : null}
      {list.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {en.event.documents.loadFailed}
        </Text>
      ) : null}
      {attachments.map((attachment, index) => (
        <Row
          key={attachment.id}
          vin={vin}
          eventId={eventId}
          attachment={attachment}
          name={names[index]}
          onDelete={attachment.kind === 'UPLOAD' ? () => setDeleting({ id: attachment.id, name: names[index] }) : undefined}
        />
      ))}
      {adding ? <DocumentsSection files={[]} onChange={send} disabled={upload.isPending} capacity={MAX_STAGED - attachments.length} /> : list.isSuccess && !full ? <Button kind="secondary" title={en.event.documents.add} onPress={() => setAdding(true)} /> : null}
      <ConfirmSheet
        visible={deleting !== null}
        title={en.event.documents.deleteTitle}
        body={en.event.documents.deleteBody}
        confirmLabel={en.event.documents.deleteConfirm}
        dismissLabel={en.event.documents.deleteKeep}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </View>
  );
}
