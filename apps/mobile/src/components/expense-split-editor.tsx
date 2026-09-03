import { allocateByWeights, formatMinor } from "@splidly/shared";
import {
  MenuView,
  type MenuAction,
} from "@expo/ui/community/menu";
import * as Crypto from "expo-crypto";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  expenseItemAllocationModeLabels,
  expenseSplitModeLabels,
  expenseSplitStatus,
  initializeExpenseItemAllocation,
  type ExpenseSplitDraft,
  type ExpenseSplitMode,
} from "../lib/expense-split";
import {
  currencySymbol,
  formatMoney,
} from "../lib/money-display";
import { useTheme } from "../theme";
import { AllocationFloatingSummary } from "./allocation-floating-summary";
import {
  AllocationHeader,
  AllocationList,
  AllocationRow,
  InlineAmountInput,
} from "./expense-allocation-ui";
import { useExpenseSplitSession } from "./expense-split-session";
import { useExpenseItemSplitSession } from "./expense-item-split-session";
import {
  ErrorState,
  HeaderButton,
  PrimaryButton,
  Screen,
  useKeyboardFocusScroll,
} from "./ui";

const splitModeDescriptions: Record<ExpenseSplitMode, string> = {
  equal: "Everyone selected pays the same amount",
  exact: "Enter the exact amount for each person",
  percentage: "Assign a percentage to each person",
  shares: "Use relative shares such as 1× or 2×",
  itemized: "Assign individual items to people",
};

function isExpenseSplitMode(value: string): value is ExpenseSplitMode {
  return value in expenseSplitModeLabels;
}

export function ExpenseSplitEditor() {
  const theme = useTheme();
  const session = useExpenseSplitSession();
  const itemSplitSession = useExpenseItemSplitSession();
  const request = session.request;
  const [draft, setDraft] = useState<ExpenseSplitDraft | undefined>(
    request?.draft,
  );
  const screenRef = useRef<ScrollView>(null);
  const itemInputRefs = useRef(new Map<string, TextInput>());
  const {
    keyboardClearance,
    focusInput,
    blurInput,
    revealFocusedInput,
  } = useKeyboardFocusScroll(screenRef, 104);
  useEffect(() => {
    if (request) setDraft(request.draft);
  }, [request]);

  if (!request || !draft) {
    return (
      <Screen>
        <ErrorState message="The expense split is no longer available." />
        <PrimaryButton
          label="Close"
          onPress={() => {
            session.clear();
            router.back();
          }}
        />
      </Screen>
    );
  }

  const status = expenseSplitStatus(
    draft,
    request.totalMinor,
    request.currency,
  );
  const participants = [...request.participants].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    }),
  );
  const methodActions: MenuAction[] = (
    Object.keys(expenseSplitModeLabels) as ExpenseSplitMode[]
  ).map((mode) => ({
    id: mode,
    title: expenseSplitModeLabels[mode],
    subtitle: splitModeDescriptions[mode],
    state: draft.mode === mode ? "on" : "off",
  }));

  const cancel = () => {
    router.back();
  };
  const done = () => {
    if (!status.valid) return;
    request.onSave(draft);
    router.back();
  };
  const updateRecord = (
    key: "exactAmounts" | "percentages" | "shares",
    userId: string,
    value: string,
  ) =>
    setDraft((current) =>
      current
        ? { ...current, [key]: { ...current[key], [userId]: value } }
        : current,
    );
  const toggleSelected = (userId: string, enabled: boolean) =>
    setDraft((current) => {
      if (!current) return current;
      const selectedIds = enabled
        ? [...new Set([...current.selectedIds, userId])]
        : current.selectedIds.filter((id) => id !== userId);
      return {
        ...current,
        selectedIds,
        exactAmounts: {
          ...current.exactAmounts,
          [userId]: current.exactAmounts[userId] ?? "0",
        },
        percentages: {
          ...current.percentages,
          [userId]: current.percentages[userId] ?? "0",
        },
        shares: {
          ...current.shares,
          [userId]: current.shares[userId] ?? "1",
        },
      };
    });

  const indicator =
    draft.mode === "exact" || draft.mode === "itemized"
      ? `${formatMoney(
          status.assignedMinor ?? 0n,
          request.currency,
        )} / ${formatMoney(request.totalMinor, request.currency)}`
      : draft.mode === "percentage"
        ? `${Number.isFinite(status.assignedPercentage)
            ? status.assignedPercentage
            : 0}% / 100%`
        : draft.mode === "shares"
          ? `${status.totalShares ?? 0n} total shares`
          : `${draft.selectedIds.length} ${
              draft.selectedIds.length === 1 ? "person" : "people"
            } selected`;

  const participantSummary = (participantIds: string[]) => {
    const names = participants
      .filter((person) => participantIds.includes(person.userId))
      .map((person) => person.displayName);
    if (names.length === 0) return "Choose";
    if (names.length === 1) return names[0]!;
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names[0]} + ${names.length - 1}`;
  };
  const equalAmounts =
    draft.selectedIds.length > 0
      ? allocateByWeights(
          request.totalMinor,
          draft.selectedIds.map(() => 1n),
        )
      : [];
  const equalAmountsByUserId = Object.fromEntries(
    draft.selectedIds.map((userId, index) => [
      userId,
      equalAmounts[index] ?? 0n,
    ]),
  );
  const resetCurrentModeEvenly = () =>
    setDraft((current) => {
      if (!current || current.selectedIds.length === 0) return current;
      if (current.mode === "exact") {
        const amounts = allocateByWeights(
          request.totalMinor,
          current.selectedIds.map(() => 1n),
        );
        return {
          ...current,
          exactAmounts: Object.fromEntries(
            current.selectedIds.map((userId, index) => [
              userId,
              formatMinor(amounts[index] ?? 0n, request.currency),
            ]),
          ),
        };
      }
      if (current.mode === "percentage") {
        const basisPoints = allocateByWeights(
          10_000n,
          current.selectedIds.map(() => 1n),
        );
        return {
          ...current,
          percentages: Object.fromEntries(
            current.selectedIds.map((userId, index) => {
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
          ),
        };
      }
      if (current.mode === "shares") {
        return {
          ...current,
          shares: Object.fromEntries(
            current.selectedIds.map((userId) => [userId, "1"]),
          ),
        };
      }
      return current;
    });
  const selectEveryone = () =>
    setDraft((current) =>
      current
        ? {
            ...current,
            selectedIds: participants.map((person) => person.userId),
          }
        : current,
    );
  const deselectEveryone = () =>
    setDraft((current) =>
      current ? { ...current, selectedIds: [] } : current,
    );
  const assignedRatio =
    draft.mode === "exact" || draft.mode === "itemized"
      ? request.totalMinor > 0n
        ? Number(
            ((status.assignedMinor ?? 0n) * 1_000n) /
              request.totalMinor,
          ) / 1_000
        : 0
      : draft.mode === "percentage"
        ? Number.isFinite(status.assignedPercentage)
          ? (status.assignedPercentage ?? 0) / 100
          : 0
        : status.valid
          ? 1
          : 0;

  return (
    <>
      <Screen
        scrollViewRef={screenRef}
        transientBottomClearance={keyboardClearance}
        bottomOverlay={
          <AllocationFloatingSummary
            title={indicator}
            progress={assignedRatio}
            complete={status.valid}
          />
        }
        bottomOverlayHeight={88}
      >
        <View style={{ gap: 8 }}>
          <AllocationHeader title="Split method" />
          <MenuView
            title="Split method"
            actions={methodActions}
            testID="split-method-picker"
            onPressAction={({ nativeEvent }) => {
              const nextMode = nativeEvent.event;
              if (!isExpenseSplitMode(nextMode)) return;
              setDraft((current) =>
                current
                  ? { ...current, mode: nextMode }
                  : current,
              );
            }}
          >
            <View
              accessibilityRole="button"
              style={{
                minHeight: 68,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: theme.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: theme.text,
                    fontSize: 17,
                    fontWeight: "600",
                  }}
                >
                  {expenseSplitModeLabels[draft.mode]}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 13 }}>
                  {splitModeDescriptions[draft.mode]}
                </Text>
              </View>
              <Text
                style={{
                  color: theme.primary,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                Change
              </Text>
            </View>
          </MenuView>
        </View>

        {draft.mode !== "itemized" ? (
          <View style={{ gap: 8 }}>
            <AllocationHeader
              title={
                draft.mode === "equal"
                  ? "People"
                  : draft.mode === "exact"
                    ? "Custom amounts"
                    : draft.mode === "percentage"
                      ? "Percentages"
                      : "Shares"
              }
              actions={[
                { label: "Select All", onPress: selectEveryone },
                { label: "Deselect All", onPress: deselectEveryone },
                ...(draft.mode !== "equal" && draft.selectedIds.length > 0
                  ? [
                      {
                        label:
                          draft.mode === "exact"
                            ? "Equal amounts"
                            : draft.mode === "percentage"
                              ? "Equal percentages"
                              : "Reset shares",
                        onPress: resetCurrentModeEvenly,
                      },
                    ]
                  : []),
              ]}
            />
            <AllocationList>
              {participants.map((person) => {
                const selected = draft.selectedIds.includes(person.userId);
                const valueKey =
                  draft.mode === "exact"
                    ? "exactAmounts"
                    : draft.mode === "percentage"
                      ? "percentages"
                      : draft.mode === "shares"
                        ? "shares"
                        : undefined;
                return (
                  <AllocationRow
                    key={person.userId}
                    userId={person.userId}
                    name={person.displayName}
                    imageUrl={person.avatarUrl}
                    selected={selected}
                    selectionLabel={`Include ${person.displayName}`}
                    onSelectedChange={(enabled) =>
                      toggleSelected(person.userId, enabled)
                    }
                    {...(selected && valueKey
                      ? {
                          amount: draft[valueKey][person.userId] ?? "",
                          onAmountChange: (value: string) =>
                            updateRecord(valueKey, person.userId, value),
                          amountLabel: `${person.displayName} ${
                            valueKey === "exactAmounts"
                              ? "amount"
                              : valueKey === "percentages"
                                ? "percentage"
                                : "shares"
                          }`,
                          suffix:
                            valueKey === "exactAmounts"
                              ? currencySymbol(request.currency)
                              : valueKey === "percentages"
                                ? "%"
                                : "×",
                          keyboardType:
                            valueKey === "shares"
                              ? ("number-pad" as const)
                              : ("decimal-pad" as const),
                          placeholder:
                            valueKey === "shares" ? "1" : "0",
                          onAmountFocus: focusInput,
                          onAmountBlur: blurInput,
                        }
                      : selected && draft.mode === "equal"
                        ? {
                            displayValue: formatMoney(
                              equalAmountsByUserId[person.userId] ?? 0n,
                              request.currency,
                            ),
                          }
                        : {})}
                  />
                );
              })}
            </AllocationList>
            <Text
              style={{
                color: theme.muted,
                paddingHorizontal: 4,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {draft.mode === "equal"
                ? "Everyone selected shares the expense equally."
                : draft.mode === "exact"
                  ? "The amounts must add up to the expense total."
                  : draft.mode === "percentage"
                    ? "The percentages must add up to exactly 100%."
                    : "Zero shares are allowed; at least one share is required overall."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <AllocationHeader title="Items" />
            {draft.items.map((item, itemIndex) => {
              const peopleActions: MenuAction[] = [
                {
                  id: "__selection__",
                  title: "Selection",
                  displayInline: true,
                  subactions: [
                    {
                      id: "__select_all__",
                      title: "Select All",
                      image: "checkmark.circle",
                    },
                    {
                      id: "__deselect_all__",
                      title: "Deselect All",
                      image: "circle",
                    },
                  ],
                },
                {
                  id: "__people__",
                  title: "People",
                  displayInline: true,
                  subactions: participants.map((person) => ({
                    id: person.userId,
                    title: person.displayName,
                    state: item.participantIds.includes(person.userId)
                      ? ("on" as const)
                      : ("off" as const),
                  })),
                },
              ];
              const allocationActions: MenuAction[] = [
                {
                  id: "equal",
                  title: "Equally",
                  ...(item.allocationMode === "equal"
                    ? { state: "on" as const }
                    : {}),
                },
                {
                  id: "custom",
                  title: "Customize…",
                  ...(item.allocationMode !== "equal"
                    ? { state: "on" as const }
                    : {}),
                  ...(item.participantIds.length === 0
                    ? { attributes: { disabled: true } }
                    : {}),
                },
              ];
              const updateItemParticipants = (
                candidate: typeof item,
                participantIds: string[],
              ) => {
                const updated = { ...candidate, participantIds };
                return candidate.allocationMode === "equal"
                  ? updated
                  : initializeExpenseItemAllocation(
                      updated,
                      candidate.allocationMode,
                      request.currency,
                    );
              };
              const openCustomItemSplit = () => {
                if (item.participantIds.length === 0) return;
                const customItem =
                  item.allocationMode === "equal"
                    ? initializeExpenseItemAllocation(
                        item,
                        "exact",
                        request.currency,
                      )
                    : item;
                itemSplitSession.open({
                  currency: request.currency,
                  participants,
                  item: customItem,
                  onSave: (savedItem) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            items: current.items.map((candidate) =>
                              candidate.id === savedItem.id
                                ? savedItem
                                : candidate,
                            ),
                          }
                        : current,
                    ),
                });
                router.push("/expense/item-split");
              };
              return (
                <View
                  key={item.id}
                  style={{
                    overflow: "hidden",
                    borderRadius: 16,
                    borderCurve: "continuous",
                    backgroundColor: theme.surface,
                  }}
                >
                  <View
                    style={{
                      minHeight: 64,
                      paddingHorizontal: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <TextInput
                      ref={(input) => {
                        const key = `${item.id}:name`;
                        if (input) itemInputRefs.current.set(key, input);
                        else itemInputRefs.current.delete(key);
                      }}
                      accessibilityLabel={`Item ${itemIndex + 1} name`}
                      value={item.description}
                      onChangeText={(description) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                items: current.items.map((candidate) =>
                                  candidate.id === item.id
                                    ? { ...candidate, description }
                                    : candidate,
                                ),
                              }
                            : current,
                        )
                      }
                      onFocus={() =>
                        focusInput(
                          itemInputRefs.current.get(`${item.id}:name`) ?? null,
                        )
                      }
                      onBlur={() =>
                        blurInput(
                          itemInputRefs.current.get(`${item.id}:name`) ?? null,
                        )
                      }
                      onContentSizeChange={() =>
                        requestAnimationFrame(revealFocusedInput)
                      }
                      placeholder="Item name (optional)"
                      placeholderTextColor={theme.subtle}
                      selectionColor={theme.primary}
                      style={{
                        color: theme.text,
                        flex: 1,
                        minWidth: 60,
                        padding: 0,
                        fontSize: 17,
                        fontWeight: "600",
                      }}
                    />
                    <InlineAmountInput
                      accessibilityLabel={`Item ${itemIndex + 1} cost`}
                      value={item.amount}
                      onChangeText={(amount) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                items: current.items.map((candidate) =>
                                  candidate.id === item.id
                                    ? { ...candidate, amount }
                                    : candidate,
                                ),
                              }
                            : current,
                        )
                      }
                      suffix={currencySymbol(request.currency)}
                      placeholder="0.00"
                      width={96}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove item ${itemIndex + 1}`}
                      hitSlop={8}
                      onPress={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                items: current.items.filter(
                                  (candidate) => candidate.id !== item.id,
                                ),
                              }
                            : current,
                        )
                      }
                      style={({ pressed }) => ({
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: theme.elevated,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: theme.muted,
                          fontSize: 21,
                          lineHeight: 23,
                        }}
                      >
                        ×
                      </Text>
                    </Pressable>
                  </View>
                  <View
                    style={{
                      height: 1,
                      marginLeft: 16,
                      backgroundColor: theme.border,
                    }}
                  />
                  <MenuView
                    title="Who had this?"
                    actions={peopleActions}
                    testID={`item-people-picker-${itemIndex}`}
                    onPressAction={({ nativeEvent }) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              items: current.items.map((candidate) => {
                                if (candidate.id !== item.id) return candidate;
                                if (nativeEvent.event === "__select_all__") {
                                  return updateItemParticipants(
                                    candidate,
                                    participants.map(
                                      (person) => person.userId,
                                    ),
                                  );
                                }
                                if (
                                  nativeEvent.event === "__deselect_all__"
                                ) {
                                  return updateItemParticipants(candidate, []);
                                }
                                const included =
                                  candidate.participantIds.includes(
                                    nativeEvent.event,
                                  );
                                return updateItemParticipants(
                                  candidate,
                                  included
                                    ? candidate.participantIds.filter(
                                        (id) => id !== nativeEvent.event,
                                      )
                                    : [
                                        ...candidate.participantIds,
                                        nativeEvent.event,
                                      ],
                                );
                              }),
                            }
                          : current,
                      )
                    }
                  >
                    <View
                      accessibilityRole="button"
                      style={{
                        minHeight: 52,
                        paddingHorizontal: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Text style={{ color: theme.text, fontSize: 17 }}>
                        For
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: theme.primary,
                          flex: 1,
                          textAlign: "right",
                          fontSize: 15,
                          fontWeight: "600",
                        }}
                      >
                        {participantSummary(item.participantIds)}
                      </Text>
                      <Text style={{ color: theme.subtle, fontSize: 24 }}>
                        ›
                      </Text>
                    </View>
                  </MenuView>
                  <View
                    style={{
                      height: 1,
                      marginLeft: 16,
                      backgroundColor: theme.border,
                    }}
                  />
                  <MenuView
                    title="Split this item"
                    actions={allocationActions}
                    testID={`item-allocation-picker-${itemIndex}`}
                    onPressAction={({ nativeEvent }) => {
                      if (nativeEvent.event === "equal") {
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                items: current.items.map((candidate) =>
                                  candidate.id === item.id
                                    ? initializeExpenseItemAllocation(
                                        candidate,
                                        "equal",
                                        request.currency,
                                      )
                                    : candidate,
                                ),
                              }
                            : current,
                        );
                        return;
                      }
                      if (nativeEvent.event === "custom") {
                        openCustomItemSplit();
                      }
                    }}
                  >
                    <View
                      accessibilityRole="button"
                      style={{
                        minHeight: 52,
                        paddingHorizontal: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Text style={{ color: theme.text, fontSize: 17 }}>
                        Split
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: theme.primary,
                          flex: 1,
                          textAlign: "right",
                          fontSize: 15,
                          fontWeight: "600",
                        }}
                      >
                        {expenseItemAllocationModeLabels[item.allocationMode]}
                      </Text>
                      <Text style={{ color: theme.subtle, fontSize: 24 }}>
                        ›
                      </Text>
                    </View>
                  </MenuView>
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        items: [
                          ...current.items,
                          {
                            id: Crypto.randomUUID(),
                            description: "",
                            amount: "",
                            participantIds: [],
                            allocationMode: "equal",
                            exactAmounts: {},
                            percentages: {},
                            shares: {},
                          },
                        ],
                      }
                    : current,
                )
              }
              style={({ pressed }) => ({
                minHeight: 52,
                borderRadius: 14,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.surface,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text
                style={{
                  color: theme.primary,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                ＋ Add item
              </Text>
            </Pressable>
            <Text
              style={{
                color: theme.muted,
                paddingHorizontal: 4,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              Item costs must add up to the expense total. Each item can be
              split equally or customized with amounts, percentages, or shares.
            </Text>
          </View>
        )}
      </Screen>
      <Stack.Screen
        options={{
          title: "Split expense",
          ...(process.env.EXPO_OS !== "ios" && {
            headerLeft: () => (
              <HeaderButton label="Cancel split" glyph="×" onPress={cancel} />
            ),
            headerRight: () => (
              <HeaderButton
                label="Save split"
                glyph="Done"
                disabled={!status.valid}
                onPress={done}
              />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="xmark"
          accessibilityLabel="Cancel split"
          onPress={cancel}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Save split"
          disabled={!status.valid}
          onPress={done}
        >
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
