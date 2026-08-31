import {
  and,
  currencyQuotes,
  inArray,
  invites,
  isNotNull,
  lt,
  notificationOutbox,
  or,
  pushInstallations,
  sessions,
  sql,
  verifications,
  type Database,
} from "@splidly/db";
import type { Logger } from "./logger";

export const dataRetentionIntervalMs = 24 * 60 * 60 * 1_000;
const notificationRetentionMs = 30 * dataRetentionIntervalMs;
const consumedInviteRetentionMs = 30 * dataRetentionIntervalMs;
const staleInstallationRetentionMs = 180 * dataRetentionIntervalMs;

export async function applyDataRetention(
  db: Database,
  now = new Date(),
): Promise<Record<string, number>> {
  const notificationCutoff = new Date(
    now.getTime() - notificationRetentionMs,
  );
  const consumedInviteCutoff = new Date(
    now.getTime() - consumedInviteRetentionMs,
  );
  const staleInstallationCutoff = new Date(
    now.getTime() - staleInstallationRetentionMs,
  );

  return db.transaction(async (tx) => {
    const sanitizedNotifications = await tx
      .update(notificationOutbox)
      .set({
        payload: sql`(${notificationOutbox.payload} - 'groupName') || jsonb_build_object('title', 'Splidly group activity', 'body', 'Open Splidly to review recent activity.')`,
        updatedAt: now,
      })
      .where(
        or(
          sql<boolean>`${notificationOutbox.payload} ? 'groupName'`,
          sql<boolean>`${notificationOutbox.payload}->>'title' is distinct from 'Splidly group activity'`,
          sql<boolean>`${notificationOutbox.payload}->>'body' is distinct from 'Open Splidly to review recent activity.'`,
        ),
      );
    const expiredSessions = await tx
      .delete(sessions)
      .where(lt(sessions.expiresAt, now));
    const expiredVerifications = await tx
      .delete(verifications)
      .where(lt(verifications.expiresAt, now));
    const expiredQuotes = await tx
      .delete(currencyQuotes)
      .where(lt(currencyQuotes.expiresAt, now));
    const expiredInvites = await tx.delete(invites).where(
      or(
        lt(invites.expiresAt, now),
        and(
          isNotNull(invites.usedAt),
          lt(invites.usedAt, consumedInviteCutoff),
        ),
        and(
          isNotNull(invites.revokedAt),
          lt(invites.revokedAt, consumedInviteCutoff),
        ),
      ),
    );
    const oldNotifications = await tx.delete(notificationOutbox).where(
      and(
        inArray(notificationOutbox.status, ["completed", "failed"]),
        lt(notificationOutbox.updatedAt, notificationCutoff),
      ),
    );
    // Removing an installation cascades its remaining notification jobs.
    const staleInstallations = await tx
      .delete(pushInstallations)
      .where(lt(pushInstallations.lastSeenAt, staleInstallationCutoff));

    return {
      currencyQuotes: expiredQuotes.rowCount ?? 0,
      invites: expiredInvites.rowCount ?? 0,
      notificationOutbox: oldNotifications.rowCount ?? 0,
      pushInstallations: staleInstallations.rowCount ?? 0,
      sanitizedNotifications: sanitizedNotifications.rowCount ?? 0,
      sessions: expiredSessions.rowCount ?? 0,
      verifications: expiredVerifications.rowCount ?? 0,
    };
  });
}

export function startDataRetentionWorker(db: Database, logger: Logger) {
  let running = false;
  let stopped = false;

  async function run() {
    if (running || stopped) return;
    running = true;
    try {
      const deleted = await applyDataRetention(db);
      logger.info("data-retention.completed", { deleted });
    } catch (error) {
      logger.error("data-retention.failed", { error });
    } finally {
      running = false;
    }
  }

  void run();
  const timer = setInterval(() => void run(), dataRetentionIntervalMs);
  timer.unref();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
