import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  GroupStatistics,
  type GroupStatisticsData,
  type StatisticsRangeSelection,
} from "../../../../components/group-statistics";
import {
  ErrorState,
  LoadingState,
  Screen,
} from "../../../../components/ui";
import { api } from "../../../../lib/trpc";

export default function GroupStatisticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selection, setSelection] = useState<StatisticsRangeSelection>({
    range: "all",
  });
  const queryInput =
    selection.range === "custom" && selection.from && selection.to
      ? {
          groupId: id,
          range: selection.range,
          from: selection.from,
          to: selection.to,
        }
      : { groupId: id, range: selection.range };
  const statistics = api.groups.statistics.useQuery(
    queryInput,
    { placeholderData: (previousData) => previousData },
  );
  const rangeParams =
    selection.range === "custom" && selection.from && selection.to
      ? {
          from: selection.from.toISOString(),
          to: selection.to.toISOString(),
        }
      : {};

  if (statistics.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (statistics.error || !statistics.data) {
    return (
      <Screen>
        <ErrorState
          message={statistics.error?.message ?? "Unable to load statistics."}
          onRetry={() => void statistics.refetch()}
        />
      </Screen>
    );
  }

  return (
    <>
      <Screen
        refreshing={statistics.isRefetching}
        onRefresh={() => void statistics.refetch()}
      >
        <GroupStatistics
          data={statistics.data as GroupStatisticsData}
          selection={selection}
          onSelectionChange={setSelection}
          onOpenCategory={(category) =>
            router.push({
              pathname: "/groups/[id]/statistics-expenses",
              params: {
                id,
                range: selection.range,
                ...rangeParams,
                filter: "category",
                category,
              },
            })
          }
          onOpenMember={(member, metric) =>
            router.push({
              pathname: "/groups/[id]/statistics-expenses",
              params: {
                id,
                range: selection.range,
                ...rangeParams,
                filter: "member",
                userId: member.userId,
                metric,
              },
            })
          }
        />
      </Screen>
      <Stack.Screen options={{ title: "Statistics" }} />
    </>
  );
}
