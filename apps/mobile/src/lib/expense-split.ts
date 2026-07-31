import {
  allocateByWeights,
  formatMinor,
  parseDecimalToMinor,
  splitSourceAmount,
  type CurrencyCode,
  type SplitInput,
} from "@splidly/shared";

export type SplitParticipant = {
  userId: string;
  displayName: string;
  homeCurrency: string;
  avatarUrl?: string | null | undefined;
};

export type ExpenseSplitMode = SplitInput["mode"];

export type ExpenseSplitDraft = {
  mode: ExpenseSplitMode;
  selectedIds: string[];
  exactAmounts: Record<string, string>;
  percentages: Record<string, string>;
  shares: Record<string, string>;
  items: {
    id: string;
    description: string;
    amount: string;
    participantIds: string[];
  }[];
};

export const expenseSplitModeLabels: Record<ExpenseSplitMode, string> = {
  equal: "Split evenly",
  exact: "Custom amount",
  percentage: "Percentage",
  shares: "Shares",
  itemized: "Itemized split",
};

function equalPercentages(ids: readonly string[]) {
  if (ids.length === 0) return {};
  const basisPoints = allocateByWeights(
    10_000n,
    ids.map(() => 1n),
  );
  return Object.fromEntries(
    ids.map((userId, index) => {
      const value = basisPoints[index] ?? 0n;
      const whole = value / 100n;
      const fraction = value % 100n;
      return [
        userId,
        fraction === 0n
          ? whole.toString()
          : `${whole}.${fraction.toString().padStart(2, "0")}`,
      ];
    }),
  );
}

function equalExactAmounts(
  ids: readonly string[],
  totalMinor: bigint,
  currency: CurrencyCode,
) {
  if (ids.length === 0) return {};
  const amounts = allocateByWeights(
    totalMinor,
    ids.map(() => 1n),
  );
  return Object.fromEntries(
    ids.map((userId, index) => [
      userId,
      formatMinor(amounts[index] ?? 0n, currency),
    ]),
  );
}

export function createExpenseSplitDraft(
  participants: readonly SplitParticipant[],
  totalMinor: bigint,
  currency: CurrencyCode,
): ExpenseSplitDraft {
  const selectedIds = participants.map((participant) => participant.userId);
  return {
    mode: "equal",
    selectedIds,
    exactAmounts: equalExactAmounts(selectedIds, totalMinor, currency),
    percentages: equalPercentages(selectedIds),
    shares: Object.fromEntries(selectedIds.map((userId) => [userId, "1"])),
    items: [],
  };
}

export function expenseSplitDraftFromInput(
  input: SplitInput,
  participants: readonly SplitParticipant[],
  totalMinor: bigint,
  currency: CurrencyCode,
): ExpenseSplitDraft {
  const defaults = createExpenseSplitDraft(
    participants,
    totalMinor,
    currency,
  );
  if (input.mode === "equal") {
    return {
      ...defaults,
      mode: input.mode,
      selectedIds: input.participantIds,
    };
  }
  if (input.mode === "itemized") {
    return {
      ...defaults,
      mode: input.mode,
      selectedIds: [
        ...new Set(input.items.flatMap((item) => item.participantIds)),
      ],
      items: input.items.map((item) => ({
        id: item.id,
        description: item.description,
        amount: formatMinor(BigInt(item.amountMinor), currency),
        participantIds: item.participantIds,
      })),
    };
  }

  const selectedIds = input.shares.map((share) => share.userId);
  if (input.mode === "exact") {
    return {
      ...defaults,
      mode: input.mode,
      selectedIds,
      exactAmounts: Object.fromEntries(
        input.shares.map((share) => [
          share.userId,
          formatMinor(BigInt(share.amountMinor), currency),
        ]),
      ),
    };
  }
  if (input.mode === "percentage") {
    return {
      ...defaults,
      mode: input.mode,
      selectedIds,
      percentages: Object.fromEntries(
        input.shares.map((share) => [
          share.userId,
          share.percentage,
        ]),
      ),
    };
  }
  return {
    ...defaults,
    mode: input.mode,
    selectedIds,
    shares: Object.fromEntries(
      input.shares.map((share) => [share.userId, share.shares]),
    ),
  };
}

export type ExpenseSplitStatus = {
  valid: boolean;
  input?: SplitInput;
  assignedMinor: bigint | undefined;
  assignedPercentage: number | undefined;
  totalShares: bigint | undefined;
  message: string;
};

export function expenseSplitStatus(
  draft: ExpenseSplitDraft,
  totalMinor: bigint,
  currency: CurrencyCode,
): ExpenseSplitStatus {
  let assignedMinor: bigint | undefined;
  let assignedPercentage: number | undefined;
  let totalShares: bigint | undefined;
  try {
    let input: SplitInput;

    if (draft.mode === "equal") {
      if (draft.selectedIds.length === 0) {
        throw new Error("Select at least one person");
      }
      input = { mode: "equal", participantIds: draft.selectedIds };
    } else if (draft.mode === "exact") {
      const shares = draft.selectedIds.map((userId) => ({
        userId,
        amountMinor: parseDecimalToMinor(
          draft.exactAmounts[userId] ?? "0",
          currency,
        ).toString(),
      }));
      if (shares.some((share) => BigInt(share.amountMinor) < 0n)) {
        throw new Error("Custom amounts cannot be negative");
      }
      assignedMinor = shares.reduce(
        (sum, share) => sum + BigInt(share.amountMinor),
        0n,
      );
      input = { mode: "exact", shares };
    } else if (draft.mode === "percentage") {
      const shares = draft.selectedIds.map((userId) => ({
        userId,
        percentage: (draft.percentages[userId] ?? "0")
          .trim()
          .replace(",", "."),
      }));
      assignedPercentage = shares.reduce(
        (sum, share) => sum + Number(share.percentage || "0"),
        0,
      );
      input = { mode: "percentage", shares };
    } else if (draft.mode === "shares") {
      const shares = draft.selectedIds.map((userId) => ({
        userId,
        shares: (draft.shares[userId] ?? "0").trim(),
      }));
      if (shares.some((share) => !/^\d+$/.test(share.shares))) {
        throw new Error("Shares must be whole numbers");
      }
      totalShares = shares.reduce(
        (sum, share) => sum + BigInt(share.shares),
        0n,
      );
      input = { mode: "shares", shares };
    } else {
      const items = draft.items.map((item) => ({
        id: item.id,
        description: item.description.trim(),
        amountMinor: parseDecimalToMinor(
          item.amount || "0",
          currency,
        ).toString(),
        participantIds: item.participantIds,
      }));
      if (items.length === 0) throw new Error("Add at least one item");
      if (items.some((item) => item.description.length === 0)) {
        throw new Error("Every item needs a name");
      }
      if (items.some((item) => item.participantIds.length === 0)) {
        throw new Error("Assign every item to at least one person");
      }
      if (items.some((item) => BigInt(item.amountMinor) <= 0n)) {
        throw new Error("Every item needs a positive amount");
      }
      assignedMinor = items.reduce(
        (sum, item) => sum + BigInt(item.amountMinor),
        0n,
      );
      input = { mode: "itemized", items };
    }

    splitSourceAmount(totalMinor, input);
    return {
      valid: true,
      input,
      assignedMinor,
      assignedPercentage,
      totalShares,
      message: "Fully assigned",
    };
  } catch (cause) {
    return {
      valid: false,
      assignedMinor,
      assignedPercentage,
      totalShares,
      message:
        cause instanceof Error ? cause.message : "Complete the expense split",
    };
  }
}

export function expenseSplitSummary(
  draft: ExpenseSplitDraft,
): string {
  if (draft.mode === "itemized") {
    return `${draft.items.length} ${
      draft.items.length === 1 ? "item" : "items"
    }`;
  }
  const people = draft.selectedIds.length;
  return `${expenseSplitModeLabels[draft.mode]} · ${people} ${
    people === 1 ? "person" : "people"
  }`;
}

export function expenseSplitParticipantIds(
  draft: ExpenseSplitDraft | undefined,
): string[] {
  if (!draft) return [];
  return draft.mode === "itemized"
    ? [...new Set(draft.items.flatMap((item) => item.participantIds))]
    : draft.selectedIds;
}
