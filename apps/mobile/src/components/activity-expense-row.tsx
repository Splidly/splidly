import { ExpenseIcon } from "./expense-icon";
import { ExpenseListInvolvement } from "./expense-list-involvement";
import { ListRow } from "./ui";
import type { ActivityExpenseRowProps } from "./activity-expense-row.types";

export function ActivityExpenseRow(props: ActivityExpenseRowProps) {
  return (
    <ListRow
      title={props.title}
      {...(props.subtitle === undefined ? {} : { subtitle: props.subtitle })}
      subtitleNumberOfLines={1}
      {...(props.value === undefined ? {} : { value: props.value })}
      onPress={props.onPress}
      leading={
        <ExpenseIcon
          iconKey={props.iconKey}
          name={props.title}
          useNameFallback={props.useNameFallback}
        />
      }
      trailing={
        props.involvement ? (
          <ExpenseListInvolvement {...props.involvement} />
        ) : undefined
      }
    />
  );
}
