import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  GroupStatistics,
  type GroupStatisticsData,
  type StatisticsRange,
} from "../../../../components/group-statistics";
import {
  ErrorState,
  LoadingState,
  Screen,
} from "../../../../components/ui";
import { api } from "../../../../lib/trpc";

export default function GroupStatisticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [range, setRange] = useState<StatisticsRange>("all");
  const statistics = api.groups.statistics.useQuery(
    { groupId: id, range },
    { placeholderData: (previousData) => previousData },
  );

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
          range={range}
          onRangeChange={setRange}
          onOpenCategory={(category) =>
            router.push({
              pathname: "/groups/[id]/statistics-expenses",
              params: {
                id,
                range,
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
                range,
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
