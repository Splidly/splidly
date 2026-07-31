import type { CurrencyCode } from "@splidly/shared";
import {
  createContext,
  use,
  useState,
  type PropsWithChildren,
} from "react";
import type { SplitParticipant } from "../lib/expense-split";

export type ExpensePaymentDraft = {
  payerIds: string[];
  payerAmounts: Record<string, string>;
};

export type ExpensePaymentRequest = {
  currency: CurrencyCode;
  totalMinor: bigint;
  participants: SplitParticipant[];
  draft: ExpensePaymentDraft;
  onSave: (draft: ExpensePaymentDraft) => void;
};

type ExpensePaymentSessionValue = {
  request: ExpensePaymentRequest | undefined;
  open: (request: ExpensePaymentRequest) => void;
  clear: () => void;
};

const ExpensePaymentSessionContext =
  createContext<ExpensePaymentSessionValue | null>(null);

export function ExpensePaymentSessionProvider({
  children,
}: PropsWithChildren) {
  const [request, setRequest] = useState<ExpensePaymentRequest>();
  return (
    <ExpensePaymentSessionContext
      value={{
        request,
        open: setRequest,
        clear: () => setRequest(undefined),
      }}
    >
      {children}
    </ExpensePaymentSessionContext>
  );
}

export function useExpensePaymentSession() {
  const value = use(ExpensePaymentSessionContext);
  if (!value) {
    throw new Error(
      "useExpensePaymentSession must be used inside ExpensePaymentSessionProvider",
    );
  }
  return value;
}
