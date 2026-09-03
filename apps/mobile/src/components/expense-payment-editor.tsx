import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  equalPaymentAmounts,
  expensePaymentStatus,
} from "../lib/expense-payments";
import {
  currencySymbol,
  formatMoney,
} from "../lib/money-display";
import { useTheme } from "../theme";
import { toolbarIcons } from "../lib/toolbar-icons";
import {
  type ExpensePaymentDraft,
  useExpensePaymentSession,
} from "./expense-payment-session";
import { AllocationFloatingSummary } from "./allocation-floating-summary";
import {
  AllocationHeader,
  AllocationList,
  AllocationRow,
} from "./expense-allocation-ui";
import {
  ErrorState,
  HeaderButton,
  PrimaryButton,
  Screen,
  useKeyboardFocusScroll,
} from "./ui";

export function ExpensePaymentEditor() {
  const theme = useTheme();
  const session = useExpensePaymentSession();
  const request = session.request;
  const [draft, setDraft] = useState<ExpensePaymentDraft | undefined>(
    request?.draft,
  );
  const screenRef = useRef<ScrollView>(null);
  const { keyboardClearance, focusInput, blurInput } =
    useKeyboardFocusScroll(screenRef, 104);

  useEffect(() => {
    if (request) setDraft(request.draft);
  }, [request]);

  if (!request || !draft) {
    return (
      <Screen>
        <ErrorState message="The payment allocation is no longer available." />
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

  const status = expensePaymentStatus(
    draft.payerIds,
    draft.payerAmounts,
    request.totalMinor,
    request.currency,
  );
  const participants = [...request.participants].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    }),
  );
  const progress =
    request.totalMinor > 0n
      ? Number((status.assignedMinor * 1_000n) / request.totalMinor) /
        1_000
      : 0;
  const progressTitle = `${formatMoney(
    status.assignedMinor,
    request.currency,
  )} of ${formatMoney(request.totalMinor, request.currency)}`;
  const cancel = () => {
    router.back();
  };
  const done = () => {
    if (!status.valid) return;
    request.onSave(draft);
    router.back();
  };
  const togglePayer = (userId: string, enabled: boolean) =>
    setDraft((current) => {
      if (!current) return current;
      const payerIds = enabled
        ? [...new Set([...current.payerIds, userId])]
        : current.payerIds.filter((id) => id !== userId);
      return {
        payerIds,
        payerAmounts: equalPaymentAmounts(
          payerIds,
          request.totalMinor,
          request.currency,
        ),
      };
    });

  return (
    <>
      <Screen
        scrollViewRef={screenRef}
        transientBottomClearance={keyboardClearance}
        bottomOverlay={
          <AllocationFloatingSummary
            title={progressTitle}
            progress={progress}
            complete={status.valid}
          />
        }
        bottomOverlayHeight={88}
      >
        <View style={{ gap: 8 }}>
          <AllocationHeader
            title="Payers"
            actions={[
              {
                label: "Select All",
                onPress: () =>
                  setDraft({
                    payerIds: participants.map((person) => person.userId),
                    payerAmounts: equalPaymentAmounts(
                      participants.map((person) => person.userId),
                      request.totalMinor,
                      request.currency,
                    ),
                  }),
              },
              {
                label: "Deselect All",
                onPress: () => setDraft({ payerIds: [], payerAmounts: {} }),
              },
              ...(draft.payerIds.length > 1
                ? [{
                  label: "Equal amounts",
                  onPress: () =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            payerAmounts: equalPaymentAmounts(
                              current.payerIds,
                              request.totalMinor,
                              request.currency,
                            ),
                          }
                        : current,
                    ),
                }]
                : []),
            ]}
          />
          <AllocationList>
            {participants.map((person) => {
              const selected = draft.payerIds.includes(person.userId);
              const showAmount = selected && draft.payerIds.length > 1;
              return (
                <AllocationRow
                  key={person.userId}
                  userId={person.userId}
                  name={person.displayName}
                  imageUrl={person.avatarUrl}
                  selected={selected}
                  selectionLabel={`${person.displayName} paid`}
                  onSelectedChange={(enabled) =>
                    togglePayer(person.userId, enabled)
                  }
                  {...(showAmount
                    ? {
                        amount:
                          draft.payerAmounts[person.userId] ?? "",
                        onAmountChange: (value: string) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  payerAmounts: {
                                    ...current.payerAmounts,
                                    [person.userId]: value,
                                  },
                                }
                              : current,
                          ),
                        amountLabel: `${person.displayName} paid amount`,
                        suffix: currencySymbol(request.currency),
                        placeholder: "0.00",
                        onAmountFocus: focusInput,
                        onAmountBlur: blurInput,
                      }
                    : selected
                      ? {
                          displayValue: formatMoney(
                            request.totalMinor,
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
            Select everyone who paid. If several people contributed, enter
            their actual amounts.
          </Text>
        </View>
      </Screen>
      <Stack.Screen
        options={{
          title: "Paid by",
          ...(process.env.EXPO_OS !== "ios" && {
            headerLeft: () => (
              <HeaderButton
                label="Cancel payment allocation"
                glyph="×"
                onPress={cancel}
              />
            ),
            headerRight: () => (
              <HeaderButton
                label="Save payment allocation"
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
          accessibilityLabel="Cancel payment allocation"
          onPress={cancel}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={
            process.env.EXPO_OS === "android" ? toolbarIcons.done : undefined
          }
          accessibilityLabel="Save payment allocation"
          disabled={!status.valid}
          onPress={done}
        >
          {process.env.EXPO_OS === "ios" ? "Done" : null}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
