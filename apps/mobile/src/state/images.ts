import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

export type PickResult = PickedImage | 'denied' | null;

/**
 * Alege o fotografie (camera sau galeria), o micsoreaza si o comprima pe telefon:
 * se trimite serverului o imagine JPEG de cel mult `maxSide` pixeli (de obicei sub 400 KB).
 */
export async function pickImage(
  source: 'camera' | 'gallery',
  options: { maxSide?: number; square?: boolean } = {},
): Promise<PickResult> {
  const maxSide = options.maxSide ?? 1280;
  const picker: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.9,
    ...(options.square ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}),
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return 'denied';
    result = await ImagePicker.launchCameraAsync(picker);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(picker);
  }
  if (result.canceled || !result.assets[0]) return null;
  return prepareImage(
    result.assets[0].uri,
    result.assets[0].width,
    result.assets[0].height,
    maxSide,
  );
}

/** Micsoreaza si comprima o imagine aflata deja pe telefon. */
export async function prepareImage(
  uri: string,
  width: number,
  height: number,
  maxSide = 1280,
): Promise<PickedImage> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > maxSide) {
    context.resize(width >= height ? { width: maxSide } : { height: maxSide });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('base64');
  return { uri: saved.uri, base64: saved.base64, width: saved.width, height: saved.height };
}

/**
 * Imaginea pregatita pe un ecran si folosita pe urmatorul (de exemplu masa fotografiata,
 * publicata apoi in profil), fara sa fie prelucrata din nou. Se pastreaza doar ultima.
 */
const stash = new Map<string, PickedImage>();

export function stashImage(image: PickedImage): string {
  const key = String(Date.now());
  stash.clear();
  stash.set(key, image);
  return key;
}

export function takeStashedImage(key: string | undefined): PickedImage | null {
  return key ? (stash.get(key) ?? null) : null;
}
