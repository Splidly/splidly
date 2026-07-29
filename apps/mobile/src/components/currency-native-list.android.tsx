import {
  Host,
  Icon,
  LazyColumn,
  ListItem,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  padding,
  testID,
} from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "../theme";
import type {
  CurrencyNativeListProps,
  CurrencySection,
} from "./currency-native-list.types";

const CHECK_ICON = require("@expo/material-symbols/check.xml");

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
      <LazyColumn>
        {sections.length === 0 ? (
          <ListItem>
            <ListItem.HeadlineContent>
              <Text>No currencies found</Text>
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <Text>{`No currencies match “${query}”.`}</Text>
            </ListItem.SupportingContent>
          </ListItem>
        ) : (
          sections.flatMap((section) => [
            <Text
              key={`${section.title}-header`}
              style={{ typography: "labelMedium" }}
              modifiers={[padding(16, 20, 16, 8)]}
            >
              {section.title.toLocaleUpperCase()}
            </Text>,
            ...section.data.map((currency) => (
              <ListItem
                key={currency.code}
                modifiers={[
                  clickable(() => onSelect(currency.code)),
                  testID(`currency-${currency.code}`),
                ]}
              >
                <ListItem.HeadlineContent>
                  <Text>{currency.name}</Text>
                </ListItem.HeadlineContent>
                <ListItem.SupportingContent>
                  <Text>{currency.code}</Text>
                </ListItem.SupportingContent>
                {currency.code === value ? (
                  <ListItem.TrailingContent>
                    <Icon
                      source={CHECK_ICON}
                      size={20}
                      tint={theme.primary}
                      contentDescription="Selected"
                    />
                  </ListItem.TrailingContent>
                ) : null}
              </ListItem>
            )),
          ])
        )}
      </LazyColumn>
    </Host>
  );
}
