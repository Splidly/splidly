import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler, Text } from "react-native";
import { NativeExpenseSwipe } from "./native-expense-swipe.android";

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));

jest.mock("@expo/ui/jetpack-compose", () => ({
  ...jest.requireActual("@expo/ui/jetpack-compose"),
  Host: ({ children }: { children: React.ReactNode }) => children,
}));

it("measures swipe row height from its content while keeping the parent width", async () => {
  const view = await render(
    <NativeExpenseSwipe
      row={{
        key: "short-group",
        content: null,
        actionTitle: "Archive",
        onDelete: jest.fn().mockResolvedValue(false),
      }}
    >
      <Text selectable={false}>Short group</Text>
    </NativeExpenseSwipe>,
  );
  const hosts = view.container.queryAll(
    (node) =>
      node.props.matchContentsVertical !== undefined &&
      node.props.matchContentsHorizontal !== undefined,
  );
  expect(hosts).toHaveLength(1);
  expect(hosts[0]!.props.matchContentsVertical).toBe(true);
  expect(hosts[0]!.props.matchContentsHorizontal).toBe(false);
});

it("closes an exposed action on system Back without requesting a deletion", async () => {
  let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
  const listener = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    back = handler;
    return { remove: jest.fn() };
  });
  try {
    const onDelete = jest.fn().mockResolvedValue(false);
    const view = await render(<NativeExpenseSwipe row={{ key: "expense", content: null, onDelete }}><Text selectable={false}>Dinner</Text></NativeExpenseSwipe>);
    const nativeSwipe = () => view.container.queryAll((node) => typeof node.props.closeRequest === "number")[0]!;
    await fireEvent(nativeSwipe(), "revealChange", { nativeEvent: { open: true } });
    await act(async () => { expect(back?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true); });
    expect(nativeSwipe().props.closeRequest).toBe(1);
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent(nativeSwipe(), "revealChange", { nativeEvent: { open: false } });
  } finally {
    listener.mockRestore();
  }
});
