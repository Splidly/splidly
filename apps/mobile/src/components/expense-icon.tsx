import {
  expenseIconKeys,
  normalizeExpenseIconKey,
  type ExpenseIconKey,
} from "@splidly/shared";
import { Host, Icon } from "@expo/ui";
import {
  MenuView,
  type MenuAction,
} from "@expo/ui/community/menu";
import { StyleSheet, useColorScheme, View } from "react-native";
import { semanticIconColorsFor } from "../lib/avatar-colors";

const expenseIconOptions = [
  {
    key: "other",
    label: "Other",
    image: Icon.select({
      ios: "receipt.fill",
      android: import("@expo/material-symbols/receipt_long.xml"),
    }),
  },
  {
    key: "housing",
    label: "Housing",
    image: Icon.select({
      ios: "house.fill",
      android: import("@expo/material-symbols/home.xml"),
    }),
  },
  {
    key: "groceries",
    label: "Groceries",
    image: Icon.select({
      ios: "basket.fill",
      android: import("@expo/material-symbols/shopping_basket.xml"),
    }),
  },
  {
    key: "dining",
    label: "Dining",
    image: Icon.select({
      ios: "fork.knife",
      android: import("@expo/material-symbols/restaurant.xml"),
    }),
  },
  {
    key: "drinks",
    label: "Drinks",
    image: Icon.select({
      ios: "cup.and.saucer.fill",
      android: import("@expo/material-symbols/local_cafe.xml"),
    }),
  },
  {
    key: "transport",
    label: "Transport",
    image: Icon.select({
      ios: "bus.fill",
      android: import("@expo/material-symbols/directions_bus.xml"),
    }),
  },
  {
    key: "fuel",
    label: "Fuel",
    image: Icon.select({
      ios: "fuelpump.fill",
      android: import("@expo/material-symbols/local_gas_station.xml"),
    }),
  },
  {
    key: "travel",
    label: "Travel",
    image: Icon.select({
      ios: "airplane",
      android: import("@expo/material-symbols/flight.xml"),
    }),
  },
  {
    key: "shopping",
    label: "Shopping",
    image: Icon.select({
      ios: "bag.fill",
      android: import("@expo/material-symbols/shopping_bag.xml"),
    }),
  },
  {
    key: "entertainment",
    label: "Entertainment",
    image: Icon.select({
      ios: "film.fill",
      android: import("@expo/material-symbols/movie.xml"),
    }),
  },
  {
    key: "health",
    label: "Health",
    image: Icon.select({
      ios: "cross.case.fill",
      android: import("@expo/material-symbols/medical_services.xml"),
    }),
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    image: Icon.select({
      ios: "pills.fill",
      android: import("@expo/material-symbols/medication.xml"),
    }),
  },
  {
    key: "education",
    label: "Education",
    image: Icon.select({
      ios: "graduationcap.fill",
      android: import("@expo/material-symbols/school.xml"),
    }),
  },
  {
    key: "bills",
    label: "Bills",
    image: Icon.select({
      ios: "bolt.fill",
      android: import("@expo/material-symbols/bolt.xml"),
    }),
  },
  {
    key: "subscriptions",
    label: "Subscriptions",
    image: Icon.select({
      ios: "repeat.circle.fill",
      android: import("@expo/material-symbols/subscriptions.xml"),
    }),
  },
  {
    key: "gifts",
    label: "Gifts",
    image: Icon.select({
      ios: "gift.fill",
      android: import("@expo/material-symbols/redeem.xml"),
    }),
  },
  {
    key: "pets",
    label: "Pets",
    image: Icon.select({
      ios: "pawprint.fill",
      android: import("@expo/material-symbols/pets.xml"),
    }),
  },
  {
    key: "childcare",
    label: "Childcare",
    image: Icon.select({
      ios: "person.2.fill",
      android: import("@expo/material-symbols/child_care.xml"),
    }),
  },
  {
    key: "sports",
    label: "Sports",
    image: Icon.select({
      ios: "figure.run",
      android: import("@expo/material-symbols/sports_soccer.xml"),
    }),
  },
  {
    key: "personal-care",
    label: "Personal care",
    image: Icon.select({
      ios: "sparkles",
      android: import("@expo/material-symbols/spa.xml"),
    }),
  },
  {
    key: "work",
    label: "Work",
    image: Icon.select({
      ios: "briefcase.fill",
      android: import("@expo/material-symbols/work.xml"),
    }),
  },
  {
    key: "finance",
    label: "Finance",
    image: Icon.select({
      ios: "banknote.fill",
      android: import("@expo/material-symbols/account_balance_wallet.xml"),
    }),
  },
  {
    key: "insurance",
    label: "Insurance",
    image: Icon.select({
      ios: "shield.fill",
      android: import("@expo/material-symbols/shield.xml"),
    }),
  },
  {
    key: "taxes",
    label: "Taxes",
    image: Icon.select({
      ios: "building.columns.fill",
      android: import("@expo/material-symbols/account_balance.xml"),
    }),
  },
] as const satisfies readonly {
  key: ExpenseIconKey;
  label: string;
  image: ReturnType<typeof Icon.select>;
}[];

const optionsByKey = new Map(
  expenseIconOptions.map((option) => [option.key, option]),
);

function isExpenseIconKey(value: unknown): value is ExpenseIconKey {
  return (
    typeof value === "string" &&
    (expenseIconKeys as readonly string[]).includes(value)
  );
}

export function ExpenseIcon({
  iconKey,
  name,
  size = 40,
  useNameFallback = true,
  accessibilityRole,
  accessibilityLabel,
}: {
  iconKey: unknown;
  name: string;
  size?: number;
  useNameFallback?: boolean;
  accessibilityRole?: "button" | "image";
  accessibilityLabel?: string;
}) {
  const resolvedIconKey = useNameFallback
    ? normalizeExpenseIconKey(iconKey, name)
    : isExpenseIconKey(iconKey)
      ? iconKey
      : "other";
  const option = optionsByKey.get(resolvedIconKey) ?? expenseIconOptions[0];
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = semanticIconColorsFor(
    `expense:${resolvedIconKey}`,
    colorScheme,
  );
  const glyphSize = Math.round(size * 0.5);

  return (
    <View
      accessible
      accessibilityRole={accessibilityRole ?? "image"}
      accessibilityLabel={
        accessibilityLabel ?? `${option.label} expense icon`
      }
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: colors.background,
        },
      ]}
    >
      <Host
        matchContents
        ignoreSafeArea="all"
        style={{ width: glyphSize, height: glyphSize }}
      >
        <Icon
          name={option.image}
          size={glyphSize}
          color={colors.foreground}
          accessibilityLabel={option.label}
        />
      </Host>
    </View>
  );
}

export function ExpenseIconPicker({
  value,
  automatic,
  onValueChange,
  name,
  size = 40,
}: {
  value: ExpenseIconKey;
  automatic: boolean;
  onValueChange: (value: ExpenseIconKey | undefined) => void;
  name: string;
  size?: number;
}) {
  const automaticImage = Icon.select({
    ios: "wand.and.stars",
    android: import("@expo/material-symbols/wand_stars.xml"),
  });
  const actions: MenuAction[] = [
    {
      id: "automatic",
      title: "Automatic",
      image: automaticImage,
      state: automatic ? "on" : "off",
    },
    ...expenseIconOptions.map((option): MenuAction => ({
      id: option.key,
      title: option.label,
      image: option.image,
      state: !automatic && option.key === value ? "on" : "off",
    })),
  ];
  const option = optionsByKey.get(value) ?? expenseIconOptions[0];

  return (
    <MenuView
      title="Expense category"
      actions={actions}
      testID="expense-icon-picker"
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "automatic") {
          onValueChange(undefined);
          return;
        }
        if (isExpenseIconKey(nativeEvent.event)) {
          onValueChange(nativeEvent.event);
        }
      }}
    >
      <ExpenseIcon
        iconKey={value}
        name={name}
        size={size}
        useNameFallback={automatic}
        accessibilityRole="button"
        accessibilityLabel={`Change expense category. ${
          automatic ? `Automatic: ${option.label}` : option.label
        }`}
      />
    </MenuView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderCurve: "continuous",
  },
});
