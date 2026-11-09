import { api } from "./trpc";
import { useListAction } from "./use-list-action";

export function useDeleteActivitySettlement() {
  const confirm = useListAction();
  const utils = api.useUtils();
  const remove = api.settlements.remove.useMutation({
    onSuccess: () => Promise.all([
      utils.groups.list.invalidate(),
      utils.groups.detail.invalidate(),
      utils.groups.balances.invalidate(),
      utils.groups.statistics.invalidate(),
      utils.friends.list.invalidate(),
      utils.friends.detail.invalidate(),
      utils.settlements.detail.invalidate(),
    ]),
  });
  return {
    isPending: remove.isPending,
    confirmDelete: (settlement: { id: string; version: number }) => confirm({
      title: "Delete payment?",
      message: "This payment will be removed and its balances will be reversed.",
      label: "Delete",
      perform: () => remove.mutateAsync({ settlementId: settlement.id, expectedVersion: settlement.version }),
    }),
  };
}
