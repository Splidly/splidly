import { Host, Icon, List, ListItem, Text } from "@expo/ui";
import { useTheme } from "../theme";
import type {
  CurrencyNativeListProps,
  CurrencySection,
} from "./currency-native-list.types";

const CHECK_ICON = Icon.select({
  ios: "checkmark",
  android: import("@expo/material-symbols/check.xml"),
});

export type { CurrencySection };

export function CurrencyNativeList({
  sections,
  value,
  query,
  onSelect,
}: CurrencyNativeListProps) {
  const theme = useTheme();

  return (
    <Host
      style={{ flex: 1 }}
      seedColor={theme.primary}
      useViewportSizeMeasurement
    >
      <List>
        {sections.length === 0 ? (
          <ListItem supportingText={`No currencies match “${query}”.`}>
            No currencies found
          </ListItem>
        ) : (
          sections.flatMap((section) => [
            <Text
              key={`${section.title}-header`}
              textStyle={{
                fontSize: 13,
                fontWeight: "600",
                letterSpacing: 0.4,
              }}
            >
              {section.title.toLocaleUpperCase()}
            </Text>,
            ...section.data.map((currency) => (
              <ListItem
                key={currency.code}
                testID={`currency-${currency.code}`}
                supportingText={currency.code}
                trailing={
                  currency.code === value ? (
                    <Icon
                      name={CHECK_ICON}
                      size={20}
                      color={theme.primary}
                      accessibilityLabel="Selected"
                    />
                  ) : undefined
                }
                onPress={() => onSelect(currency.code)}
              >
                {currency.name}
              </ListItem>
            )),
          ])
        )}
      </List>
    </Host>
  );
}
