import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { Button, Screen, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { PhotoProblem, useUploadScans } from '../api/uploadScans';
import { MAX_PHOTOS } from '../model/preparePhoto';
import { PickVehicle } from './PickVehicle';

type Photo = { uri: string; width: number; height: number };

function PhotoCapture({ vin }: { vin: string }) {
  const router = useRouter();
  const upload = useUploadScans();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const full = photos.length >= MAX_PHOTOS;

  const add = (picked: Photo[]) => {
    const room = MAX_PHOTOS - photos.length;
    setPhotos([...photos, ...picked.slice(0, room)]);
    setNotice(picked.length > room ? en.scans.limit : null);
  };

  const takePhoto = async () => {
    upload.reset();
    if (full) return setNotice(en.scans.limit);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setNotice(en.scans.cameraDenied);
    setNotice(null);
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) add(result.assets);
  };

  const choosePhotos = async () => {
    upload.reset();
    if (full) return setNotice(en.scans.limit);
    setNotice(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      orderedSelection: true,
      quality: 1,
    });
    if (!result.canceled) add(result.assets);
  };

  const send = () =>
    upload.mutate(
      { vin, assets: photos },
      {
        onSuccess: () => {
          // Land on the inbox with nothing of the capture flow left to go back to.
          if (router.canDismiss()) router.dismissAll();
          router.replace('/scans');
        },
      },
    );

  const problem = upload.error
    ? upload.error instanceof PhotoProblem
      ? en.scans.badPhoto(upload.error.index + 1)
      : errorMessage(upload.error)
    : null;
  const message = notice ?? problem;

  return (
    <Screen scroll>
      <Text variant="title-lg" accessibilityRole="header">
        {en.scans.onePhoto}
      </Text>
      <Text color="ink-muted">{en.scans.onePhotoBody}</Text>
      <View style={{ gap: tokens.space['space-2'] }}>
        <Button title={en.scans.takePhoto} onPress={() => void takePhoto()} />
        <Button kind="secondary" title={en.scans.choosePhotos} onPress={() => void choosePhotos()} />
      </View>
      {message ? (
        <Text color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      {photos.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
          {photos.map((photo, index) => (
            <View key={`${photo.uri}:${index}`}>
              <Image source={{ uri: photo.uri }} style={{ width: 88, height: 112, borderRadius: tokens.radius['radius-md'] }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={en.scans.removePhoto(index + 1)}
                disabled={upload.isPending}
                onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                style={{ position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text variant="title" color="on-brand" style={{ textShadowColor: '#000', textShadowRadius: 3 }}>
                  {en.scans.removeMark}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {photos.length > 0 ? <Button title={en.scans.upload(photos.length)} loading={upload.isPending} onPress={send} /> : null}
    </Screen>
  );
}

/** Capture for one car: the one given, or the one picked first (skipped when there is a single car). */
export function CaptureScreen({ vin }: { vin?: string }) {
  const [picked, setPicked] = useState<string>();
  const target = vin ?? picked;
  return target ? <PhotoCapture vin={target} /> : <PickVehicle onPick={setPicked} />;
}
