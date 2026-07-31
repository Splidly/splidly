import {
  groupIconKeys,
  type GroupIconKey,
} from "@splidly/shared";
import { Host, Icon } from "@expo/ui";
import {
  MenuView,
  type MenuAction,
} from "@expo/ui/community/menu";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { groupIconColorsFor } from "../lib/group-colors";

const groupIconOptions = [
  {
    key: "default",
    label: "People",
    image: Icon.select({
      ios: "person.3.fill",
      android: import("@expo/material-symbols/groups.xml"),
    }),
  },
  {
    key: "trip",
    label: "Trip",
    image: Icon.select({
      ios: "airplane",
      android: import("@expo/material-symbols/flight.xml"),
    }),
  },
  {
    key: "home",
    label: "Home",
    image: Icon.select({
      ios: "house.fill",
      android: import("@expo/material-symbols/home.xml"),
    }),
  },
  {
    key: "food",
    label: "Food",
    image: Icon.select({
      ios: "fork.knife",
      android: import("@expo/material-symbols/restaurant.xml"),
    }),
  },
  {
    key: "drinks",
    label: "Drinks",
    image: Icon.select({
      ios: "wineglass.fill",
      android: import("@expo/material-symbols/local_bar.xml"),
    }),
  },
  {
    key: "party",
    label: "Party",
    image: Icon.select({
      ios: "party.popper.fill",
      android: import("@expo/material-symbols/celebration.xml"),
    }),
  },
  {
    key: "beach",
    label: "Beach",
    image: Icon.select({
      ios: "beach.umbrella.fill",
      android: import("@expo/material-symbols/beach_access.xml"),
    }),
  },
  {
    key: "outdoors",
    label: "Outdoors",
    image: Icon.select({
      ios: "mountain.2.fill",
      android: import("@expo/material-symbols/landscape.xml"),
    }),
  },
  {
    key: "car",
    label: "Road trip",
    image: Icon.select({
      ios: "car.fill",
      android: import("@expo/material-symbols/directions_car.xml"),
    }),
  },
  {
    key: "sports",
    label: "Sports",
    image: Icon.select({
      ios: "sportscourt.fill",
      android: import("@expo/material-symbols/sports_soccer.xml"),
    }),
  },
  {
    key: "music",
    label: "Music",
    image: Icon.select({
      ios: "music.note",
      android: import("@expo/material-symbols/music_note.xml"),
    }),
  },
  {
    key: "gift",
    label: "Gift",
    image: Icon.select({
      ios: "gift.fill",
      android: import("@expo/material-symbols/redeem.xml"),
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
    key: "study",
    label: "Study",
    image: Icon.select({
      ios: "graduationcap.fill",
      android: import("@expo/material-symbols/school.xml"),
    }),
  },
  {
    key: "shopping",
    label: "Shopping",
    image: Icon.select({
      ios: "cart.fill",
      android: import("@expo/material-symbols/shopping_cart.xml"),
    }),
  },
  {
    key: "event",
    label: "Event",
    image: Icon.select({
      ios: "calendar",
      android: import("@expo/material-symbols/calendar_month.xml"),
    }),
  },
] as const satisfies readonly {
  key: GroupIconKey;
  label: string;
  image: MenuAction["image"];
}[];

const optionsByKey = new Map(
  groupIconOptions.map((option) => [option.key, option]),
);

export function normalizeGroupIconKey(value: unknown): GroupIconKey {
  return typeof value === "string" &&
    (groupIconKeys as readonly string[]).includes(value)
    ? (value as GroupIconKey)
    : "default";
}

export function groupIconGlyphSize(iconKey: GroupIconKey, size: number) {
  return Math.round(size * (iconKey === "default" ? 0.41 : 0.49));
}

export function GroupIcon({
  iconKey,
  name,
  colorKey,
  color,
  imageUrl,
  size = 44,
  accessibilityRole,
  accessibilityLabel,
}: {
  iconKey: GroupIconKey;
  name: string;
  colorKey?: string | undefined;
  color?: string | null | undefined;
  imageUrl?: string | null | undefined;
  size?: number;
  accessibilityRole?: "button" | "image";
  accessibilityLabel?: string;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  useEffect(() => setFailedImageUrl(undefined), [imageUrl]);
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = groupIconColorsFor(
    color,
    colorKey ?? name.trim().toLowerCase(),
    colorScheme,
  );
  const option = optionsByKey.get(iconKey) ?? groupIconOptions[0];
  const glyphSize = groupIconGlyphSize(iconKey, size);
  const showImage = Boolean(imageUrl && imageUrl !== failedImageUrl);

  return (
    <View
      accessible
      accessibilityRole={accessibilityRole ?? "image"}
      accessibilityLabel={
        accessibilityLabel ??
        (showImage ? `${name} group picture` : `${option.label} group icon`)
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
      {showImage ? (
        <Image
          source={imageUrl!}
          contentFit="cover"
          recyclingKey={imageUrl ?? null}
          transition={120}
          onError={() => setFailedImageUrl(imageUrl ?? undefined)}
          style={{ width: size, height: size }}
        />
      ) : (
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
      )}
    </View>
  );
}

export function GroupIconPicker({
  value,
  onValueChange,
  name,
  colorKey,
  color,
  size = 44,
}: {
  value: GroupIconKey;
  onValueChange: (value: GroupIconKey) => void;
  name: string;
  colorKey?: string | undefined;
  color?: string | null | undefined;
  size?: number;
}) {
  const actions: MenuAction[] = groupIconOptions.map((option) => ({
    id: option.key,
    title: option.label,
    image: option.image,
    state: option.key === value ? "on" : "off",
  }));

  return (
    <MenuView
      title="Group icon"
      actions={actions}
      testID="group-icon-picker"
      onPressAction={({ nativeEvent }) => {
        const nextValue = normalizeGroupIconKey(nativeEvent.event);
        onValueChange(nextValue);
      }}
    >
      <GroupIcon
        iconKey={value}
        name={name}
        colorKey={colorKey}
        color={color}
        size={size}
        accessibilityRole="button"
        accessibilityLabel="Change group icon"
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
