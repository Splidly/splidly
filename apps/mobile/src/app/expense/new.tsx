import { ExpenseEditor } from "../../components/expense-editor";
import { useLocalSearchParams } from "expo-router";

export default function NewExpenseScreen() {
  const params = useLocalSearchParams<{ type?: "group" | "friend"; id?: string; duplicateExpenseId?: string }>();
  return (
    <ExpenseEditor
      {...(params.duplicateExpenseId ? { duplicateExpenseId: params.duplicateExpenseId } : {})}
      {...(params.id && params.type ? { newContext:
        params.type === "group"
          ? { type: "group", groupId: params.id }
          : { type: "friend", friendshipId: params.id }
      } : {})}
    />
  );
}
