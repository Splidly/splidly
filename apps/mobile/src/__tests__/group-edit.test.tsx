import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import EditGroupScreen from "../app/(tabs)/groups/[id]/edit";

const mockUpdateMutate = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: "group-1" }),
}));

const mockBack = (
  jest.requireMock("expo-router") as {
    router: { back: jest.Mock };
  }
).router.back;

jest.mock("../lib/trpc", () => ({
  api: {
    useUtils: () => ({
      groups: {
        detail: { invalidate: jest.fn() },
        list: { invalidate: jest.fn() },
      },
    }),
    groups: {
      detail: {
        useQuery: () => ({
          data: {
            group: {
              id: "group-1",
              name: "Lisbon",
              iconKey: "trip",
              color: "#1764B0",
              currency: "EUR",
              simplifyDebts: true,
              version: 3,
            },
          },
          error: null,
          isPending: false,
        }),
      },
      update: {
        useMutation: () => ({
          mutate: mockUpdateMutate,
          error: null,
          isPending: false,
        }),
      },
    },
  },
}));

describe("EditGroupScreen", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockUpdateMutate.mockClear();
  });

  it("edits group identity in the dedicated form sheet", async () => {
    const view = await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <EditGroupScreen />
      </SafeAreaInsetsContext.Provider>,
    );

    await fireEvent.changeText(view.getByLabelText("Group name"), "Porto");
    await fireEvent.press(view.getByText("Save changes"));

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      groupId: "group-1",
      expectedVersion: 3,
      name: "Porto",
      iconKey: "trip",
      color: "#1764B0",
      imageUrl: null,
      currency: "EUR",
      simplifyDebts: true,
    });
  });
});
