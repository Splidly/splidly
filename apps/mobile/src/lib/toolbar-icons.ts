import type { Stack } from "expo-router";
import type { ComponentProps } from "react";
import type { ImageSourcePropType } from "react-native";

type ToolbarIcon = NonNullable<
  ComponentProps<typeof Stack.Toolbar.Button>["icon"]
>;

function toolbarIcon(
  ios: ToolbarIcon,
  android: ImageSourcePropType,
): ToolbarIcon {
  return process.env.EXPO_OS === "android" ? android : ios;
}

export const toolbarIcons = {
  add: toolbarIcon(
    "plus",
    require("@expo/material-symbols/add.xml"),
  ),
  close: toolbarIcon(
    "xmark",
    require("@expo/material-symbols/close.xml"),
  ),
  done: toolbarIcon(
    "checkmark",
    require("@expo/material-symbols/check.xml"),
  ),
  edit: toolbarIcon(
    "pencil",
    require("@expo/material-symbols/edit.xml"),
  ),
  invite: toolbarIcon(
    "person.badge.plus",
    require("@expo/material-symbols/person_add.xml"),
  ),
  settings: toolbarIcon(
    "gearshape",
    require("@expo/material-symbols/settings.xml"),
  ),
  settle: toolbarIcon(
    "banknote",
    require("@expo/material-symbols/payments.xml"),
  ),
  statistics: toolbarIcon(
    "chart.bar.xaxis",
    require("@expo/material-symbols/analytics.xml"),
  ),
} as const;
