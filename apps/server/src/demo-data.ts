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
import type { ExpenseIconKey } from "@splidly/shared";

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
  iconKey: ExpenseIconKey;
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
  const chrisId = demoMembers[3].id;
  const allMemberIds = [demoUserId, alexId, samId, beaId, chrisId];
  let nextTransferSerial = 9;

  function fixtureId(namespace: 2 | 3 | 4, serial: number) {
    return `${namespace}0000000-0000-4000-8000-${serial
      .toString()
      .padStart(12, "0")}`;
  }

  function sharedExpense(input: {
    serial: number;
    description: string;
    iconKey: ExpenseIconKey;
    notes: string;
    daysAgo: number;
    payerId: string;
    amountMinor: bigint;
  }): DemoExpense {
    const shareMinor = input.amountMinor / BigInt(allMemberIds.length);
    if (shareMinor * BigInt(allMemberIds.length) !== input.amountMinor) {
      throw new Error("Demo expenses must split evenly between all members");
    }
    return {
      id: fixtureId(2, input.serial),
      clientMutationId: fixtureId(3, input.serial),
      description: input.description,
      iconKey: input.iconKey,
      notes: input.notes,
      daysAgo: input.daysAgo,
      payerId: input.payerId,
      amountMinor: input.amountMinor,
      shares: allMemberIds.map((userId) => ({
        userId,
        amountMinor: shareMinor,
      })),
      transfers: allMemberIds
        .filter((userId) => userId !== input.payerId)
        .map((debtorId) => ({
          id: fixtureId(4, nextTransferSerial++),
          debtorId,
          creditorId: input.payerId,
          amountMinor: shareMinor,
        })),
    };
  }

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
      sharedExpense({
        serial: 4,
        description: "Pastel de nata breakfast",
        iconKey: "dining",
        notes: "Breakfast near the guesthouse",
        daysAgo: 5,
        payerId: beaId,
        amountMinor: 4_500n,
      }),
      sharedExpense({
        serial: 5,
        description: "Tram passes",
        iconKey: "transport",
        notes: "Day passes for tram 28",
        daysAgo: 8,
        payerId: chrisId,
        amountMinor: 7_500n,
      }),
      sharedExpense({
        serial: 6,
        description: "Groceries",
        iconKey: "groceries",
        notes: "Breakfast and snacks for the apartment",
        daysAgo: 12,
        payerId: samId,
        amountMinor: 11_000n,
      }),
      sharedExpense({
        serial: 7,
        description: "Sunset drinks",
        iconKey: "drinks",
        notes: "Rooftop drinks in Bairro Alto",
        daysAgo: 18,
        payerId: alexId,
        amountMinor: 6_500n,
      }),
      sharedExpense({
        serial: 8,
        description: "Sintra day trip",
        iconKey: "travel",
        notes: "Return train and local shuttle",
        daysAgo: 26,
        payerId: demoUserId,
        amountMinor: 15_000n,
      }),
      sharedExpense({
        serial: 9,
        description: "Surf lesson",
        iconKey: "sports",
        notes: "Group lesson at Costa da Caparica",
        daysAgo: 50,
        payerId: chrisId,
        amountMinor: 14_000n,
      }),
      sharedExpense({
        serial: 10,
        description: "Ferry tickets",
        iconKey: "transport",
        notes: "Ferry across the Tagus",
        daysAgo: 75,
        payerId: beaId,
        amountMinor: 5_000n,
      }),
      sharedExpense({
        serial: 11,
        description: "Flights to Lisbon",
        iconKey: "travel",
        notes: "Shared booking discount",
        daysAgo: 105,
        payerId: demoUserId,
        amountMinor: 19_000n,
      }),
      sharedExpense({
        serial: 12,
        description: "Concert tickets",
        iconKey: "entertainment",
        notes: "Outdoor concert tickets",
        daysAgo: 145,
        payerId: samId,
        amountMinor: 23_000n,
      }),
      sharedExpense({
        serial: 13,
        description: "Apartment deposit",
        iconKey: "housing",
        notes: "Deposit paid when booking",
        daysAgo: 200,
        payerId: alexId,
        amountMinor: 27_500n,
      }),
      sharedExpense({
        serial: 14,
        description: "Portuguese cooking class",
        iconKey: "dining",
        notes: "Private class for the group",
        daysAgo: 260,
        payerId: beaId,
        amountMinor: 24_500n,
      }),
      sharedExpense({
        serial: 15,
        description: "Airport transfer",
        iconKey: "transport",
        notes: "Van from the airport to Alfama",
        daysAgo: 330,
        payerId: chrisId,
        amountMinor: 12_500n,
      }),
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
          iconManuallySet: true,
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
            iconManuallySet: true,
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
