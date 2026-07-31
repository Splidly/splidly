import type { CustomImageDataUrl } from "@splidly/shared";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

const IMAGE_SIZE = 512;

export async function pickCustomImage(): Promise<
  CustomImageDataUrl | undefined
> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return undefined;

  const side = Math.min(asset.width, asset.height);
  const manipulator = ImageManipulator.manipulate(asset.uri);
  if (asset.width !== asset.height && side > 0) {
    manipulator.crop({
      originX: Math.max(0, Math.round((asset.width - side) / 2)),
      originY: Math.max(0, Math.round((asset.height - side) / 2)),
      width: side,
      height: side,
    });
  }
  manipulator.resize({ width: IMAGE_SIZE, height: IMAGE_SIZE });
  const image = await manipulator.renderAsync();
  const saved = await image.saveAsync({
    base64: true,
    compress: 0.82,
    format: SaveFormat.JPEG,
  });
  if (!saved.base64) throw new Error("The selected photo could not be read.");

  return `data:image/jpeg;base64,${saved.base64}`;
}
