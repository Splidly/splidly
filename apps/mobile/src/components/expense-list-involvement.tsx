import type { CurrencyCode, Money } from "@splidly/shared";
import { Text, View } from "react-native";
import { formatMoney } from "../lib/money-display";
import { useTheme } from "../theme";

type InvolvementKind =
  | "lent"
  | "borrowed"
  | "paid"
  | "received"
  | "settled"
  | "none";

export function ExpenseListInvolvement({
  kind,
  amount,
}: {
  kind: InvolvementKind;
  amount: Money;
}) {
  const theme = useTheme();
  const label =
    kind === "lent"
      ? "You lent"
      : kind === "borrowed"
        ? "You owe"
        : kind === "paid"
          ? "You paid"
          : kind === "received"
            ? "You received"
            : kind === "settled"
              ? "Settled"
              : "Not involved";
  const color =
    kind === "lent"
      ? theme.positive
      : kind === "borrowed"
        ? theme.negative
        : kind === "paid"
          ? theme.negative
          : kind === "received"
            ? theme.positive
            : theme.muted;

  return (
    <View style={{ maxWidth: "38%", alignItems: "flex-end", gap: 1 }}>
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: 10,
          lineHeight: 14,
          fontWeight: "700",
          letterSpacing: 0.35,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {kind !== "none" ? (
        <Text
          numberOfLines={1}
          style={{
            color,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatMoney(amount.minor, amount.currency as CurrencyCode)}
        </Text>
      ) : null}
    </View>
  );
}
