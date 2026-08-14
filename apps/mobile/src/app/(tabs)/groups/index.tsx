import { Stack, router } from "expo-router";
import { View } from "react-native";
import { normalizeGroupIconKey } from "../../../components/group-icon";
import {
  GroupListRow,
  GroupListSummary,
} from "../../../components/group-list-row";
import {
  CollectionScreen,
  EmptyState,
  ErrorState,
  HeaderButton,
  LoadingState,
  PrimaryButton,
  RowDivider,
} from "../../../components/ui";
import { overallGroupBalanceLines } from "../../../lib/group-balance-summary";
import { api } from "../../../lib/trpc";

export default function GroupsScreen() {
  const groups = api.groups.list.useQuery();
  return (
    <>
      <CollectionScreen
        isEmpty={groups.data?.length === 0}
        refreshing={groups.isRefetching}
        onRefresh={() => void groups.refetch()}
      >
        {groups.isPending ? <LoadingState /> : null}
        {groups.error ? (
          <ErrorState
            message={groups.error.message}
            onRetry={() => void groups.refetch()}
          />
        ) : null}
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
          <>
            <GroupListSummary
              lines={overallGroupBalanceLines(groups.data)}
            />
            <View>
              {groups.data.map((group, index) => (
                <View key={group.id}>
                  {index > 0 ? <RowDivider inset={78} /> : null}
                  <GroupListRow
                    id={group.id}
                    name={group.name}
                    iconKey={normalizeGroupIconKey(group.iconKey)}
                    color={group.color}
                    imageUrl={group.imageUrl}
                    balance={group.balance}
                    memberBalances={group.memberBalances}
                    onPress={() => router.push(`/groups/${group.id}`)}
                  />
                </View>
              ))}
            </View>
          </>
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
