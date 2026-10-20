import { GroupListRow } from "./group-list-row";
import type { ActivityGroupRowProps } from "./activity-group-row.types";
export function ActivityGroupRow(props: ActivityGroupRowProps) {
  return <GroupListRow {...props} contained />;
}
