import type { ExpenseIconKey } from "@splidly/shared";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export type ApnsEnvironment = "development" | "production";

export interface ExpenseEventNotificationPayload {
  eventType: "expense.created" | "expense.updated" | "expense.deleted";
  expenseId: string;
  expenseVersion: number;
  groupId: string;
  title: string;
  body: string;
}

export interface ExpenseSummaryNotificationPayload {
  eventType: "expense.summary";
  groupId: string;
  eventCount: number;
  title: string;
  body: string;
}

export type ExpenseNotificationPayload =
  | ExpenseEventNotificationPayload
  | ExpenseSummaryNotificationPayload;

export type NotificationDeliveryMode = "immediate" | "smart";

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_issuer_unique").on(table.issuer, table.accountId),
  ],
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const profiles = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  homeCurrency: text("home_currency").notNull().default("EUR"),
  notificationOnlyWhenInvolved: boolean("notification_only_when_involved")
    .notNull()
    .default(false),
  summarizeNotificationBursts: boolean("summarize_notification_bursts")
    .notNull()
    .default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
});

export const pushInstallations = pgTable(
  "push_installation",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    environment: text("environment").$type<ApnsEnvironment>().notNull(),
    token: text("token").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("push_installation_token_unique").on(table.token),
    index("push_installation_user_idx").on(table.userId),
    index("push_installation_delivery_idx").on(
      table.environment,
      table.disabledAt,
    ),
  ],
);

export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventKey: text("event_key").notNull(),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => pushInstallations.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<ExpenseNotificationPayload>().notNull(),
    deliveryMode: text("delivery_mode")
      .$type<NotificationDeliveryMode>()
      .notNull()
      .default("immediate"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processingStartedAt: timestamp("processing_started_at", {
      withTimezone: true,
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_outbox_event_unique").on(table.eventKey),
    index("notification_outbox_pending_idx").on(
      table.status,
      table.availableAt,
    ),
    index("notification_outbox_installation_idx").on(table.installationId),
  ],
);

export const friendships = pgTable(
  "friendship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userLowId: text("user_low_id")
      .notNull()
      .references(() => users.id),
    userHighId: text("user_high_id")
      .notNull()
      .references(() => users.id),
    createdVia: text("created_via").notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("friendship_pair_unique").on(table.userLowId, table.userHighId),
    index("friendship_low_idx").on(table.userLowId),
    index("friendship_high_idx").on(table.userHighId),
    index("friendship_active_low_idx").on(table.userLowId, table.removedAt),
    index("friendship_active_high_idx").on(table.userHighId, table.removedAt),
  ],
);

export const groups = pgTable("expense_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  iconKey: text("icon_key").notNull().default("default"),
  color: text("color").notNull().default("#4745B8"),
  imageUrl: text("image_url"),
  currency: text("currency").notNull(),
  simplifyDebts: boolean("simplify_debts").notNull().default(true),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  version: integer("version").notNull().default(1),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const groupMembers = pgTable(
  "group_member",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("group_member_user_idx").on(table.userId),
    index("group_member_active_user_idx").on(table.userId, table.removedAt),
  ],
);

export const invites = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    tokenHash: text("token_hash").notNull(),
    groupId: uuid("group_id").references(() => groups.id),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invite_token_unique").on(table.tokenHash),
    index("invite_group_idx").on(table.groupId),
    index("invite_inviter_idx").on(table.inviterId),
  ],
);

export const currencyQuotes = pgTable(
  "currency_quote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    base: text("base").notNull(),
    rates: jsonb("rates")
      .$type<
        {
          base: string;
          quote: string;
          rate: string;
          provider: string;
          providerDate: string;
          source: "automatic" | "manual";
        }[]
      >()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("currency_quote_user_idx").on(table.userId),
    index("currency_quote_expiry_idx").on(table.expiresAt),
  ],
);

export const expenses = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contextType: text("context_type").notNull(),
    groupId: uuid("group_id").references(() => groups.id),
    friendshipId: uuid("friendship_id").references(() => friendships.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    payerId: text("payer_id")
      .notNull()
      .references(() => users.id),
    description: text("description").notNull(),
    iconKey: text("icon_key")
      .$type<ExpenseIconKey>()
      .notNull()
      .default("other"),
    iconManuallySet: boolean("icon_manually_set").notNull().default(false),
    notes: text("notes").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    sourceCurrency: text("source_currency").notNull(),
    sourceAmountMinor: bigint("source_amount_minor", {
      mode: "bigint",
    }).notNull(),
    clientMutationId: uuid("client_mutation_id").notNull(),
    version: integer("version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("expense_idempotency_unique").on(
      table.createdBy,
      table.clientMutationId,
    ),
    index("expense_group_idx").on(table.groupId),
    index("expense_friendship_idx").on(table.friendshipId),
    index("expense_active_group_idx").on(
      table.groupId,
      table.deletedAt,
      table.occurredAt,
    ),
    index("expense_active_friendship_idx").on(
      table.friendshipId,
      table.deletedAt,
      table.occurredAt,
    ),
  ],
);

export const expenseSplits = pgTable(
  "expense_split",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sourceAmountMinor: bigint("source_amount_minor", {
      mode: "bigint",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.userId] }),
    index("expense_split_user_idx").on(table.userId),
  ],
);

export const expensePayments = pgTable(
  "expense_payment",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sourceAmountMinor: bigint("source_amount_minor", {
      mode: "bigint",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.userId] }),
    index("expense_payment_user_idx").on(table.userId),
  ],
);

export const settlements = pgTable(
  "settlement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contextType: text("context_type").notNull(),
    groupId: uuid("group_id").references(() => groups.id),
    friendshipId: uuid("friendship_id").references(() => friendships.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    notes: text("notes").notNull().default(""),
    sourceCurrency: text("source_currency").notNull(),
    sourceAmountMinor: bigint("source_amount_minor", {
      mode: "bigint",
    }).notNull(),
    canonicalCurrency: text("canonical_currency").notNull(),
    canonicalAmountMinor: bigint("canonical_amount_minor", {
      mode: "bigint",
    }).notNull(),
    clientMutationId: uuid("client_mutation_id").notNull(),
    version: integer("version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("settlement_idempotency_unique").on(
      table.createdBy,
      table.clientMutationId,
    ),
    index("settlement_group_idx").on(table.groupId),
    index("settlement_friendship_idx").on(table.friendshipId),
    index("settlement_active_group_idx").on(
      table.groupId,
      table.deletedAt,
      table.occurredAt,
    ),
    index("settlement_active_friendship_idx").on(
      table.friendshipId,
      table.deletedAt,
      table.occurredAt,
    ),
  ],
);

export const rateSnapshots = pgTable(
  "rate_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id").references(() => expenses.id),
    settlementId: uuid("settlement_id").references(() => settlements.id),
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    rate: numeric("rate", { precision: 30, scale: 15 }).notNull(),
    provider: text("provider").notNull(),
    providerDate: text("provider_date").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rate_expense_idx").on(table.expenseId),
    index("rate_settlement_idx").on(table.settlementId),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    contextType: text("context_type").notNull(),
    contextId: uuid("context_id").notNull(),
    debtorId: text("debtor_id")
      .notNull()
      .references(() => users.id),
    creditorId: text("creditor_id")
      .notNull()
      .references(() => users.id),
    canonicalCurrency: text("canonical_currency").notNull(),
    canonicalAmountMinor: bigint("canonical_amount_minor", {
      mode: "bigint",
    }).notNull(),
    reversalOfId: uuid("reversal_of_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ledger_source_idx").on(table.sourceType, table.sourceId),
    index("ledger_context_idx").on(table.contextType, table.contextId),
    index("ledger_debtor_idx").on(table.debtorId),
    index("ledger_creditor_idx").on(table.creditorId),
  ],
);

export const ledgerValuations = pgTable(
  "ledger_valuation",
  {
    ledgerEntryId: uuid("ledger_entry_id")
      .notNull()
      .references(() => ledgerEntries.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    currency: text("currency").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ledgerEntryId, table.userId] }),
    index("ledger_valuation_user_idx").on(table.userId),
  ],
);

export const financialRevisions = pgTable(
  "financial_revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordType: text("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    version: integer("version").notNull(),
    action: text("action").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("financial_revision_version_unique").on(
      table.recordType,
      table.recordId,
      table.version,
    ),
  ],
);

export const schema = {
  users,
  sessions,
  accounts,
  verifications,
  profiles,
  pushInstallations,
  notificationOutbox,
  friendships,
  groups,
  groupMembers,
  invites,
  currencyQuotes,
  expenses,
  expenseSplits,
  expensePayments,
  settlements,
  rateSnapshots,
  ledgerEntries,
  ledgerValuations,
  financialRevisions,
};

export const authSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
};
