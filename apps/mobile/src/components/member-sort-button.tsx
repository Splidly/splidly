import { Host, Icon } from "@expo/ui";
import {
  MenuView,
  type MenuAction,
  type MenuComponentRef,
} from "@expo/ui/community/menu";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../theme";
import type { MemberSort } from "./member-sort-button.types";

const memberSortIcon = Icon.select({
  ios: "arrow.up.arrow.down",
  android: import("@expo/material-symbols/sort.xml"),
});

export function MemberSortButton({
  value,
  onValueChange,
}: {
  value: MemberSort;
  onValueChange: (value: MemberSort) => void;
}) {
  const theme = useTheme();
  const menuRef = useRef<MenuComponentRef>(null);
  const actions: MenuAction[] = [
    { id: "share", title: "Share", state: value === "share" ? "on" : "off" },
    { id: "paid", title: "Paid", state: value === "paid" ? "on" : "off" },
    { id: "name", title: "Name", state: value === "name" ? "on" : "off" },
  ];

  const icon = (
    <Host matchContents ignoreSafeArea="all" style={styles.sortIcon}>
      <Icon
        name={memberSortIcon}
        size={17}
        color={theme.primary}
        accessibilityLabel="Sort"
      />
    </Host>
  );
  const buttonStyle = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
  };

  const fallbackButton = (
    <Pressable
      testID="member-sort-button"
      accessibilityRole="button"
      accessibilityLabel={`Sort members, currently by ${value}`}
      accessibilityHint="Opens sorting options"
      hitSlop={8}
      style={({ pressed }) => [
        styles.sortButton,
        buttonStyle,
        { opacity: pressed ? 0.55 : 1 },
      ]}
    >
      {icon}
    </Pressable>
  );

  return (
    <MenuView
      ref={menuRef}
      title="Sort members"
      actions={actions}
      testID="member-sort-menu"
      style={
        process.env.EXPO_OS === "android"
          ? styles.sortMenuTouchTarget
          : undefined
      }
      onPressAction={({ nativeEvent }) => {
        const next = nativeEvent.event;
        if (next === "share" || next === "paid" || next === "name") {
          onValueChange(next);
        }
      }}
    >
      {process.env.EXPO_OS === "android" ? (
        <View
          testID="member-sort-button"
          pointerEvents="none"
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Sort members, currently by ${value}`}
          accessibilityHint="Opens sorting options"
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === "activate") {
              menuRef.current?.show();
            }
          }}
          style={styles.sortMenuTouchTarget}
        >
          <View style={[styles.sortButton, buttonStyle]}>{icon}</View>
        </View>
      ) : (
        fallbackButton
      )}
    </MenuView>
  );
}


const styles = StyleSheet.create({
  sortButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  sortMenuTouchTarget: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  sortIcon: { width: 17, height: 17 },
});
