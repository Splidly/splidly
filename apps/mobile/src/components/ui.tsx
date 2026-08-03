import type { CurrencyCode, Money } from "@splidly/shared";
import { Image } from "expo-image";
import { HeaderHeightContext } from "expo-router/build/react-navigation/elements/Header/HeaderHeightContext";
import {
  Children,
  Fragment,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  findNodeHandle,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type ColorValue,
  type ScrollViewProps,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { avatarColorsFor } from "../lib/avatar-colors";
import {
  formatConvertedMoney,
  formatMoney,
} from "../lib/money-display";
import { spacing, useTheme } from "../theme";
import { AppIcon } from "./app-icon";

function useScrollViewportFill({
  accountForTopInset = false,
  underlapsHeader = false,
  reservedBottomHeight = 0,
  transientBottomClearance = 0,
}: {
  accountForTopInset?: boolean;
  underlapsHeader?: boolean;
  reservedBottomHeight?: number;
  transientBottomClearance?: number;
} = {}) {
  const insets = useSafeAreaInsets();
  const headerHeight = use(HeaderHeightContext) ?? 0;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentMeasurement, setContentMeasurement] = useState({
    height: 0,
    includedBottomPadding: 0,
  });
  const [hasBottomSpacing, setHasBottomSpacing] = useState(false);
  const fillHeight = Math.max(
    0,
    viewportHeight -
      insets.bottom -
      (underlapsHeader && process.env.EXPO_OS === "ios"
        ? headerHeight
        : accountForTopInset
          ? insets.top
          : 0),
  );
  const contentFillHeight = Math.max(0, fillHeight - reservedBottomHeight);
  const bottomPadding =
    reservedBottomHeight +
    transientBottomClearance +
    (hasBottomSpacing ? spacing.md : 0);

  useEffect(() => {
    if (viewportHeight === 0 || contentMeasurement.height === 0) return;
    const unpaddedHeight =
      contentMeasurement.height - contentMeasurement.includedBottomPadding;
    const nextHasBottomSpacing = unpaddedHeight > contentFillHeight + 1;
    setHasBottomSpacing((current) =>
      current === nextHasBottomSpacing ? current : nextHasBottomSpacing,
    );
  }, [
    contentMeasurement,
    contentFillHeight,
    viewportHeight,
  ]);

  return {
    fillStyle:
      viewportHeight > 0
        ? {
            minHeight: fillHeight,
            paddingBottom: bottomPadding > 0 ? bottomPadding : undefined,
          }
        : undefined,
    onLayout: ({
      nativeEvent,
    }: {
      nativeEvent: { layout: { height: number } };
    }) => {
      const nextHeight = nativeEvent.layout.height;
      setViewportHeight((current) =>
        current === nextHeight ? current : nextHeight,
      );
    },
    onContentSizeChange: (_width: number, height: number) => {
      setContentMeasurement({
        height,
        includedBottomPadding: bottomPadding,
      });
    },
  };
}

export function useKeyboardFocusScroll(
  scrollViewRef: RefObject<ScrollView | null>,
  additionalOffset = spacing.md,
) {
  const focusedInputRef = useRef<TextInput | null>(null);
  const [keyboardClearance, setKeyboardClearance] = useState(0);

  const revealFocusedInput = useCallback(() => {
    const inputHandle = findNodeHandle(focusedInputRef.current);
    if (inputHandle === null) return;
    const scrollView = scrollViewRef.current;
    if (!scrollView) return;
    const reveal = (viewportScreenY: number) => {
      scrollView.scrollResponderScrollNativeHandleToKeyboard(
        inputHandle,
        additionalOffset + viewportScreenY,
        true,
      );
    };
    const nativeScrollView = scrollView.getNativeScrollRef();
    if (!nativeScrollView) {
      reveal(0);
      return;
    }
    nativeScrollView.measureInWindow((_x, y) => reveal(y));
  }, [additionalOffset, scrollViewRef]);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (event) => {
      if (!focusedInputRef.current) return;
      setKeyboardClearance(event.endCoordinates.height);
      requestAnimationFrame(revealFocusedInput);
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardClearance(0);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [revealFocusedInput]);

  useEffect(() => {
    if (keyboardClearance <= 0) return;
    requestAnimationFrame(revealFocusedInput);
  }, [keyboardClearance, revealFocusedInput]);

  const focusInput = useCallback(
    (input: TextInput | null) => {
      focusedInputRef.current = input;
      setKeyboardClearance(Keyboard.metrics()?.height ?? 0);
      requestAnimationFrame(revealFocusedInput);
    },
    [revealFocusedInput],
  );

  const blurInput = useCallback((input: TextInput | null) => {
    if (focusedInputRef.current === input) focusedInputRef.current = null;
  }, []);

  return {
    keyboardClearance,
    focusInput,
    blurInput,
    revealFocusedInput,
  };
}

export function Screen({
  children,
  scroll = true,
  bounces = true,
  background = "default",
  accountForTopInset = false,
  underlapsHeader,
  contentContainerStyle,
  scrollViewRef,
  transientBottomClearance = 0,
  bottomOverlay,
  bottomOverlayHeight = 62,
  refreshing,
  onRefresh,
}: PropsWithChildren<{
  scroll?: boolean;
  bounces?: boolean;
  background?: "default" | "sheet";
  accountForTopInset?: boolean;
  underlapsHeader?: boolean;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  scrollViewRef?: RefObject<ScrollView | null>;
  transientBottomClearance?: number;
  bottomOverlay?: ReactNode;
  bottomOverlayHeight?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const backgroundColor =
    background === "sheet" ? theme.sheet : theme.background;
  const { fillStyle, onLayout, onContentSizeChange } = useScrollViewportFill({
    accountForTopInset,
    underlapsHeader:
      underlapsHeader ?? (background === "default" && !accountForTopInset),
    reservedBottomHeight: bottomOverlay ? bottomOverlayHeight : 0,
    transientBottomClearance,
  });
  if (!scroll) {
    return (
      <>
        <View
          style={[
            styles.screen,
            styles.screenContent,
            { backgroundColor },
            bottomOverlay
              ? { paddingBottom: bottomOverlayHeight + insets.bottom }
              : null,
            contentContainerStyle,
          ]}
        >
          {children}
        </View>
        {bottomOverlay ? (
          <ScreenBottomOverlay height={bottomOverlayHeight}>
            {bottomOverlay}
          </ScreenBottomOverlay>
        ) : null}
      </>
    );
  }
  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={[styles.screen, { backgroundColor }]}
        contentContainerStyle={[
          styles.screenContent,
          fillStyle,
          contentContainerStyle,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical={bounces}
        bounces={bounces}
        overScrollMode={bounces ? "auto" : "never"}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
          ) : undefined
        }
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
      >
        {children}
      </ScrollView>
      {bottomOverlay ? (
        <ScreenBottomOverlay height={bottomOverlayHeight}>
          {bottomOverlay}
        </ScreenBottomOverlay>
      ) : null}
    </>
  );
}

function ScreenBottomOverlay({
  height,
  children,
}: PropsWithChildren<{ height: number }>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="screen-bottom-overlay"
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        left: 0,
        height: height + insets.bottom,
        paddingBottom: insets.bottom,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
      }}
    >
      {children}
    </View>
  );
}

export function CollectionScreen({
  isEmpty = false,
  refreshing,
  onRefresh,
  children,
}: PropsWithChildren<{
  isEmpty?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  const theme = useTheme();
  const { fillStyle, onLayout, onContentSizeChange } = useScrollViewportFill({
    underlapsHeader: true,
  });
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.collectionContent,
        fillStyle,
        isEmpty ? styles.emptyCollectionContent : null,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      alwaysBounceVertical={!isEmpty || Boolean(onRefresh)}
      bounces={!isEmpty || Boolean(onRefresh)}
      scrollEnabled={!isEmpty || Boolean(onRefresh)}
      overScrollMode={isEmpty && !onRefresh ? "never" : "auto"}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
        ) : undefined
      }
      onLayout={onLayout}
      onContentSizeChange={onContentSizeChange}
    >
      {children}
    </ScrollView>
  );
}

export function Intro({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <Text style={[styles.intro, { color: theme.muted }]}>
      {children}
    </Text>
  );
}

export function Section({
  title,
  footer,
  children,
}: PropsWithChildren<{ title?: string; footer?: string }>) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.sectionBody,
          { backgroundColor: theme.surface },
        ]}
      >
        {children}
      </View>
      {footer ? (
        <Text style={[styles.sectionFooter, { color: theme.muted }]}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function FormSection({
  title,
  footer,
  children,
}: PropsWithChildren<{ title?: string; footer?: string }>) {
  const rows = Children.toArray(children);
  return (
    <Section
      {...(title ? { title } : {})}
      {...(footer ? { footer } : {})}
    >
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <RowDivider inset={16} /> : null}
          {row}
        </Fragment>
      ))}
    </Section>
  );
}

export function RowDivider({ inset = 64 }: { inset?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: inset,
        backgroundColor: theme.border,
      }}
    />
  );
}

export function ListRow({
  title,
  subtitle,
  subtitleNumberOfLines = 2,
  value,
  valueFallback,
  valueTone = "default",
  leading,
  trailing,
  onPress,
  destructive = false,
  showsDisclosureIndicator = true,
}: {
  title: string;
  subtitle?: string;
  subtitleNumberOfLines?: number;
  value?: string;
  valueFallback?: string;
  valueTone?: "default" | "muted" | "positive" | "negative";
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showsDisclosureIndicator?: boolean;
}) {
  const theme = useTheme();
  const [usesValueFallback, setUsesValueFallback] = useState(false);
  useEffect(() => {
    setUsesValueFallback(false);
  }, [value, valueFallback]);
  const displayedValue =
    usesValueFallback && valueFallback ? valueFallback : value;
  const valueColor =
    valueTone === "positive"
      ? theme.positive
      : valueTone === "negative"
        ? theme.negative
        : valueTone === "muted"
          ? theme.muted
          : theme.text;
  const content = (
    <>
      {leading}
      <View style={styles.rowCopy}>
        <Text
          numberOfLines={1}
          style={[
            styles.rowTitle,
            { color: destructive ? theme.negative : theme.text },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={subtitleNumberOfLines}
            style={[styles.rowSubtitle, { color: theme.muted }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {displayedValue ? (
        <Text
          accessibilityLabel={value}
          numberOfLines={
            valueFallback && !usesValueFallback ? undefined : 1
          }
          onTextLayout={
            valueFallback && !usesValueFallback
              ? (event) => {
                  if (event.nativeEvent.lines.length > 1) {
                    setUsesValueFallback(true);
                  }
                }
              : undefined
          }
          style={[styles.rowValue, { color: valueColor }]}
        >
          {displayedValue}
        </Text>
      ) : null}
      {trailing}
      {onPress && !trailing && showsDisclosureIndicator ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.chevron, { color: theme.subtle }]}
        >
          ›
        </Text>
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        { backgroundColor: pressed ? theme.elevated : "transparent" },
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Avatar({
  name,
  colorKey,
  imageUrl,
  size = 44,
  variant = "person",
}: {
  name: string;
  colorKey?: string | undefined;
  imageUrl?: string | null | undefined;
  size?: number;
  variant?: "person" | "group";
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  useEffect(() => setFailedImageUrl(undefined), [imageUrl]);
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = avatarColorsFor(
    `${variant}:${colorKey ?? name.trim().toLowerCase()}`,
    colorScheme,
  );
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const borderRadius =
    variant === "person" ? size / 2 : Math.round(size * 0.28);
  const showImage = Boolean(imageUrl && imageUrl !== failedImageUrl);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name} picture`}
      style={{
        width: size,
        height: size,
        borderRadius,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        overflow: "hidden",
      }}
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
        <Text
          style={{
            color: colors.foreground,
            fontSize: size * 0.36,
            fontWeight: "700",
            letterSpacing: -0.3,
          }}
        >
          {initials || "?"}
        </Text>
      )}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = "primary",
  compact = false,
  backgroundColor: customBackgroundColor,
  foregroundColor: customForegroundColor,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger" | "plain";
  compact?: boolean;
  backgroundColor?: ColorValue;
  foregroundColor?: ColorValue;
}) {
  const theme = useTheme();
  const backgroundColor =
    customBackgroundColor ??
    (tone === "danger"
      ? theme.negativeSurface
      : tone === "secondary"
        ? theme.elevated
        : tone === "plain"
          ? "transparent"
          : theme.primary);
  const color =
    customForegroundColor ??
    (tone === "danger"
      ? theme.negative
      : tone === "secondary" || tone === "plain"
        ? theme.primary
        : theme.primaryText);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : null,
        {
          backgroundColor,
          opacity: disabled ? 0.42 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function HeaderButton({
  label,
  glyph,
  onPress,
  disabled = false,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const isWord = glyph.length > 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 36,
        minHeight: 36,
        paddingHorizontal: 6,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
      })}
    >
      <Text
        style={{
          color: theme.primary,
          fontSize: isWord ? 16 : 25,
          fontWeight: isWord ? "600" : "500",
        }}
      >
        {glyph}
      </Text>
    </Pressable>
  );
}

export function SheetCloseButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetCloseButton,
        {
          backgroundColor: theme.elevated,
          opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <Text style={[styles.sheetCloseGlyph, { color: theme.text }]}>×</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  leading,
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  leading?: ReactNode;
}) {
  const theme = useTheme();
  const usesNumericKeyboard =
    props.keyboardType === "decimal-pad" ||
    props.keyboardType === "number-pad" ||
    props.keyboardType === "numeric";
  return (
    <View
      style={[
        styles.field,
        props.multiline ? styles.fieldMultiline : null,
      ]}
    >
      {leading}
      {label ? (
        <Text style={[styles.label, { color: theme.text }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        {...props}
        accessibilityLabel={
          props.accessibilityLabel ?? label ?? props.placeholder
        }
        placeholderTextColor={theme.subtle}
        selectionColor={theme.primary}
        clearButtonMode={props.clearButtonMode ?? "never"}
        style={[
          styles.input,
          { color: theme.text },
          props.multiline
            ? styles.multiline
            : usesNumericKeyboard
              ? styles.numericInput
              : styles.textInput,
          props.style,
        ]}
      />
      {hint ? (
        <Text style={[styles.hint, { color: theme.muted }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function BalanceText({
  value,
  prefix,
  size = "regular",
}: {
  value: Money;
  prefix?: string;
  size?: "regular" | "large";
}) {
  const theme = useTheme();
  const minor = BigInt(value.minor);
  const color =
    minor > 0n ? theme.positive : minor < 0n ? theme.negative : theme.muted;
  return (
    <Text
      style={[
        styles.balance,
        size === "large" ? styles.balanceLarge : null,
        { color },
      ]}
    >
      {prefix}
      {formatConvertedMoney(
        minor < 0n ? -minor : minor,
        value.currency as CurrencyCode,
      )}
    </Text>
  );
}

export function MoneyValue({
  minor,
  currency,
}: {
  minor: bigint | string;
  currency: CurrencyCode | string;
}) {
  const theme = useTheme();
  return (
    <Text
      style={[styles.moneyValue, { color: theme.text }]}
    >
      {formatMoney(BigInt(minor), currency as CurrencyCode)}
    </Text>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <AppIcon size={56} style={styles.emptyMark} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {title}
      </Text>
      <Text style={[styles.emptyMessage, { color: theme.muted }]}>
        {message}
      </Text>
      {action}
    </View>
  );
}

export function LoadingState() {
  const theme = useTheme();
  return (
    <View style={styles.state}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

export function ErrorState({ message }: { message?: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.error, { backgroundColor: theme.negativeSurface }]}
    >
      <Text style={{ color: theme.negative, lineHeight: 20 }}>
        {message ?? "Something went wrong. Please try again."}
      </Text>
    </View>
  );
}

export function SelectionPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: selected ? theme.primary : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? theme.primaryText : theme.text,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  collectionContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  emptyCollectionContent: {
    justifyContent: "center",
  },
  screenContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  intro: { fontSize: 15, lineHeight: 21, paddingHorizontal: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: {
    paddingHorizontal: spacing.md,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionBody: {
    borderRadius: 16,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  sectionFooter: {
    paddingHorizontal: spacing.md,
    fontSize: 13,
    lineHeight: 18,
  },
  listRow: {
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, lineHeight: 22 },
  rowSubtitle: { fontSize: 13, lineHeight: 17 },
  rowValue: {
    maxWidth: "38%",
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  chevron: { fontSize: 28, fontWeight: "300", lineHeight: 28 },
  button: {
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: spacing.lg,
  },
  buttonCompact: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  sheetCloseButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseGlyph: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "500",
  },
  field: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  fieldMultiline: {
    minHeight: 124,
    paddingVertical: 13,
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  label: { fontSize: 17 },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 17,
  },
  textInput: {
    textAlign: "right",
  },
  numericInput: {
    textAlign: "right",
  },
  multiline: {
    width: "100%",
    minHeight: 76,
    textAlignVertical: "top",
    textAlign: "left",
  },
  hint: { width: "100%", fontSize: 12, lineHeight: 17 },
  balance: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  balanceLarge: { fontSize: 28, fontWeight: "700", letterSpacing: -0.7 },
  moneyValue: {
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  empty: {
    minHeight: 300,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyMark: {
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyMessage: {
    maxWidth: 310,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  state: { minHeight: 240, justifyContent: "center", alignItems: "center" },
  error: {
    borderRadius: 13,
    borderCurve: "continuous",
    padding: 14,
  },
  pill: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
});
