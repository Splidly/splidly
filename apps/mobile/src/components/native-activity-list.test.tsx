import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { ActivityExpenseRow } from "./activity-expense-row.ios";
import { NativeActivityList } from "./native-activity-list.ios";
import { spacing } from "../theme";

function sections(onDelete = jest.fn(async () => false), onPress = jest.fn()) {
  return [
    {
      key: "2026-10-05",
      label: "Today",
      data: [
        {
          key: "expense:1",
          content: (
            <ActivityExpenseRow
              title="Dinner"
              subtitle="You paid 10.00 €"
              iconKey="other"
              useNameFallback={false}
              involvement={{
                kind: "settled",
                amount: { currency: "EUR", minor: "0" },
              }}
              onPress={onPress}
            />
          ),
          onDelete,
          deleteLabel: "Delete Dinner",
        },
        { key: "payment:1", content: <Text selectable={false}>Payment</Text> },
      ],
    },
  ];
}
function fixture(data = sections()) {
  return (
    <NativeActivityList
      header={<Text selectable={false}>Overview</Text>}
      footer={<Text selectable={false}>Report</Text>}
      scrollProps={{ style: { flex: 1 }, bounces: true }}
      sections={data}
    />
  );
}

describe("native iOS activity list", () => {
  it("keeps overview, payments, and footer in independent measured native hosts", async () => {
    const view = await render(fixture());
    const list = view.getByTestId("native-activity-list");
    expect(list.props.bounces).toBe(true);
    expect(
      list.props.sections[1].rows.map(
        (row: { canDelete: boolean }) => row.canDelete,
      ),
    ).toEqual([true, false]);
    const measurements = [
      ["header:overview", "native-activity-header-content"],
      ["row:payment:1", "native-activity-row-payment:1"],
      ["footer:2026-10-05", "native-activity-footer-content"],
    ];
    for (const [index, [key, id]] of measurements.entries()) {
      await fireEvent(list, "hostedLayout", {
        nativeEvent: { key, width: 320 + index * 16 },
      });
      expect(StyleSheet.flatten(view.getByTestId(id!).props.style).width).toBe(
        320 + index * 16,
      );
    }
    expect(
      StyleSheet.flatten(
        view.getByTestId("native-activity-row-payment:1").props.style,
      ).width,
    ).toBe(336);
    expect(view.getByTestId("activity-date-2026-10-05")).toBeTruthy();
    expect(
      StyleSheet.flatten(
        view.getByTestId("activity-date-2026-10-05").props.style,
      ),
    ).toMatchObject({
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    });
  });

  it("places the overview in its own section and leaves only the date in activity headers", async () => {
    const view = await render(fixture());
    const list = view.getByTestId("native-activity-list");
    expect(
      list.props.sections.map(
        (section: { key: string; isOverview: boolean }) => ({
          key: section.key,
          isOverview: section.isOverview,
        }),
      ),
    ).toEqual([
      { key: "overview", isOverview: true },
      { key: "2026-10-05", isOverview: false },
    ]);
    expect(
      view
        .getByTestId("native-activity-header-content")
        .queryAll((node) => node.props.testID === "activity-date-2026-10-05"),
    ).toHaveLength(0);
    expect(
      view
        .getByTestId("native-activity-header-2026-10-05")
        .queryAll((node) => node.props.children === "Overview"),
    ).toHaveLength(0);
    const outerHost = view.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.flex === 1,
    );
    expect(outerHost).toHaveLength(1);
    expect(outerHost[0]!.props.ignoreSafeArea).toBeUndefined();
    const embeddedHosts = view.container.queryAll(
      (node) => node.props.matchContentsVertical === true,
    );
    expect(embeddedHosts).toHaveLength(4);
    for (const host of embeddedHosts) {
      expect(host.props.ignoreSafeArea).toBe("all");
    }
  });

  it("renders the overview even when there is no activity", async () => {
    const view = await render(fixture([]));
    expect(view.getByText("Overview")).toBeTruthy();
    expect(
      view.getByTestId("native-activity-list").props.sections[0].rows,
    ).toEqual([]);
    expect(
      view.getByTestId("native-activity-list").props.sections,
    ).toHaveLength(1);
    expect(
      view.getByTestId("native-activity-list").props.sections[0].isOverview,
    ).toBe(true);
  });

  it("reports actual Yoga heights after native widths arrive, including resizing", async () => {
    const data = sections();
    data.push({ key: "2026-10-04", label: "Yesterday", data: [] });
    const view = await render(fixture(data));
    const list = view.getByTestId("native-activity-list");
    const header = view.getByTestId("native-activity-header-content");
    await fireEvent(header, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 300 } },
    });
    expect(list.props.sections[0].headerHeight).toBe(0);
    await fireEvent(list, "hostedLayout", {
      nativeEvent: { key: "header:overview", width: 320 },
    });
    expect(
      StyleSheet.flatten(
        view.getByTestId("native-activity-header-2026-10-04").props.style,
      ).width,
    ).toBe(320);
    await fireEvent(header, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 300 } },
    });
    expect(
      view.getByTestId("native-activity-list").props.sections[0].headerHeight,
    ).toBe(300);
    await fireEvent(list, "hostedLayout", {
      nativeEvent: { key: "header:overview", width: 640 },
    });
    await fireEvent(header, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 640, height: 220 } },
    });
    expect(
      view.getByTestId("native-activity-list").props.sections[0].headerHeight,
    ).toBe(220);
  });

  it("measures the first date header immediately when an empty list gains activity", async () => {
    const view = await render(fixture([]));
    await fireEvent(view.getByTestId("native-activity-list"), "hostedLayout", {
      nativeEvent: { key: "header:overview", width: 320 },
    });
    await fireEvent(
      view.getByTestId("native-activity-header-content"),
      "layout",
      {
        nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 236 } },
      },
    );
    await view.rerender(fixture());
    const dateHeader = view.getByTestId("native-activity-header-2026-10-05");
    expect(StyleSheet.flatten(dateHeader.props.style).width).toBe(320);
    await fireEvent(dateHeader, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 49 } },
    });
    const nativeSections = view.getByTestId("native-activity-list").props
      .sections;
    expect(nativeSections[0].headerHeight).toBe(236);
    expect(nativeSections[1].headerHeight).toBe(49);
    expect(view.getByText("Today")).toBeTruthy();
  });

  it("keeps the expense label native and preserves its trailing values and navigation", async () => {
    const onPress = jest.fn();
    const view = await render(fixture(sections(undefined, onPress)));
    const row = view.getByTestId("activity-expense-Dinner");
    expect(
      row.queryAll(
        (node) =>
          node.props.matchContents !== undefined ||
          node.props.onPress !== undefined,
      ),
    ).toHaveLength(0);
    expect(row.queryAll((node) => node.props.text === "Settled")).toHaveLength(
      1,
    );
    expect(
      row.queryAll((node) => node.props.alignment === "trailing"),
    ).toHaveLength(1);
    expect(row.props.modifiers).toContainEqual(
      expect.objectContaining({ $type: "textSelection", value: false }),
    );
    const label = row.queryAll((node) =>
      node.props.modifiers?.some(
        (modifier: { $type: string; shape?: string }) =>
          modifier.$type === "contentShape" && modifier.shape === "rectangle",
      ),
    );
    expect(label).toHaveLength(1);
    expect(label[0]!.props.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $type: "padding",
          horizontal: 16,
          vertical: 10,
        }),
        expect.objectContaining({ $type: "contentShape", shape: "rectangle" }),
      ]),
    );
    await fireEvent(row, "buttonPress");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "acknowledges a pull only after its request finishes, including failure=%s",
    async (fail) => {
      let finish!: () => void;
      const onRefresh = jest.fn(
        () =>
          new Promise<void>((resolve, reject) => {
            finish = () => (fail ? reject(new Error("Offline")) : resolve());
          }),
      );
      const content = (refreshing: boolean) => (
        <NativeActivityList
          header={<Text selectable={false}>Overview</Text>}
          sections={sections()}
          scrollProps={{ style: { flex: 1 }, refreshing, onRefresh }}
        />
      );
      const view = await render(content(false));
      let request!: Promise<void>;
      await act(() => {
        request = view
          .getByTestId("native-activity-list")
          .props.onRefresh({
            nativeEvent: { requestId: "pull-1" },
          })
          .catch(() => undefined);
      });
      expect(onRefresh).toHaveBeenCalledTimes(1);
      await view.rerender(content(true));
      await view.rerender(content(false));
      expect(
        view.getByTestId("native-activity-list").props.refreshCompletion,
      ).toBeUndefined();
      await act(async () => {
        finish();
        await request;
      });
      expect(
        view.getByTestId("native-activity-list").props.refreshCompletion,
      ).toBe("pull-1");
    },
  );

  it.each([false, true])(
    "leaves the native swipe pending until confirmation resolves to %s",
    async (deleted) => {
      let resolve!: (deleted: boolean) => void;
      const onDelete = jest.fn(
        () =>
          new Promise<boolean>((done) => {
            resolve = done;
          }),
      );
      const view = await render(fixture(sections(onDelete)));
      const list = view.getByTestId("native-activity-list");
      let pending!: Promise<void>;
      await act(() => {
        pending = list.props.onDeleteRequested({
          nativeEvent: { rowKey: "expense:1", requestId: "swipe-1" },
        });
      });
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(list.props.completion).toBeUndefined();
      await act(async () => {
        resolve(deleted);
        await pending;
      });
      expect(view.getByTestId("native-activity-list").props.completion).toEqual(
        { requestId: "swipe-1", deleted },
      );
      expect(view.getByTestId("activity-expense-Dinner")).toBeTruthy();
    },
  );

  it("cancels the native swipe on failure or when the row is no longer deletable", async () => {
    const onDelete = jest.fn(async () => {
      throw new Error("Request failed");
    });
    const data = sections(onDelete);
    const view = await render(fixture(data));
    await fireEvent(
      view.getByTestId("native-activity-list"),
      "deleteRequested",
      {
        nativeEvent: { rowKey: "expense:1", requestId: "failed" },
      },
    );
    expect(view.getByTestId("native-activity-list").props.completion).toEqual({
      requestId: "failed",
      deleted: false,
    });
    await fireEvent(
      view.getByTestId("native-activity-list"),
      "deleteRequested",
      {
        nativeEvent: { rowKey: "missing", requestId: "missing" },
      },
    );
    expect(view.getByTestId("native-activity-list").props.completion).toEqual({
      requestId: "missing",
      deleted: false,
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
