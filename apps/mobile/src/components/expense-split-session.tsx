import type { CurrencyCode } from "@splidly/shared";
import {
  createContext,
  use,
  useState,
  type PropsWithChildren,
} from "react";
import type {
  ExpenseSplitDraft,
  SplitParticipant,
} from "../lib/expense-split";

export type ExpenseSplitRequest = {
  currency: CurrencyCode;
  totalMinor: bigint;
  participants: SplitParticipant[];
  draft: ExpenseSplitDraft;
  onSave: (draft: ExpenseSplitDraft) => void;
};

type ExpenseSplitSessionValue = {
  request: ExpenseSplitRequest | undefined;
  open: (request: ExpenseSplitRequest) => void;
  clear: () => void;
};

const ExpenseSplitSessionContext =
  createContext<ExpenseSplitSessionValue | null>(null);

export function ExpenseSplitSessionProvider({
  children,
}: PropsWithChildren) {
  const [request, setRequest] = useState<ExpenseSplitRequest>();
  return (
    <ExpenseSplitSessionContext
      value={{
        request,
        open: setRequest,
        clear: () => setRequest(undefined),
      }}
    >
      {children}
    </ExpenseSplitSessionContext>
  );
}

export function useExpenseSplitSession() {
  const value = use(ExpenseSplitSessionContext);
  if (!value) {
    throw new Error(
      "useExpenseSplitSession must be used inside ExpenseSplitSessionProvider",
    );
  }
  return value;
}
