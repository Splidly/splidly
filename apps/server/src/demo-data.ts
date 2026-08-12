import {
  expensePayments,
  expenses,
  expenseSplits,
  financialRevisions,
  groups,
  groupMembers,
  ledgerEntries,
  ledgerValuations,
  profiles,
  type Database,
  users,
} from "@splidly/db";

export const demoGroupId = "10000000-0000-4000-8000-000000000001";

const demoMembers = [
  {
    id: "demo-member-alex",
    name: "Alex Morgan",
    email: "alex@demo.splidly.invalid",
  },
  {
    id: "demo-member-sam",
    name: "Sam Rivera",
    email: "sam@demo.splidly.invalid",
  },
  {
    id: "demo-member-bea",
    name: "Bea Chen",
    email: "bea@demo.splidly.invalid",
  },
  {
    id: "demo-member-chris",
    name: "Chris Taylor",
    email: "chris@demo.splidly.invalid",
  },
] as const;

type DemoExpense = {
  id: string;
  clientMutationId: string;
  description: string;
  iconKey: "dining" | "housing" | "entertainment";
  notes: string;
  daysAgo: number;
  payerId: string;
  amountMinor: bigint;
  shares: { userId: string; amountMinor: bigint }[];
  transfers: {
    id: string;
    debtorId: string;
    creditorId: string;
    amountMinor: bigint;
  }[];
};

export function demoWorkspaceFixture(demoUserId: string): {
  members: typeof demoMembers;
  expenses: DemoExpense[];
} {
  const alexId = demoMembers[0].id;
  const samId = demoMembers[1].id;
  const beaId = demoMembers[2].id;
  return {
    members: demoMembers,
    expenses: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        clientMutationId: "30000000-0000-4000-8000-000000000001",
        description: "Dinner by the river",
        iconKey: "dining",
        notes: "First night in Lisbon",
        daysAgo: 3,
        payerId: demoUserId,
        amountMinor: 12_000n,
        shares: [demoUserId, alexId, samId, beaId].map((userId) => ({
          userId,
          amountMinor: 3_000n,
        })),
        transfers: [alexId, samId, beaId].map((debtorId, index) => ({
          id: `40000000-0000-4000-8000-00000000000${index + 1}`,
          debtorId,
          creditorId: demoUserId,
          amountMinor: 3_000n,
        })),
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        clientMutationId: "30000000-0000-4000-8000-000000000002",
        description: "Apartment",
        iconKey: "housing",
        notes: "Two nights near Alfama",
        daysAgo: 2,
        payerId: alexId,
        amountMinor: 20_000n,
        shares: [
          { userId: demoUserId, amountMinor: 8_000n },
          { userId: alexId, amountMinor: 4_000n },
          { userId: samId, amountMinor: 4_000n },
          { userId: beaId, amountMinor: 4_000n },
        ],
        transfers: [
          {
            id: "40000000-0000-4000-8000-000000000004",
            debtorId: demoUserId,
            creditorId: alexId,
            amountMinor: 8_000n,
          },
          {
            id: "40000000-0000-4000-8000-000000000005",
            debtorId: samId,
            creditorId: alexId,
            amountMinor: 4_000n,
          },
          {
            id: "40000000-0000-4000-8000-000000000006",
            debtorId: beaId,
            creditorId: alexId,
            amountMinor: 4_000n,
          },
        ],
      },
      {
        id: "20000000-0000-4000-8000-000000000003",
        clientMutationId: "30000000-0000-4000-8000-000000000003",
        description: "Museum tickets",
        iconKey: "entertainment",
        notes: "Modern art exhibition",
        daysAgo: 1,
        payerId: samId,
        amountMinor: 6_000n,
        shares: [demoUserId, alexId, samId].map((userId) => ({
          userId,
          amountMinor: 2_000n,
        })),
        transfers: [
          {
            id: "40000000-0000-4000-8000-000000000007",
            debtorId: demoUserId,
            creditorId: samId,
            amountMinor: 2_000n,
          },
          {
            id: "40000000-0000-4000-8000-000000000008",
            debtorId: alexId,
            creditorId: samId,
            amountMinor: 2_000n,
          },
        ],
      },
    ],
  };
}

function occurredAt(daysAgo: number, now: Date): Date {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(18, 0, 0, 0);
  return date;
}

export async function ensureDemoData(
  db: Database,
  demoUserId: string,
  now = new Date(),
): Promise<void> {
  const fixture = demoWorkspaceFixture(demoUserId);
  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values(
        fixture.members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          emailVerified: true,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(profiles)
      .values(
        [
          { id: demoUserId, name: "Demo User" },
          ...fixture.members,
        ].map((member) => ({
          userId: member.id,
          displayName: member.name,
          homeCurrency: "EUR",
          onboardedAt: now,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(groups)
      .values({
        id: demoGroupId,
        name: "Lisbon Weekend",
        iconKey: "trip",
        color: "#00749A",
        currency: "EUR",
        simplifyDebts: false,
        createdBy: demoUserId,
      })
      .onConflictDoNothing();
    await tx
      .insert(groupMembers)
      .values(
        [demoUserId, ...fixture.members.map((member) => member.id)].map(
          (userId) => ({ groupId: demoGroupId, userId }),
        ),
      )
      .onConflictDoNothing();

    for (const expense of fixture.expenses) {
      const expenseDate = occurredAt(expense.daysAgo, now);
      await tx
        .insert(expenses)
        .values({
          id: expense.id,
          contextType: "group",
          groupId: demoGroupId,
          createdBy: demoUserId,
          payerId: expense.payerId,
          description: expense.description,
          iconKey: expense.iconKey,
          notes: expense.notes,
          occurredAt: expenseDate,
          sourceCurrency: "EUR",
          sourceAmountMinor: expense.amountMinor,
          clientMutationId: expense.clientMutationId,
        })
        .onConflictDoNothing();
      await tx
        .insert(expenseSplits)
        .values(
          expense.shares.map((share) => ({
            expenseId: expense.id,
            userId: share.userId,
            sourceAmountMinor: share.amountMinor,
          })),
        )
        .onConflictDoNothing();
      await tx
        .insert(expensePayments)
        .values({
          expenseId: expense.id,
          userId: expense.payerId,
          sourceAmountMinor: expense.amountMinor,
        })
        .onConflictDoNothing();
      await tx
        .insert(ledgerEntries)
        .values(
          expense.transfers.map((transfer) => ({
            id: transfer.id,
            sourceType: "expense",
            sourceId: expense.id,
            contextType: "group",
            contextId: demoGroupId,
            debtorId: transfer.debtorId,
            creditorId: transfer.creditorId,
            canonicalCurrency: "EUR",
            canonicalAmountMinor: transfer.amountMinor,
          })),
        )
        .onConflictDoNothing();
      await tx
        .insert(ledgerValuations)
        .values(
          expense.transfers.flatMap((transfer) =>
            [transfer.debtorId, transfer.creditorId].map((userId) => ({
              ledgerEntryId: transfer.id,
              userId,
              currency: "EUR",
              amountMinor: transfer.amountMinor,
            })),
          ),
        )
        .onConflictDoNothing();
      await tx
        .insert(financialRevisions)
        .values({
          recordType: "expense",
          recordId: expense.id,
          version: 1,
          action: "create",
          actorId: demoUserId,
          snapshot: {
            context: { type: "group", groupId: demoGroupId },
            description: expense.description,
            iconKey: expense.iconKey,
            iconManuallySet: false,
            notes: expense.notes,
            occurredAt: expenseDate.toISOString(),
            payerId: expense.payerId,
            payments: [
              {
                userId: expense.payerId,
                amountMinor: expense.amountMinor.toString(),
              },
            ],
            amount: { currency: "EUR", minor: expense.amountMinor.toString() },
            split: {
              mode: "exact",
              shares: expense.shares.map((share) => ({
                userId: share.userId,
                amountMinor: share.amountMinor.toString(),
              })),
            },
            rates: [],
          },
        })
        .onConflictDoNothing();
    }
  });
}
