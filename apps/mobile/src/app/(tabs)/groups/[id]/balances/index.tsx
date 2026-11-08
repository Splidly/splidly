import { useColorScheme } from "react-native";
import { useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { memberBalanceRows } from "../../../../../components/member-balance-list";
import { useNavigationPressGuard } from "../../../../../lib/use-navigation-press-guard";
import {
  ErrorState,
  HeaderButton,
  LoadingState,
  Screen,
  SectionFooter,
} from "../../../../../components/ui";
import { api } from "../../../../../lib/trpc";
import { toolbarIcons } from "../../../../../lib/toolbar-icons";

export default function GroupBalancesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const acceptNavigation = useNavigationPressGuard();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [expandedUserIds, setExpandedUserIds] = useState<ReadonlySet<string>>(() => new Set());
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
  const openSettleUp = () => {
    if (acceptNavigation()) router.push({
      pathname: "/settlement/group",
      params: { id, returnTo: "balances" },
    });
  };
  const viewerUserId = members.find(member => member.isViewer)?.userId ?? "";
  const toggleMember = (userId: string) => setExpandedUserIds(current => {
    const next = new Set(current);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });
  const explanation = balances.data.group.simplifyDebts
    ? "Balances use the group’s simplified repayment plan."
    : "Balances preserve who owes whom in this group.";

  return (
    <>
      <Screen
        refreshing={balances.isRefetching}
        onRefresh={() => void balances.refetch()}
        activityList={{ sections: [{
          key: "members",
          label: `${members.length} ${members.length === 1 ? "member" : "members"}`,
          nativeHeader: true,
          nativeFooter: explanation,
          ...(process.env.EXPO_OS !== "ios" ? { footer: <SectionFooter>{explanation}</SectionFooter> } : {}),
          data: members.flatMap(member => memberBalanceRows(member, () => toggleMember(member.userId), viewerUserId, expandedUserIds.has(member.userId), scheme)),
        }] }}
      />
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
