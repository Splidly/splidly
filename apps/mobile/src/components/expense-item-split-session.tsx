import type { CurrencyCode } from "@splidly/shared";
import {
  createContext,
  use,
  useState,
  type PropsWithChildren,
} from "react";
import type {
  ExpenseSplitItemDraft,
  SplitParticipant,
} from "../lib/expense-split";

export type ExpenseItemSplitRequest = {
  currency: CurrencyCode;
  participants: SplitParticipant[];
  item: ExpenseSplitItemDraft;
  onSave: (item: ExpenseSplitItemDraft) => void;
};

type ExpenseItemSplitSessionValue = {
  request: ExpenseItemSplitRequest | undefined;
  open: (request: ExpenseItemSplitRequest) => void;
  clear: () => void;
};

const ExpenseItemSplitSessionContext =
  createContext<ExpenseItemSplitSessionValue | null>(null);

export function ExpenseItemSplitSessionProvider({
  children,
}: PropsWithChildren) {
  const [request, setRequest] = useState<ExpenseItemSplitRequest>();
  return (
    <ExpenseItemSplitSessionContext
      value={{
        request,
        open: setRequest,
        clear: () => setRequest(undefined),
      }}
    >
      {children}
    </ExpenseItemSplitSessionContext>
  );
}

export function useExpenseItemSplitSession() {
  const value = use(ExpenseItemSplitSessionContext);
  if (!value) {
    throw new Error(
      "useExpenseItemSplitSession must be used inside ExpenseItemSplitSessionProvider",
    );
  }
  return value;
}
