import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Image as CachedImage } from "expo-image";
import { ActivityFriendRow } from "./activity-friend-row.ios";

it.each([
  ["-1000", "You owe 10.00 €"],
  ["1000", "10.00 €"],
  [undefined, "Settled"],
])(
  "renders friend balance %s inside the same kind of native button as expenses",
  async (minor, amount) => {
    const onPress = jest.fn();
    const view = await render(
      <ActivityFriendRow
        name="Alex Morgan"
        colorKey="alex"
        avatarUrl="https://example.com/avatar.jpg"
        subtitle="1 group ledger"
        additionalBalances={1}
        balance={minor ? { currency: "EUR", minor } : undefined}
        onPress={onPress}
      />,
    );
    const row = view.getByTestId("activity-friend-alex");
    expect(row.queryAll((node) => node.props.text === amount)).toHaveLength(1);
    expect(row.queryAll((node) => node.props.text === "+1 more")).toHaveLength(
      1,
    );
    expect(
      row.queryAll(
        (node) =>
          node.props.matchContents !== undefined ||
          node.props.onPress !== undefined,
      ),
    ).toHaveLength(0);
    expect(row.props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "textSelection", value: false }),
    );
    expect(
      row.queryAll(
        (node) =>
          typeof node.type === "string" && node.type.includes("SplidlySwipe"),
      ),
    ).toHaveLength(0);
    const avatar = row.queryAll((node) => node.props.text === "AM")[0]!;
    expect(avatar.props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "frame", width: 44, height: 44 }),
    );
    await fireEvent(row, "buttonPress");
    expect(onPress).toHaveBeenCalledTimes(1);
  },
);

it("renders a cached photo with the same fixed frame as initials", async () => {
  const prefetch = jest.spyOn(CachedImage, "prefetch").mockResolvedValue(true);
  const cache = jest
    .spyOn(CachedImage, "getCachePathAsync")
    .mockResolvedValue("/tmp/avatar.jpg");
  try {
    const view = await render(
      <ActivityFriendRow
        name="Alex Morgan"
        colorKey="alex"
        avatarUrl="https://example.com/alex.jpg"
        subtitle="All settled"
        additionalBalances={0}
        onPress={() => undefined}
      />,
    );
    const row = view.getByTestId("activity-friend-alex");
    await waitFor(() =>
      expect(
        row.queryAll((node) => node.props.uiImage === "file:///tmp/avatar.jpg"),
      ).toHaveLength(1),
    );
    const image = row.queryAll(
      (node) => node.props.uiImage === "file:///tmp/avatar.jpg",
    )[0]!;
    expect(image.props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "frame", width: 44, height: 44 }),
    );
  } finally {
    prefetch.mockRestore();
    cache.mockRestore();
  }
});
