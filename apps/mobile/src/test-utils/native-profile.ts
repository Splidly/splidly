import { fireEvent, type render } from "@testing-library/react-native";
import { useRef } from "react";

type Rendered = Awaited<ReturnType<typeof render>>;

// Native shared objects are unavailable in Jest; keep the same state interface.
export function useMockNativeState<T>(initial: T) {
  return useRef({
    value: initial,
    get() { return this.value; },
    set(value: T) { this.value = value; },
  }).current;
}

export function profileNode(view: Rendered, id: string) {
  const node = view.container.queryAll((item) => typeof item.type === "string" && (
    item.props.testID === id || item.props.modifiers?.some((modifier: { $type: string; testID?: string }) => modifier.$type === "testID" && modifier.testID === id)
  ))[0];
  if (!node) throw new Error(`Native profile element ${id} was not found`);
  return node;
}

export async function pressProfile(view: Rendered, id: string) {
  const list = process.env.EXPO_OS === "ios" ? view.queryByTestId("native-activity-list") : null;
  const row = list?.props.sections.flatMap((section: { rows: { key: string; selectable: boolean }[] }) => section.rows)
    .find((item: { key: string }) => item.key === id);
  if (row) {
    if (row.selectable) await fireEvent(list!, "rowPress", { nativeEvent: { rowKey: id } });
    return;
  }
  const node = profileNode(view, id);
  await fireEvent(node, process.env.EXPO_OS === "android" ? "buttonPressed" : "buttonPress");
}

export async function changeProfileName(view: Rendered, value: string) {
  const field = view.container.queryAll((node) => typeof node.type === "string" && (
    typeof node.props.onTextChange === "function" || typeof node.props.onValueChange === "function"
  ))[0];
  if (!field) throw new Error("Native profile name field was not found");
  await fireEvent(field, process.env.EXPO_OS === "android" ? "valueChange" : "textChange", {
    nativeEvent: { value, text: value, selection: { start: value.length, end: value.length } },
  });
}

export function nativeProfileText(view: Rendered, text: string) {
  return view.container.queryAll((node) => typeof node.type === "string" && node.props.text === text);
}
