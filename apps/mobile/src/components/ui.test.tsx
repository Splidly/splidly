import { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { HeaderHeightContext } from "expo-router/build/react-navigation/elements/Header/HeaderHeightContext";
import { StyleSheet, Text } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { CollectionScreen, EmptyState, Field, Screen } from "./ui";

function ControlledField() {
  const [value, setValue] = useState("");
  return (
    <Field label="Description" value={value} onChangeText={setValue} />
  );
}

describe("EmptyState", () => {
  it("renders an accessible title and explanation", async () => {
    const view = await render(
      <EmptyState
        title="No friends yet"
        message="Share an invite to get started."
      />,
    );
    expect(view.getByLabelText("Splidly app icon")).toBeTruthy();
    expect(view.getByText("No friends yet")).toBeTruthy();
    expect(view.getByText("Share an invite to get started.")).toBeTruthy();
  });
});

describe("Field", () => {
  it("preserves trailing whitespace in right-aligned text fields", async () => {
    const view = await render(<ControlledField />);
    const input = view.getByLabelText("Description");

    await fireEvent.changeText(input, "Dinner ");

    const updatedInput = view.getByLabelText("Description");
    const inputStyle = StyleSheet.flatten(updatedInput.props.style);
    expect(updatedInput.props.value).toBe("Dinner ");
    expect(inputStyle.textAlign).toBe("right");
  });

  it("keeps numeric fields right aligned", async () => {
    const view = await render(
      <Field
        label="Amount"
        value="12.34"
        onChangeText={jest.fn()}
        keyboardType="decimal-pad"
      />,
    );

    expect(
      StyleSheet.flatten(view.getByLabelText("Amount").props.style).textAlign,
    ).toBe("right");
  });

  it("supports a label-free, left-aligned name input", async () => {
    const view = await render(
      <Field
        accessibilityLabel="Group name"
        placeholder="Group name"
        value=""
        onChangeText={jest.fn()}
        style={{ textAlign: "left" }}
      />,
    );
    const input = view.getByLabelText("Group name");

    expect(input.props.placeholder).toBe("Group name");
    expect(StyleSheet.flatten(input.props.style).textAlign).toBe("left");
  });
});

describe("Screen", () => {
  it("lets the native navigator own insets without flex-created scroll space", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 20, left: 0 }}
      >
        <Screen>
          <Text>Content</Text>
        </Screen>
      </SafeAreaInsetsContext.Provider>,
    );
    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    expect(scrollView).toBeDefined();
    expect(scrollView?.props.contentInsetAdjustmentBehavior).toBe("automatic");
    expect(scrollView?.props.automaticallyAdjustKeyboardInsets).toBeUndefined();
    expect(scrollView?.props.alwaysBounceVertical).toBe(true);
    expect(scrollView?.props.onLayout).toEqual(expect.any(Function));

    if (!scrollView) throw new Error("ScrollView was not rendered");
    await fireEvent(scrollView, "layout", {
      nativeEvent: { layout: { height: 800 } },
    });
    const [resizedScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    const contentStyle = StyleSheet.flatten(
      resizedScrollView?.props.contentContainerStyle,
    );
    expect(contentStyle.flexGrow).toBeUndefined();
    expect(contentStyle.minHeight).toBe(780);
    expect(contentStyle.paddingBottom).toBeUndefined();

    if (!resizedScrollView) throw new Error("ScrollView was not resized");
    await fireEvent(resizedScrollView, "contentSizeChange", 400, 1000);
    const [overflowingScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    const overflowingContentStyle = StyleSheet.flatten(
      overflowingScrollView?.props.contentContainerStyle,
    );
    expect(overflowingContentStyle.paddingBottom).toBe(16);
  });

  it("uses the elevated sheet background without changing scroll behavior", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <Screen background="sheet">
          <Text>Sheet content</Text>
        </Screen>
      </SafeAreaInsetsContext.Provider>,
    );
    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );

    expect(StyleSheet.flatten(scrollView?.props.style).backgroundColor).toBe(
      "#FFFFFF",
    );
    expect(scrollView?.props.contentInsetAdjustmentBehavior).toBe("automatic");
    expect(scrollView?.props.alwaysBounceVertical).toBe(true);
  });

  it("removes the native top inset from headerless viewport fill", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 44, right: 0, bottom: 20, left: 0 }}
      >
        <Screen accountForTopInset bounces={false}>
          <Text>Headerless content</Text>
        </Screen>
      </SafeAreaInsetsContext.Provider>,
    );
    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    if (!scrollView) throw new Error("ScrollView was not rendered");

    await fireEvent(scrollView, "layout", {
      nativeEvent: { layout: { height: 800 } },
    });
    const [resizedScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    const contentStyle = StyleSheet.flatten(
      resizedScrollView?.props.contentContainerStyle,
    );

    expect(contentStyle.minHeight).toBe(736);
    expect(resizedScrollView?.props.bounces).toBe(false);
    expect(resizedScrollView?.props.scrollEnabled).toBeUndefined();
  });

  it("removes the measured native header from an underlapping viewport fill", async () => {
    const view = await render(
      <HeaderHeightContext.Provider value={120}>
        <SafeAreaInsetsContext.Provider
          value={{ top: 44, right: 0, bottom: 20, left: 0 }}
        >
          <Screen underlapsHeader>
            <Text>Underlapping content</Text>
          </Screen>
        </SafeAreaInsetsContext.Provider>
      </HeaderHeightContext.Provider>,
    );
    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    if (!scrollView) throw new Error("ScrollView was not rendered");

    await fireEvent(scrollView, "layout", {
      nativeEvent: { layout: { height: 800 } },
    });
    const [resizedScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    const contentStyle = StyleSheet.flatten(
      resizedScrollView?.props.contentContainerStyle,
    );

    expect(contentStyle.minHeight).toBe(660);
    expect(contentStyle.paddingBottom).toBeUndefined();
  });

  it("reserves a fixed overlay without creating short-screen scroll space", async () => {
    const view = await render(
      <HeaderHeightContext.Provider value={0}>
        <SafeAreaInsetsContext.Provider
          value={{ top: 0, right: 0, bottom: 20, left: 0 }}
        >
          <Screen
            bottomOverlay={<Text>Progress</Text>}
            bottomOverlayHeight={88}
          >
            <Text>Short content</Text>
          </Screen>
        </SafeAreaInsetsContext.Provider>
      </HeaderHeightContext.Provider>,
    );
    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    if (!scrollView) throw new Error("ScrollView was not rendered");

    await fireEvent(scrollView, "layout", {
      nativeEvent: { layout: { height: 800 } },
    });
    const [resizedScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    const shortStyle = StyleSheet.flatten(
      resizedScrollView?.props.contentContainerStyle,
    );
    const overlayStyle = StyleSheet.flatten(
      view.getByTestId("screen-bottom-overlay").props.style,
    );

    expect(shortStyle.minHeight).toBe(780);
    expect(shortStyle.paddingBottom).toBe(88);
    expect(overlayStyle.height).toBe(108);
    expect(overlayStyle.paddingBottom).toBe(20);

    if (!resizedScrollView) throw new Error("ScrollView was not resized");
    await fireEvent(resizedScrollView, "contentSizeChange", 400, 1000);
    const [overflowingScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    const overflowingStyle = StyleSheet.flatten(
      overflowingScrollView?.props.contentContainerStyle,
    );
    expect(overflowingStyle.paddingBottom).toBe(104);
  });

  it("adds temporary focus clearance without changing the resting viewport fill", async () => {
    const view = await render(
      <HeaderHeightContext.Provider value={0}>
        <SafeAreaInsetsContext.Provider
          value={{ top: 0, right: 0, bottom: 20, left: 0 }}
        >
          <Screen
            bottomOverlay={<Text>Save</Text>}
            bottomOverlayHeight={88}
            transientBottomClearance={300}
          >
            <Text>Focused form</Text>
          </Screen>
        </SafeAreaInsetsContext.Provider>
      </HeaderHeightContext.Provider>,
    );
    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    if (!scrollView) throw new Error("ScrollView was not rendered");

    await fireEvent(scrollView, "layout", {
      nativeEvent: { layout: { height: 800 } },
    });
    const [resizedScrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );
    const contentStyle = StyleSheet.flatten(
      resizedScrollView?.props.contentContainerStyle,
    );

    expect(contentStyle.minHeight).toBe(780);
    expect(contentStyle.paddingBottom).toBe(388);
  });
});

describe("CollectionScreen", () => {
  it("centers a confirmed empty state and disables its scroll gesture", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 20, left: 0 }}
      >
        <CollectionScreen isEmpty>
          <EmptyState title="Nothing here" message="Add your first item." />
        </CollectionScreen>
      </SafeAreaInsetsContext.Provider>,
    );
    const [scrollView] = view.container.queryAll(
      (instance) =>
        instance.props.contentInsetAdjustmentBehavior === "automatic",
    );

    expect(scrollView?.props.scrollEnabled).toBe(false);
    expect(scrollView?.props.alwaysBounceVertical).toBe(false);
    expect(scrollView?.props.bounces).toBe(false);
    expect(
      StyleSheet.flatten(scrollView?.props.contentContainerStyle)
        .justifyContent,
    ).toBe("center");
  });
});
