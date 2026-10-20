import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useListAction } from "./use-list-action";

describe("native list action confirmation", () => {
  let alert: jest.SpyInstance;
  beforeEach(() => {
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });
  afterEach(() => alert.mockRestore());
  const options = (
    perform: () => Promise<unknown> = jest.fn(async () => undefined),
  ) => ({
    title: "Archive group?",
    message: "Only for you",
    label: "Archive",
    perform,
  });

  it("blocks repeated gestures and waits for the mutation before completing UIKit's action", async () => {
    let finish!: () => void;
    const perform = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = await renderHook(useListAction);
    const pending = result.current(options(perform));
    await expect(result.current(options(perform))).resolves.toBe(false);
    expect(alert).toHaveBeenCalledTimes(1);
    const [, , buttons, dialog] = alert.mock.calls[0]!;
    let submitted!: Promise<void>;
    await act(() => {
      submitted = buttons[1].onPress();
      dialog.onDismiss();
      buttons[1].onPress();
    });
    expect(perform).toHaveBeenCalledTimes(1);
    const resolved = jest.fn();
    void pending.then(resolved);
    expect(resolved).not.toHaveBeenCalled();
    await act(async () => {
      finish();
      await submitted;
    });
    await expect(pending).resolves.toBe(true);
  });

  it("restores the row on cancellation, dismissal, failure, and unmount", async () => {
    const { result, unmount } = await renderHook(useListAction);
    const perform = jest.fn(async () => {
      throw new Error("Balance is not settled");
    });
    const canceled = result.current(options(perform));
    await act(() => alert.mock.calls[0]![2][0].onPress());
    await expect(canceled).resolves.toBe(false);
    const dismissed = result.current(options(perform));
    await act(() => alert.mock.calls[1]![3].onDismiss());
    await expect(dismissed).resolves.toBe(false);
    expect(perform).not.toHaveBeenCalled();
    const failed = result.current(options(perform));
    await act(() => alert.mock.calls[2]![2][1].onPress());
    await expect(failed).resolves.toBe(false);
    expect(alert).toHaveBeenLastCalledWith(
      "Could not archive",
      "Balance is not settled",
    );
    const abandoned = result.current(options(perform));
    await unmount();
    await expect(abandoned).resolves.toBe(false);
  });
});

it("archives immediately without a dialog, blocks duplicates, and waits for the request", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  try {
    let finish!: () => void;
    const perform = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = await renderHook(useListAction);
    const action = {
      confirmation: false,
      title: "Archive",
      message: "",
      label: "Archive",
      perform,
    };
    const pending = result.current(action);
    expect(perform).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    await expect(result.current(action)).resolves.toBe(false);
    const resolved = jest.fn();
    void pending.then(resolved);
    expect(resolved).not.toHaveBeenCalled();
    await act(async () => {
      finish();
      await pending;
    });
    await expect(pending).resolves.toBe(true);
  } finally {
    alert.mockRestore();
  }
});
