import { Stack, router } from "expo-router";
import { View } from "react-native";
import {
  Avatar,
  BalanceText,
  CollectionScreen,
  EmptyState,
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  PrimaryButton,
  RowDivider,
  Section,
} from "../../../components/ui";
import { api } from "../../../lib/trpc";

export default function GroupsScreen() {
  const groups = api.groups.list.useQuery();
  return (
    <>
      <CollectionScreen isEmpty={groups.data?.length === 0}>
        {groups.isPending ? <LoadingState /> : null}
        {groups.error ? <ErrorState message={groups.error.message} /> : null}
        {groups.data?.length === 0 ? (
          <EmptyState
            title="Make space for a shared plan"
            message="Create a group for a trip, household, event, or anything else you split together."
            action={
              <PrimaryButton
                label="Create a group"
                onPress={() => router.push("/groups/new")}
                compact
              />
            }
          />
        ) : null}
        {groups.data && groups.data.length > 0 ? (
          <Section title={`${groups.data.length} ${groups.data.length === 1 ? "group" : "groups"}`}>
            {groups.data.map((group, index) => (
              <View key={group.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={group.name}
                  subtitle={`Accounting in ${group.currency}`}
                  leading={
                    <Avatar
                      name={group.name}
                      colorKey={group.id}
                      variant="group"
                    />
                  }
                  trailing={<BalanceText value={group.balance} />}
                  onPress={() => router.push(`/groups/${group.id}`)}
                />
              </View>
            ))}
          </Section>
        ) : null}
      </CollectionScreen>
      <Stack.Screen
        options={{
          title: "Groups",
          ...(process.env.EXPO_OS !== "ios" && {
            headerRight: () => (
              <HeaderButton
                label="Create a group"
                glyph="+"
                onPress={() => router.push("/groups/new")}
              />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel="Create a group"
          onPress={() => router.push("/groups/new")}
        />
      </Stack.Toolbar>
    </>
  );
}
