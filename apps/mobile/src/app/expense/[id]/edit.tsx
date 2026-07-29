import { useLocalSearchParams } from "expo-router";
import { ExpenseEditor } from "../../../components/expense-editor";

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExpenseEditor expenseId={id} />;
}
