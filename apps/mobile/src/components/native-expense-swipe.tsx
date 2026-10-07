import type { PropsWithChildren } from "react";
import type { ActivityListRow } from "./native-activity-list.types";

export function NativeExpenseSwipe({
  children,
}: PropsWithChildren<{ row: ActivityListRow }>) {
  return <>{children}</>;
}
