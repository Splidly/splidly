import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, Text } from "react-native";
import { pickCustomImage } from "../lib/custom-image";
import { PictureEditor } from "./picture-editor";

jest.mock("../lib/custom-image", () => ({ pickCustomImage: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it("blocks repeated presses while a picker is open and reports when preparation finishes", async () => {
  let finish!: (image: string) => void;
  (pickCustomImage as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const changed = jest.fn();
  const preparing = jest.fn();
  const view = await render(<PictureEditor label="group photo" onImageChange={changed} onPreparingChange={preparing}
    preview={<Text selectable={false}>Preview</Text>} />);
  const preview = view.getByLabelText("Add group photo");
  await fireEvent.press(preview);
  await fireEvent.press(preview);
  expect(pickCustomImage).toHaveBeenCalledTimes(1);
  expect(preparing).toHaveBeenCalledWith(true);
  await act(async () => { finish("data:image/jpeg;base64,PHOTO"); });
  expect(changed).toHaveBeenCalledWith("data:image/jpeg;base64,PHOTO");
  expect(preparing).toHaveBeenLastCalledWith(false);
});

it.each([false, true])("ignores a picker's late completion after unmount (failed=%s)", async failed => {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  (pickCustomImage as jest.Mock).mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }));
  const changed = jest.fn();
  const preparing = jest.fn();
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  try {
    const view = await render(<PictureEditor label="group photo" onImageChange={changed} onPreparingChange={preparing}
      preview={<Text selectable={false}>Preview</Text>} />);
    await fireEvent.press(view.getByLabelText("Add group photo"));
    await view.unmount();
    await act(async () => { if (failed) reject(new Error("Photo failed")); else resolve("data:image/jpeg;base64,PHOTO"); });
    expect(changed).not.toHaveBeenCalled();
    expect(preparing.mock.calls).toEqual([[true]]);
    expect(alert).not.toHaveBeenCalled();
  } finally { alert.mockRestore(); }
});
