import { expensePreview, friendPreview, groupPreview, settlementPreview } from "./activity-preview";
import { nativeUserAvatar } from "../components/native-avatar";

it("uses the same user initials and colors in a friend preview, including while a photo loads", () => {
  const fallback = nativeUserAvatar("Alex Morgan", "alex", "dark");
  expect(friendPreview("Alex Morgan", null, [], { userId: "alex", scheme: "dark" }).avatarFallback).toEqual(fallback);
  const photo = friendPreview("Alex Morgan", "data:image/jpeg;base64,PHOTO", [], { userId: "alex", scheme: "dark" });
  expect(photo.avatarFallback).toEqual(fallback);
  expect(photo.imageUrl).toBe("data:image/jpeg;base64,PHOTO");
});

it("shows individual debts when a group's net balance is zero", () => {
  const preview = groupPreview({
    name: "Lisbon", iconKey: "other", balance: { currency: "EUR", minor: "0" },
    memberBalances: [
      { userId: "a", displayName: "Anna", balance: { currency: "EUR", minor: "-1500" } },
      { userId: "b", displayName: "Ben", balance: { currency: "EUR", minor: "1500" } },
    ],
  });
  expect(preview.caption).toBe("Net balance");
  expect(preview.debts).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "You owe Anna", value: "15.00 €", tone: "negative" }),
    expect.objectContaining({ label: "Ben owes you", value: "15.00 €", tone: "positive" }),
  ]));
});

it("keeps a friend's currencies and debt directions separate", () => {
  const preview = friendPreview("Anna", null, [
    { contextType: "friend", viewerAmount: { currency: "EUR", minor: "-1000" }, canonicalAmount: { currency: "EUR", minor: "-1000" }, counterpartyAmount: { currency: "USD", minor: "1200" } },
    { contextType: "group", viewerAmount: { currency: "USD", minor: "2000" }, canonicalAmount: { currency: "USD", minor: "2000" }, counterpartyAmount: { currency: "USD", minor: "-2000" } },
  ]);
  expect(preview.headline).toBe("2 open ledgers");
  expect(preview.debts).toEqual([
    { label: "You owe Anna", subtitle: "Direct ledger", value: "10.00 €", tone: "negative" },
    { label: "Anna owes you", subtitle: "Group ledger", value: "$20.00", tone: "positive" },
  ]);
  expect(friendPreview("Anna", null, []).headline).toBe("All settled up");
});

it("bounds long previews and tells the user how many ledgers remain", () => {
  const amount = { currency: "EUR" as const, minor: "100" };
  const preview = friendPreview("Anna", null, Array.from({ length: 8 }, () => ({
    contextType: "group", viewerAmount: amount, canonicalAmount: amount, counterpartyAmount: amount,
  })));
  expect(preview.debts).toHaveLength(4);
  expect(preview.debtNote).toBe("4 more open ledgers in friend details");
});

it("shows an expense's original total, payer and viewer involvement independently", () => {
  const preview = expensePreview({
    description: "Dinner", sourceAmountMinor: "4000", sourceCurrency: "USD",
    occurredAt: "2026-11-06T12:00:00Z", notes: "Birthday dinner",
    payers: [{ displayName: "Anna", isViewer: false }],
    paymentTotal: { currency: "USD", minor: "4000" },
    viewerInvolvement: { kind: "borrowed", amount: { currency: "EUR", minor: "1800" } },
  }, "Lisbon");
  expect(preview.headline).toBe("$40.00");
  expect(preview.subtitle).toBe("Lisbon");
  expect(preview.details).toEqual(expect.arrayContaining([
    { label: "Payment", value: "Anna paid $40.00" },
    { label: "You owe", value: "18.00 €", tone: "negative" },
    { label: "Note", value: "Birthday dinner" },
  ]));
});

it("uses the known payer for a direct expense without inventing a share", () => {
  const preview = expensePreview({ description: "Coffee", sourceAmountMinor: 500n,
    sourceCurrency: "EUR", occurredAt: "2026-11-06T12:00:00Z" }, "Anna", "You");
  expect(preview.details).toContainEqual({ label: "Paid by", value: "You" });
  expect(preview.details).toHaveLength(2);
});

it.each(["sent", "received", "third-party"])("previews a %s settlement with its direction and original currency", (direction) => {
  const preview = settlementPreview({
    from: { displayName: "Anna", isViewer: direction === "sent" },
    to: { displayName: "Ben", isViewer: direction === "received" },
    amount: { currency: "USD", minor: "1250" },
    occurredAt: "2026-11-06T12:00:00Z", notes: "Cash after dinner",
  }, "Lisbon");
  expect(preview.headline).toBe("$12.50");
  expect(preview.subtitle).toBe("Lisbon");
  expect(preview.caption).toBe(direction === "sent" ? "You paid" : direction === "received" ? "You received" : "Payment recorded");
  expect(preview.details).toEqual(expect.arrayContaining([
    { label: "Paid by", value: direction === "sent" ? "You" : "Anna" },
    { label: "Paid to", value: direction === "received" ? "You" : "Ben" },
    { label: "Note", value: "Cash after dinner" },
    expect.objectContaining({ label: "Date" }),
  ]));
  expect(preview.debts).toBeUndefined();
});

it("lists exactly who owes whom for an expense and distinguishes the original allocation", () => {
  const preview = expensePreview({
    description: "Dinner", sourceAmountMinor: "6000", sourceCurrency: "EUR", occurredAt: "2026-11-06",
    previewDebts: [
      { from: { displayName: "Me", isViewer: true }, to: { displayName: "Anna", isViewer: false }, amount: { currency: "EUR", minor: "1200" } },
      { from: { displayName: "Anna", isViewer: false }, to: { displayName: "Me", isViewer: true }, amount: { currency: "USD", minor: "800" } },
      { from: { displayName: "Ben", isViewer: false }, to: { displayName: "Anna", isViewer: false }, amount: { currency: "EUR", minor: "2000" } },
    ],
  }, "Lisbon");
  expect(preview.debts).toEqual([
    { label: "You owe Anna", value: "12.00 €", tone: "negative" },
    { label: "Anna owes you", value: "$8.00", tone: "positive" },
    { label: "Ben owes Anna", value: "20.00 €", tone: "neutral" },
  ]);
  expect(preview.debtNote).toContain("Original allocation");
  expect(preview.debtNote).toContain("Later payments");
});
