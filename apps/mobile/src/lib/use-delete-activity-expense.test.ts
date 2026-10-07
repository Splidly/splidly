import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useDeleteActivityExpense } from "./use-delete-activity-expense";

const mockMutate = jest.fn();
const mockInvalidate = jest.fn(async () => undefined);
let mockCallbacks: {
  onSuccess: () => Promise<void>;
  onError: (error: Error) => void;
  onSettled: () => void;
};

jest.mock("./trpc", () => ({
  api: {
    useUtils: () => ({
      groups: {
        list: { invalidate: mockInvalidate },
        detail: { invalidate: mockInvalidate },
        balances: { invalidate: mockInvalidate },
        statistics: { invalidate: mockInvalidate },
      },
      friends: {
        list: { invalidate: mockInvalidate },
        detail: { invalidate: mockInvalidate },
      },
      expenses: { detail: { invalidate: mockInvalidate } },
    }),
    expenses: {
      remove: {
        useMutation: (callbacks: typeof mockCallbacks) => {
          mockCallbacks = callbacks;
          return { mutate: mockMutate, isPending: false };
        },
      },
    },
  },
}));

const expense = { id: "expense-1", description: "Dinner", version: 4 };

describe("activity expense deletion", () => {
  let alert: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });
  afterEach(() => alert.mockRestore());

  it("requires confirmation, allows cancellation, and sends the displayed version", async () => {
    const { result } = await renderHook(useDeleteActivityExpense);
    let canceled!: Promise<boolean>;
    await act(() => {
      canceled = result.current.confirmDelete(expense);
    });
    expect(mockMutate).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2];
    await act(() => buttons[0].onPress());
    await expect(canceled).resolves.toBe(false);
    await act(() => {
      void result.current.confirmDelete(expense);
    });
    await act(() => alert.mock.calls[1]![2][1].onPress());
    expect(mockMutate).toHaveBeenCalledWith({
      expenseId: expense.id,
      expectedVersion: 4,
    });
  });

  it("holds the native result until deletion succeeds, and restores it after a failure", async () => {
    const { result } = await renderHook(useDeleteActivityExpense);
    const deleted = result.current.confirmDelete(expense);
    const resolved = jest.fn();
    void deleted.then(resolved);
    await act(() => alert.mock.calls[0]![2][1].onPress());
    expect(resolved).not.toHaveBeenCalled();
    await act(() => mockCallbacks.onSuccess());
    await expect(deleted).resolves.toBe(true);
    await act(() => mockCallbacks.onSettled());
    const failed = result.current.confirmDelete(expense);
    await act(() => alert.mock.calls[1]![2][1].onPress());
    await act(() => mockCallbacks.onError(new Error("Request failed")));
    await expect(failed).resolves.toBe(false);
  });

  it("does not let a canceled dialog dismiss a subsequent confirmation", async () => {
    const { result } = await renderHook(useDeleteActivityExpense);
    const canceled = result.current.confirmDelete(expense);
    const first = alert.mock.calls[0]!;
    await act(() => first[2][0].onPress());
    await expect(canceled).resolves.toBe(false);
    const next = result.current.confirmDelete(expense);
    const resolved = jest.fn();
    void next.then(resolved);
    await act(() => first[3].onDismiss());
    expect(resolved).not.toHaveBeenCalled();
    await act(() => alert.mock.calls[1]![2][0].onPress());
    await expect(next).resolves.toBe(false);
  });

  it("releases the pending native swipe when its screen unmounts", async () => {
    const { result, unmount } = await renderHook(useDeleteActivityExpense);
    const pending = result.current.confirmDelete(expense);
    await unmount();
    await expect(pending).resolves.toBe(false);
  });

  it("ignores repeated gestures and repeated confirmations until the request settles", async () => {
    const { result } = await renderHook(useDeleteActivityExpense);
    await act(() => {
      result.current.confirmDelete(expense);
      result.current.confirmDelete(expense);
    });
    expect(alert).toHaveBeenCalledTimes(1);
    const [, , buttons, options] = alert.mock.calls[0]!;
    await act(() => {
      buttons[1].onPress();
      options.onDismiss();
      buttons[1].onPress();
      result.current.confirmDelete(expense);
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
    await act(() => mockCallbacks.onSettled());
    await act(() => {
      void result.current.confirmDelete(expense);
    });
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it("allows another gesture after dismissing the confirmation with Android Back", async () => {
    const { result } = await renderHook(useDeleteActivityExpense);
    await act(() => {
      void result.current.confirmDelete(expense);
    });
    await act(() => alert.mock.calls[0]![3].onDismiss());
    await act(() => {
      void result.current.confirmDelete(expense);
    });
    expect(alert).toHaveBeenCalledTimes(2);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("refreshes balances and activity after success and exposes errors without navigating away", async () => {
    await renderHook(useDeleteActivityExpense);
    await act(() => mockCallbacks.onSuccess());
    expect(mockInvalidate).toHaveBeenCalledTimes(7);
    await act(() =>
      mockCallbacks.onError(
        new Error("This expense has changed. Refresh and try again."),
      ),
    );
    expect(alert).toHaveBeenCalledWith(
      "Could not delete expense",
      "This expense has changed. Refresh and try again.",
    );
  });
});
