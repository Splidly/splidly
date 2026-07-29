import { Icon, ListItem } from "@expo/ui";
import {
  ContentUnavailableView,
  Host,
  List,
  Section,
} from "@expo/ui/swift-ui";
import { listStyle } from "@expo/ui/swift-ui/modifiers";
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
      {sections.length === 0 ? (
        <ContentUnavailableView
          title="No currencies found"
          systemImage="magnifyingglass"
          description={`No currencies match “${query}”.`}
        />
      ) : (
        <List modifiers={[listStyle("plain")]}>
          {sections.map((section) => (
            <Section key={section.title} title={section.title}>
              {section.data.map((currency) => (
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
              ))}
            </Section>
          ))}
        </List>
      )}
    </Host>
  );
}
