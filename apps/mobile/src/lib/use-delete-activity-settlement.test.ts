import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useDeleteActivitySettlement } from "./use-delete-activity-settlement";

const mockRemove = jest.fn();
const mockInvalidate = jest.fn(async () => undefined);
let mockOnSuccess: () => Promise<unknown>;

jest.mock("./trpc", () => ({ api: {
  settlements: { remove: { useMutation: ({ onSuccess }: { onSuccess: () => Promise<unknown> }) => {
    mockOnSuccess = onSuccess;
    return { isPending: false, mutateAsync: mockRemove };
  } } },
  useUtils: () => ({
    groups: {
      list: { invalidate: mockInvalidate }, detail: { invalidate: mockInvalidate },
      balances: { invalidate: mockInvalidate }, statistics: { invalidate: mockInvalidate },
    },
    friends: { list: { invalidate: mockInvalidate }, detail: { invalidate: mockInvalidate } },
    settlements: { detail: { invalidate: mockInvalidate } },
  }),
} }));

it("confirms deletion once, preserves cancellation and invalidates balances only after deleting the displayed version", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  mockRemove.mockReset();
  mockInvalidate.mockClear();
  mockRemove.mockImplementation(async () => { await mockOnSuccess(); });
  try {
    const { result } = await renderHook(useDeleteActivitySettlement);
    const settlement = { id: "s", version: 4 };
    let canceled!: Promise<boolean>;
    await act(() => { canceled = result.current.confirmDelete(settlement); });
    expect(mockRemove).not.toHaveBeenCalled();
    expect(alert.mock.calls[0]?.[2]?.[0]).toMatchObject({ text: "Cancel", style: "cancel" });
    await act(() => { alert.mock.calls[0]?.[2]?.[0]?.onPress?.(); });
    await expect(canceled).resolves.toBe(false);
    expect(mockInvalidate).not.toHaveBeenCalled();
    let deleted!: Promise<boolean>;
    await act(() => { deleted = result.current.confirmDelete(settlement); });
    await expect(result.current.confirmDelete(settlement)).resolves.toBe(false);
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert.mock.calls[1]?.[2]?.[1]).toMatchObject({ text: "Delete", style: "destructive" });
    await act(async () => { await alert.mock.calls[1]?.[2]?.[1]?.onPress?.(); });
    await expect(deleted).resolves.toBe(true);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith({ settlementId: "s", expectedVersion: 4 });
    expect(mockInvalidate).toHaveBeenCalledTimes(7);
  } finally { alert.mockRestore(); }
});
