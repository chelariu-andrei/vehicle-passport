import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { errorMessage, isApiError } from '@/shared/api';
import { ConfirmSheet, Icon, Text, toast, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useAttachments } from '../api/useAttachments';
import type { AttachmentResponse } from '../api/useAttachments';
import { useDeleteAttachment } from '../api/useDeleteAttachment';
import { useOpenAttachment } from '../api/useOpenAttachment';
import { useIsLocked } from '../model/lockedEvents';

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
        accessibilityHint={en.event.documents.openAction}
        style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}
      >
        <Icon name="doc" color="ink-muted" />
        <Text variant="body-lg" style={{ flex: 1 }}>
          {name}
        </Text>
        {open.isPending ? <ActivityIndicator /> : <Icon name="share" color="ink-muted" size={20} />}
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
 * The detail screen only lists and opens them. The edit form passes `editable` to allow deleting, and `bare` because
 * it shows them under its own "Documents" heading; new files are added there and sent on Save.
 */
export function AttachmentList({ vin, eventId, count, editable = false, bare = false }: { vin: string; eventId: string; count: number; editable?: boolean; bare?: boolean }) {
  const locked = useIsLocked(eventId);
  const list = useAttachments(vin, eventId, !locked);
  const remove = useDeleteAttachment(vin, eventId);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const heading = bare ? null : (
    <Text variant="label" color="ink-muted">
      {en.event.documents.title}
    </Text>
  );

  const restricted = locked || (list.isError && isApiError(list.error, 'document-restricted'));
  if (restricted) {
    return (
      <View style={{ gap: tokens.space['space-1'] }}>
        {heading}
        <Text variant="body-lg">{en.event.documents.count(count)}</Text>
        <Text color="ink-muted">{en.errors.codes['document-restricted']}</Text>
      </View>
    );
  }

  const attachments = list.data ?? [];
  const names = rowNames(attachments);

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
      {heading}
      {list.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {en.event.documents.loadFailed}
        </Text>
      ) : null}
      {!bare && list.isSuccess && attachments.length === 0 ? <Text color="ink-muted">{en.event.documents.empty}</Text> : null}
      {!bare && attachments.length > 0 ? (
        <Text variant="caption" color="ink-muted">
          {en.event.documents.openHint}
        </Text>
      ) : null}
      {attachments.map((attachment, index) => (
        <Row
          key={attachment.id}
          vin={vin}
          eventId={eventId}
          attachment={attachment}
          name={names[index]}
          onDelete={editable && attachment.kind === 'UPLOAD' ? () => setDeleting({ id: attachment.id, name: names[index] }) : undefined}
        />
      ))}
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
