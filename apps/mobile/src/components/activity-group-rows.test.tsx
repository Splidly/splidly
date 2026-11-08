import { fireEvent, render } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { ActivityGroupRow } from "./activity-group-row.ios";
import { memberBalanceRow } from "./member-balance-list";

beforeEach(() => {
  jest.spyOn(ReactNative.Dimensions, "get").mockReturnValue({
    width: 390, height: 844, scale: 3, fontScale: 1,
  });
});
afterEach(() => jest.restoreAllMocks());

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    FadeIn: { duration: () => undefined },
    FadeOut: { duration: () => undefined },
  };
});

it("keeps group identity and both debt directions in an expense-style native row", async () => {
  const onPress = jest.fn();
  const view = await render(
    <ActivityGroupRow
      id="group"
      name="Lisbon"
      iconKey="trip"
      balance={{ currency: "EUR", minor: "425" }}
      memberBalances={[
        {
          userId: "alex",
          displayName: "Alex",
          balance: { currency: "EUR", minor: "-800" },
        },
        {
          userId: "sam",
          displayName: "Sam",
          balance: { currency: "EUR", minor: "1225" },
        },
      ]}
      onPress={onPress}
    />,
  );
  const row = view.getByTestId("activity-group-group");
  for (const text of ["Lisbon", "You are owed", "4.25 €"]) {
    expect(row.queryAll((node) => node.props.text === text)).toHaveLength(1);
  }
  for (const [label, amount] of [
    ["You owe Alex", " 8.00 €"],
    ["Sam owes you", " 12.25 €"],
  ]) {
    const labelNode = row.queryAll((node) => node.props.text === label)[0]!;
    const amountNode = row.queryAll((node) => node.props.text === amount)[0]!;
    expect(labelNode).toBeTruthy();
    expect(amountNode).toBeTruthy();
    expect(amountNode.props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "font", weight: "semibold", size: 13 }),
    );
    const line = labelNode.parent!;
    const labelColor = line.props.modifiers.find(
      (modifier: { $type: string }) => modifier.$type === "foregroundStyle",
    );
    const amountColor = amountNode.props.modifiers.find(
      (modifier: { $type: string }) => modifier.$type === "foregroundStyle",
    );
    expect(labelColor).not.toEqual(amountColor);
  }
  const icon = row.queryAll((node) => node.props.systemName === "airplane")[0]!;
  expect(icon.props.modifiers).toContainEqual(
    expect.objectContaining({ $type: "frame", width: 52, height: 52 }),
  );
  expect(
    row.queryAll(
      (node) =>
        node.props.onPress !== undefined ||
        node.props.matchContents !== undefined,
    ),
  ).toHaveLength(0);
  expect(row.props.modifiers).toContainEqual(
    expect.objectContaining({ $type: "textSelection", value: false }),
  );
  await fireEvent(row, "buttonPress");
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("keeps a zero-net group with open debts distinct from a settled group", async () => {
  const view = await render(
    <ActivityGroupRow
      id="group"
      name="Trip"
      iconKey="trip"
      balance={{ currency: "EUR", minor: "0" }}
      memberBalances={[
        {
          userId: "alex",
          displayName: "Alex",
          balance: { currency: "EUR", minor: "-100" },
        },
        {
          userId: "sam",
          displayName: "Sam",
          balance: { currency: "EUR", minor: "100" },
        },
      ]}
      onPress={() => undefined}
    />,
  );
  const row = view.getByTestId("activity-group-group");
  expect(
    row.queryAll((node) => node.props.text === "Net balance"),
  ).toHaveLength(1);
  expect(row.queryAll((node) => node.props.text === "Settled up")).toHaveLength(
    0,
  );
});

it("provides the member and its details for the native outline list", () => {
  const row = memberBalanceRow({ userId: "me", displayName: "Sam", avatarUrl: null,
    isViewer: true, owes: { currency: "EUR", minor: "0" }, lent: { currency: "EUR", minor: "0" }, relationships: [],
  }, jest.fn());
  expect(row.settings).toMatchObject({ title: "Sam (You)", value: "Settled up", avatar: true, showsDisclosure: false, disclosure: true, details: [{ title: "No outstanding balances.", value: "", tone: "muted" }] });
  expect(row.content).toBeNull();
});

it("reserves measured total width only beside the heading and first balance line", async () => {
  const view = await render(
    <ActivityGroupRow
      id="reference"
      name="Bengel Urlaub 2026"
      iconKey="trip"
      balance={{ currency: "EUR", minor: "51871" }}
      memberBalances={[
        {
          userId: "oleg",
          displayName: "Oleg",
          balance: { currency: "EUR", minor: "22095" },
        },
        {
          userId: "lin",
          displayName: "Lin",
          balance: { currency: "EUR", minor: "29776" },
        },
      ]}
      onPress={() => undefined}
    />,
  );
  const total = view.getByTestId("group-total-reference");
  const trailingPadding = (id: string) =>
    view
      .getByTestId(id)
      .props.modifiers.find(
        (modifier: { $type: string }) => modifier.$type === "padding",
      ).trailing;
  for (const width of [80, 112]) {
    await fireEvent(total, "globalEvent", {
      nativeEvent: { onGeometryChange: { x: 0, y: 0, width, height: 34 } },
    });
    expect(trailingPadding("group-name-reference")).toBe(width + 8);
    expect(trailingPadding("group-balance-positive-oleg")).toBe(width + 8);
    expect(trailingPadding("group-balance-positive-lin")).toBe(0);
  }
  expect(
    view.getByTestId("group-name-reference").props.modifiers,
  ).toContainEqual(expect.objectContaining({ $type: "frame", minHeight: 24 }));
  expect(
    view.getByTestId("group-balance-positive-lin").props.modifiers,
  ).toContainEqual(expect.objectContaining({ $type: "frame", minHeight: 17 }));
  await fireEvent(total, "globalEvent", {
    nativeEvent: { onGeometryChange: { x: 0, y: 0, width: 220, height: 34 } },
  });
  expect(trailingPadding("group-name-reference")).toBe(0);
  await fireEvent(view.getByTestId("group-layout-reference"), "globalEvent", {
    nativeEvent: { onGeometryChange: { x: 0, y: 0, width: 600, height: 80 } },
  });
  expect(trailingPadding("group-name-reference")).toBe(228);
});

it.each([1, 1.8])("gives names and balances their own space at narrow widths (font scale %s)", async (fontScale) => {
  const dimensions = jest.spyOn(ReactNative.Dimensions, "get").mockReturnValue({
    width: 390, height: 844, scale: 3, fontScale,
  });
  try {
    const view = await render(
      <ActivityGroupRow
        id="narrow"
        name="A very long group name for our next holiday together"
        iconKey="trip"
        balance={{ currency: "EUR", minor: "123456789" }}
        memberBalances={[
          { userId: "alex", displayName: "Alex", balance: { currency: "EUR", minor: "123456789" } },
        ]}
        onPress={jest.fn()}
      />,
    );
    await fireEvent(view.getByTestId("group-layout-narrow"), "globalEvent", {
      nativeEvent: { onGeometryChange: { x: 0, y: 0, width: fontScale > 1 ? 390 : 320, height: 80 } },
    });
    const name = view.getByTestId("group-name-narrow");
    expect(name.props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "padding", trailing: 0 }),
    );
    expect(name.props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "font", size: 19 * fontScale }),
    );
    expect(name.props.modifiers.some((modifier: { $type: string }) => modifier.$type === "lineLimit")).toBe(false);
    const total = view.getByTestId("group-total-narrow");
    expect(total.props.alignment).toBe("leading");
    expect(total.parent).toBe(name.parent);
    expect(view.getByTestId("group-balance-positive-alex").props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "padding", trailing: 0 }),
    );
  } finally {
    dimensions.mockRestore();
  }
});
