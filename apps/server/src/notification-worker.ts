import {
  and,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  notificationOutbox,
  or,
  pushInstallations,
  type Database,
} from "@splidly/db";
import { createApnsClientFromFile, type ApnsResponse } from "./apns";
import type { Env } from "./env";

const batchSize = 50;
const lockTimeoutMs = 5 * 60 * 1_000;
const maxAttempts = 8;
const pollIntervalMs = 5_000;
const cleanupIntervalMs = 24 * 60 * 60 * 1_000;
const outboxRetentionMs = 30 * cleanupIntervalMs;
const invalidTokenReasons = new Set([
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "Unregistered",
]);

export type ApnsResponseDisposition =
  | "delivered"
  | "invalid-token"
  | "retry"
  | "failed";

export function classifyApnsResponse(
  response: ApnsResponse,
): ApnsResponseDisposition {
  if (response.status === 200) return "delivered";
  if (
    response.status === 410 ||
    (response.reason && invalidTokenReasons.has(response.reason))
  ) {
    return "invalid-token";
  }
  if (response.status === 429 || response.status >= 500) return "retry";
  return "failed";
}

function retryDelayMs(attempts: number) {
  return Math.min(60 * 60 * 1_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}

function errorMessage(response: ApnsResponse) {
  return `APNs ${response.status}${response.reason ? `: ${response.reason}` : ""}`;
}

export async function startNotificationWorker(db: Database, env: Env) {
  if (
    !env.APNS_ENVIRONMENT ||
    !env.APNS_KEY_ID ||
    !env.APNS_PRIVATE_KEY_PATH
  ) {
    console.log("APNs delivery disabled; credentials are not configured");
    return { stop() {} };
  }
  const environment = env.APNS_ENVIRONMENT;

  const apns = await createApnsClientFromFile({
    environment,
    keyId: env.APNS_KEY_ID,
    privateKeyPath: env.APNS_PRIVATE_KEY_PATH,
    teamId: env.IOS_TEAM_ID,
    topic: env.IOS_APP_ID,
  });
  let running = false;
  let stopped = false;
  let lastCleanupAt = 0;

  async function processBatch() {
    if (running || stopped) return;
    running = true;
    try {
      const now = new Date();
      if (now.getTime() - lastCleanupAt >= cleanupIntervalMs) {
        await db
          .delete(notificationOutbox)
          .where(
            and(
              inArray(notificationOutbox.status, ["completed", "failed"]),
              lt(
                notificationOutbox.updatedAt,
                new Date(now.getTime() - outboxRetentionMs),
              ),
            ),
          );
        lastCleanupAt = now.getTime();
      }
      const staleBefore = new Date(now.getTime() - lockTimeoutMs);
      const candidates = await db
        .select({
          id: notificationOutbox.id,
          attempts: notificationOutbox.attempts,
          payload: notificationOutbox.payload,
          installationId: pushInstallations.id,
          token: pushInstallations.token,
        })
        .from(notificationOutbox)
        .innerJoin(
          pushInstallations,
          eq(pushInstallations.id, notificationOutbox.installationId),
        )
        .where(
          and(
            eq(pushInstallations.environment, environment),
            isNull(pushInstallations.disabledAt),
            or(
              and(
                eq(notificationOutbox.status, "pending"),
                lte(notificationOutbox.availableAt, now),
              ),
              and(
                eq(notificationOutbox.status, "processing"),
                lt(notificationOutbox.processingStartedAt, staleBefore),
              ),
            ),
          ),
        )
        .limit(batchSize);

      for (const candidate of candidates) {
        const [claimed] = await db
          .update(notificationOutbox)
          .set({
            status: "processing",
            processingStartedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(notificationOutbox.id, candidate.id),
              or(
                eq(notificationOutbox.status, "pending"),
                and(
                  eq(notificationOutbox.status, "processing"),
                  lt(notificationOutbox.processingStartedAt, staleBefore),
                ),
              ),
            ),
          )
          .returning({ id: notificationOutbox.id });
        if (!claimed) continue;

        const attempts = candidate.attempts + 1;
        try {
          const response = await apns.send(candidate.token, candidate.payload);
          const disposition = classifyApnsResponse(response);
          if (disposition === "invalid-token") {
            const completedAt = new Date();
            await db
              .update(pushInstallations)
              .set({ disabledAt: completedAt, updatedAt: completedAt })
              .where(eq(pushInstallations.id, candidate.installationId));
            await db
              .update(notificationOutbox)
              .set({
                status: "completed",
                completedAt,
                lastError: errorMessage(response),
                updatedAt: completedAt,
              })
              .where(
                and(
                  eq(
                    notificationOutbox.installationId,
                    candidate.installationId,
                  ),
                  inArray(notificationOutbox.status, ["pending", "processing"]),
                ),
              );
            continue;
          }
          if (disposition === "delivered") {
            await db
              .update(notificationOutbox)
              .set({
                attempts,
                status: "completed",
                completedAt: new Date(),
                lastError: null,
                updatedAt: new Date(),
              })
              .where(eq(notificationOutbox.id, candidate.id));
            continue;
          }

          const lastError = errorMessage(response);
          const shouldRetry =
            disposition === "retry" && attempts < maxAttempts;
          await db
            .update(notificationOutbox)
            .set({
              attempts,
              status: shouldRetry ? "pending" : "failed",
              availableAt: shouldRetry
                ? new Date(Date.now() + retryDelayMs(attempts))
                : new Date(),
              processingStartedAt: null,
              lastError,
              updatedAt: new Date(),
            })
            .where(eq(notificationOutbox.id, candidate.id));
        } catch (cause) {
          const shouldRetry = attempts < maxAttempts;
          await db
            .update(notificationOutbox)
            .set({
              attempts,
              status: shouldRetry ? "pending" : "failed",
              availableAt: shouldRetry
                ? new Date(Date.now() + retryDelayMs(attempts))
                : new Date(),
              processingStartedAt: null,
              lastError:
                cause instanceof Error
                  ? cause.message.slice(0, 1_000)
                  : "Unknown APNs delivery error",
              updatedAt: new Date(),
            })
            .where(eq(notificationOutbox.id, candidate.id));
        }
      }
    } catch (cause) {
      console.error("Notification worker failed", cause);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => void processBatch(), pollIntervalMs);
  void processBatch();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
