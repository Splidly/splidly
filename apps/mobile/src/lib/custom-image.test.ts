import { ImageManipulator } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { pickCustomImage } from "./custom-image";

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));

const crop = jest.fn();
const resize = jest.fn();
const renderAsync = jest.fn();
const saveAsync = jest.fn();

jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: "jpeg" },
}));

describe("pickCustomImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    crop.mockReturnValue(undefined);
    resize.mockReturnValue(undefined);
    saveAsync.mockResolvedValue({ base64: "PHOTO" });
    renderAsync.mockResolvedValue({ saveAsync });
    (ImageManipulator.manipulate as jest.Mock).mockReturnValue({
      crop,
      resize,
      renderAsync,
    });
  });

  it("crops, resizes, and compresses a selected photo", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        { uri: "file:///photo.png", width: 1200, height: 900 },
      ],
    });

    await expect(pickCustomImage()).resolves.toBe(
      "data:image/jpeg;base64,PHOTO",
    );
    expect(crop).toHaveBeenCalledWith({
      originX: 150,
      originY: 0,
      width: 900,
      height: 900,
    });
    expect(resize).toHaveBeenCalledWith({ width: 512, height: 512 });
    expect(saveAsync).toHaveBeenCalledWith({
      base64: true,
      compress: 0.82,
      format: "jpeg",
    });
  });

  it("returns nothing when selection is canceled", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: null,
    });

    await expect(pickCustomImage()).resolves.toBeUndefined();
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  });
});
