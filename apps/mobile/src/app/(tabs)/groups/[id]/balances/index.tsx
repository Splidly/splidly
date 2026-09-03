import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  GroupBalanceMemberRow,
  MemberRelationships,
} from "../../../../../components/group-balances";
import {
  ErrorState,
  HeaderButton,
  LoadingState,
  RowDivider,
  Screen,
  Section,
} from "../../../../../components/ui";
import { api } from "../../../../../lib/trpc";
import { toolbarIcons } from "../../../../../lib/toolbar-icons";

export default function GroupBalancesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expandedUserIds, setExpandedUserIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const balances = api.groups.balances.useQuery({ groupId: id });

  if (balances.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (balances.error || !balances.data) {
    return (
      <Screen>
        <ErrorState
          message={balances.error?.message ?? "Unable to load group balances."}
          onRetry={() => void balances.refetch()}
        />
      </Screen>
    );
  }

  const members = [...balances.data.members].sort((left, right) => {
    if (left.isViewer !== right.isViewer) return left.isViewer ? -1 : 1;
    return left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    });
  });
  const viewerUserId =
    members.find((member) => member.isViewer)?.userId ?? "";
  const openSettleUp = () =>
    router.push({
      pathname: "/settlement/group",
      params: { id, returnTo: "balances" },
    });

  return (
    <>
      <Screen
        refreshing={balances.isRefetching}
        onRefresh={() => void balances.refetch()}
      >
        <Section
          title={`${members.length} ${members.length === 1 ? "member" : "members"}`}
          footer={
            balances.data.group.simplifyDebts
              ? "Balances use the group’s simplified repayment plan."
              : "Balances preserve who owes whom in this group."
          }
        >
          {members.map((member, index) => (
            <View key={member.userId}>
              {index > 0 ? <RowDivider /> : null}
              <GroupBalanceMemberRow
                member={member}
                expanded={expandedUserIds.has(member.userId)}
                onPress={() =>
                  setExpandedUserIds((current) => {
                    const next = new Set(current);
                    if (next.has(member.userId)) next.delete(member.userId);
                    else next.add(member.userId);
                    return next;
                  })
                }
              />
              {expandedUserIds.has(member.userId) ? (
                <MemberRelationships
                  member={member}
                  viewerUserId={viewerUserId}
                />
              ) : null}
            </View>
          ))}
        </Section>
      </Screen>
      <Stack.Screen
        options={{
          title: "Group Balances",
          ...(process.env.EXPO_OS !== "ios" && {
            headerRight: () => (
              <HeaderButton
                label={`Settle up ${balances.data.group.name}`}
                glyph="✓"
                onPress={openSettleUp}
              />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={toolbarIcons.settle}
          accessibilityLabel={`Settle up ${balances.data.group.name}`}
          onPress={openSettleUp}
        />
      </Stack.Toolbar>
    </>
  );
}
