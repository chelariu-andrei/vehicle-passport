import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { MAX_PHOTOS, preparePhoto } from '@/shared/media';
import { Button, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { addStaged, MAX_STAGED, pdfProblem, removeStaged } from '../model/stagedFiles';
import type { StagedFile } from '../model/stagedFiles';

type Photo = { uri: string; width: number; height: number };

/** A picked PDF whose uri has no `.pdf` (an Android content uri, say) is copied to the cache under one, because the upload takes its type from the name. */
function withPdfExtension(uri: string): string {
  if (/\.pdf$/i.test(uri)) return uri;
  const copy = new File(Paths.cache, `attachment-${randomUUID()}.pdf`);
  new File(uri).copy(copy);
  return copy.uri;
}

/** Photos and PDFs picked in the event form. They stay on the device until Save sends them. */
export function DocumentsSection({
  files,
  onChange,
  disabled = false,
  capacity = MAX_STAGED,
  children,
}: {
  files: StagedFile[];
  onChange(files: StagedFile[]): void;
  disabled?: boolean;
  /** How many files fit in all; less than the limit when the event already has some. */
  capacity?: number;
  /** The documents the event already has, shown above the pickers. */
  children?: ReactNode;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const room = capacity - files.length;

  const stage = (picked: StagedFile[], problem: string | null = null) => {
    const result = addStaged(files, picked, capacity);
    onChange(result.list);
    setNotice(result.overflow ? en.event.documents.limit : problem);
  };

  const stagePhotos = async (assets: Photo[]) => {
    const picked: StagedFile[] = [];
    let problem: string | null = null;
    for (const asset of assets.slice(0, Math.max(room, 0))) {
      try {
        const prepared = await preparePhoto(asset);
        picked.push({ ...prepared, name: '', kind: 'photo' });
      } catch {
        problem = en.event.documents.unusable;
      }
    }
    stage(picked, problem);
    if (assets.length > room) setNotice(en.event.documents.limit);
  };

  const takePhoto = async () => {
    if (room <= 0) return setNotice(en.event.documents.limit);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setNotice(en.event.documents.cameraDenied);
    setNotice(null);
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) await stagePhotos(result.assets);
  };

  const choosePhotos = async () => {
    if (room <= 0) return setNotice(en.event.documents.limit);
    setNotice(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.min(room, MAX_PHOTOS),
      orderedSelection: true,
      quality: 1,
    });
    if (!result.canceled) await stagePhotos(result.assets);
  };

  const choosePdf = async () => {
    if (room <= 0) return setNotice(en.event.documents.limit);
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    const picked: StagedFile[] = [];
    let problem: string | null = null;
    for (const asset of result.assets) {
      const size = asset.size ?? new File(asset.uri).size;
      if (pdfProblem(size) !== null) {
        problem = en.event.documents.tooLarge;
        continue;
      }
      picked.push({ uri: withPdfExtension(asset.uri), size, name: asset.name, kind: 'pdf' });
    }
    stage(picked, problem);
  };

  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="label">{en.event.documents.title}</Text>
      <Text variant="caption" color="ink-muted">
        {en.event.documents.caption}
      </Text>
      {children}
      <View style={{ gap: tokens.space['space-2'] }}>
        <Button kind="secondary" title={en.event.documents.takePhoto} disabled={disabled} onPress={() => void takePhoto()} />
        <Button kind="secondary" title={en.event.documents.choosePhoto} disabled={disabled} onPress={() => void choosePhotos()} />
        <Button kind="secondary" title={en.event.documents.choosePdf} disabled={disabled} onPress={() => void choosePdf()} />
      </View>
      {notice ? (
        <Text color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {files.map((file, index) => {
        const name = file.kind === 'pdf' ? file.name : en.event.documents.photo(index + 1);
        return (
          <View key={`${file.uri}:${index}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1 }}>{name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={en.event.documents.remove(name)}
              disabled={disabled}
              onPress={() => onChange(removeStaged(files, index))}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text variant="title">{en.event.documents.removeMark}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
