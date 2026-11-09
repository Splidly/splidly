import { render } from "@testing-library/react-native";
import { ExpenseBalanceStatus, ExpenseListInvolvement } from "./expense-list-involvement";

it("renders separate non-selectable labels and amounts for both expenses and member balances", async () => {
  const amount = { currency: "EUR" as const, minor: "3000" };
  const view = await render(<>
    <ExpenseListInvolvement kind="lent" amount={amount} />
    <ExpenseBalanceStatus label="Owes" color="#FF6961" amount={amount} />
  </>);
  expect(view.getByText("You lent").props.selectable).toBe(false);
  expect(view.getByText("Owes").props.selectable).toBe(false);
  for (const value of view.getAllByText("30.00 €")) expect(value.props.selectable).toBe(false);
  expect(view.queryByText("Owes 30.00 €")).toBeNull();
});

it("omits amounts for settled members and expenses without involvement", async () => {
  const view = await render(<>
    <ExpenseBalanceStatus label="Settled" color="#A1A1AA" amount={null} />
    <ExpenseListInvolvement kind="none" amount={{ currency: "EUR", minor: "0" }} />
  </>);
  expect(view.getByText("Settled").props.selectable).toBe(false);
  expect(view.getByText("Not involved").props.selectable).toBe(false);
  expect(view.queryByText("0.00 €")).toBeNull();
});
