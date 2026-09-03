import {
  allocateByWeights,
  parseDecimalToMinor,
  type CurrencyCode,
} from "@splidly/shared";
import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  expenseItemAllocationModeLabels,
  expenseItemAllocationStatus,
  initializeExpenseItemAllocation,
  type ExpenseItemAllocationMode,
  type ExpenseSplitItemDraft,
} from "../lib/expense-split";
import { currencySymbol, formatMoney } from "../lib/money-display";
import { useTheme } from "../theme";
import { toolbarIcons } from "../lib/toolbar-icons";
import { AllocationFloatingSummary } from "./allocation-floating-summary";
import {
  AllocationHeader,
  AllocationList,
  InlineAmountInput,
} from "./expense-allocation-ui";
import { useExpenseItemSplitSession } from "./expense-item-split-session";
import {
  Avatar,
  ErrorState,
  HeaderButton,
  PrimaryButton,
  Screen,
  SheetCaption,
  useKeyboardFocusScroll,
} from "./ui";

const customModes: ExpenseItemAllocationMode[] = [
  "exact",
  "percentage",
  "shares",
];

const modeDescriptions: Record<ExpenseItemAllocationMode, string> = {
  equal: "Everyone pays the same amount",
  exact: "Enter each person's exact amount",
  percentage: "Assign a percentage to each person",
  shares: "Use relative shares such as 1× or 2×",
};

function itemTotalMinor(
  item: ExpenseSplitItemDraft,
  currency: CurrencyCode,
) {
  try {
    return parseDecimalToMinor(item.amount || "0", currency);
  } catch {
    return 0n;
  }
}

export function ExpenseItemSplitEditor() {
  const theme = useTheme();
  const session = useExpenseItemSplitSession();
  const request = session.request;
  const [draft, setDraft] = useState<ExpenseSplitItemDraft | undefined>(
    request?.item,
  );
  const screenRef = useRef<ScrollView>(null);
  const { keyboardClearance, focusInput, blurInput } =
    useKeyboardFocusScroll(screenRef, 104);

  useEffect(() => {
    if (request) setDraft(request.item);
  }, [request]);

  if (!request || !draft) {
    return (
      <Screen background="sheet">
        <ErrorState message="The item split is no longer available." />
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

  const participants = request.participants
    .filter((person) => draft.participantIds.includes(person.userId))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, undefined, {
        sensitivity: "base",
      }),
    );
  const status = expenseItemAllocationStatus(draft, request.currency);
  const totalMinor = itemTotalMinor(draft, request.currency);
  const equalAmounts =
    participants.length > 0
      ? allocateByWeights(
          totalMinor,
          participants.map(() => 1n),
        )
      : [];
  const modeActions: MenuAction[] = customModes.map((mode) => ({
    id: mode,
    title: expenseItemAllocationModeLabels[mode],
    subtitle: modeDescriptions[mode],
    ...(draft.allocationMode === mode ? { state: "on" as const } : {}),
  }));
  const indicator =
    draft.allocationMode === "exact"
      ? `${formatMoney(status.assignedMinor ?? 0n, request.currency)} / ${formatMoney(totalMinor, request.currency)}`
      : draft.allocationMode === "percentage"
        ? `${Number.isFinite(status.assignedPercentage) ? status.assignedPercentage : 0}% / 100%`
        : `${status.totalShares ?? 0n} total shares`;
  const progress =
    draft.allocationMode === "exact"
      ? totalMinor > 0n
        ? Number(((status.assignedMinor ?? 0n) * 1_000n) / totalMinor) / 1_000
        : 0
      : draft.allocationMode === "percentage"
        ? Number.isFinite(status.assignedPercentage)
          ? (status.assignedPercentage ?? 0) / 100
          : 0
        : status.valid
          ? 1
          : 0;
  const reset = () =>
    setDraft((current) =>
      current
        ? initializeExpenseItemAllocation(
            current,
            current.allocationMode,
            request.currency,
          )
        : current,
    );
  const cancel = () => router.back();
  const done = () => {
    if (!status.valid) return;
    request.onSave(draft);
    router.back();
  };

  return (
    <>
      <Screen
        background="sheet"
        scrollViewRef={screenRef}
        transientBottomClearance={keyboardClearance}
        bottomOverlay={
          <AllocationFloatingSummary
            title={indicator}
            progress={progress}
            complete={status.valid}
          />
        }
        bottomOverlayHeight={88}
      >
        <SheetCaption>Customize item</SheetCaption>
        <View style={{ gap: 8 }}>
          <AllocationHeader title="Split this item" />
          <MenuView
            title="Split this item"
            actions={modeActions}
            testID="item-custom-split-method"
            onPressAction={({ nativeEvent }) => {
              const mode = nativeEvent.event as ExpenseItemAllocationMode;
              if (!customModes.includes(mode)) return;
              setDraft((current) =>
                current
                  ? initializeExpenseItemAllocation(
                      current,
                      mode,
                      request.currency,
                    )
                  : current,
              );
            }}
          >
            <View
              accessibilityRole="button"
              style={{
                minHeight: 62,
                paddingHorizontal: 16,
                paddingVertical: 10,
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
                  style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}
                >
                  {expenseItemAllocationModeLabels[draft.allocationMode]}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 13 }}>
                  {modeDescriptions[draft.allocationMode]}
                </Text>
              </View>
              <Text style={{ color: theme.primary, fontSize: 15, fontWeight: "600" }}>
                Change
              </Text>
            </View>
          </MenuView>
        </View>

        <View style={{ gap: 8 }}>
          <AllocationHeader
            title={
              draft.allocationMode === "exact"
                ? "Amounts"
                : draft.allocationMode === "percentage"
                  ? "Percentages"
                  : "Shares"
            }
            action={draft.allocationMode === "shares" ? "Reset shares" : "Split evenly"}
            onAction={reset}
          />
          <AllocationList>
            {participants.map((person, index) => {
              const key =
                draft.allocationMode === "exact"
                  ? "exactAmounts"
                  : draft.allocationMode === "percentage"
                    ? "percentages"
                    : "shares";
              const suffix =
                draft.allocationMode === "exact"
                  ? currencySymbol(request.currency)
                  : draft.allocationMode === "percentage"
                    ? "%"
                    : "×";
              return (
                <View
                  key={person.userId}
                  style={{
                    minHeight: 56,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Avatar
                    name={person.displayName}
                    colorKey={person.userId}
                    imageUrl={person.avatarUrl}
                    size={36}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      color: theme.text,
                      flex: 1,
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  >
                    {person.displayName}
                  </Text>
                  {draft.allocationMode === "equal" ? (
                    <Text
                      style={{
                        color: theme.muted,
                        fontSize: 14,
                        fontWeight: "600",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {formatMoney(equalAmounts[index] ?? 0n, request.currency)}
                    </Text>
                  ) : (
                    <InlineAmountInput
                      accessibilityLabel={`${person.displayName} item ${
                        draft.allocationMode === "exact"
                          ? "amount"
                          : draft.allocationMode
                      }`}
                      value={draft[key][person.userId] ?? ""}
                      onChangeText={(value) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                [key]: {
                                  ...current[key],
                                  [person.userId]: value,
                                },
                              }
                            : current,
                        )
                      }
                      suffix={suffix}
                      keyboardType={
                        draft.allocationMode === "shares"
                          ? "number-pad"
                          : "decimal-pad"
                      }
                      placeholder={draft.allocationMode === "shares" ? "1" : "0"}
                      width={suffix === "%" || suffix === "×" ? 88 : 104}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  )}
                </View>
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
            {draft.allocationMode === "exact"
              ? "Amounts must add up to this item's cost."
              : draft.allocationMode === "percentage"
                ? "Percentages must add up to exactly 100%."
                : "Shares are relative. For example, 2× pays twice as much as 1×."}
          </Text>
        </View>
      </Screen>
      <Stack.Screen
        options={{
          title: "Customize item",
          ...(process.env.EXPO_OS !== "ios" && {
            headerLeft: () => (
              <HeaderButton label="Cancel item split" glyph="×" onPress={cancel} />
            ),
            headerRight: () => (
              <HeaderButton
                label="Save item split"
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
          icon={toolbarIcons.close}
          accessibilityLabel="Cancel item split"
          onPress={cancel}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={
            process.env.EXPO_OS === "android" ? toolbarIcons.done : undefined
          }
          accessibilityLabel="Save item split"
          disabled={!status.valid}
          onPress={done}
        >
          {process.env.EXPO_OS === "ios" ? "Done" : null}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
