import { readFile } from "node:fs/promises";
import { connect } from "node:http2";
import type {
  ApnsEnvironment,
  ExpenseNotificationPayload,
} from "@splidly/db";
import { importPKCS8, SignJWT } from "jose";

const providerTokenLifetimeMs = 50 * 60 * 1_000;

export interface ApnsClientConfig {
  environment: ApnsEnvironment;
  keyId: string;
  privateKey: string;
  teamId: string;
  topic: string;
}

export interface ApnsResponse {
  apnsId?: string;
  reason?: string;
  status: number;
  timestamp?: number;
}

export async function createApnsProviderToken(input: {
  keyId: string;
  privateKey: string;
  teamId: string;
  now?: Date;
}) {
  const key = await importPKCS8(input.privateKey, "ES256");
  return createApnsProviderTokenWithKey({
    key,
    keyId: input.keyId,
    teamId: input.teamId,
    ...(input.now ? { now: input.now } : {}),
  });
}

async function createApnsProviderTokenWithKey(input: {
  key: CryptoKey;
  keyId: string;
  teamId: string;
  now?: Date;
}) {
  const issuedAt = Math.floor((input.now ?? new Date()).getTime() / 1_000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: input.keyId })
    .setIssuer(input.teamId)
    .setIssuedAt(issuedAt)
    .sign(input.key);
}

export class ApnsClient {
  private readonly endpoint: string;
  private readonly key: CryptoKey;
  private providerToken?: { createdAt: number; value: string };

  private constructor(private readonly config: ApnsClientConfig, key: CryptoKey) {
    this.endpoint =
      config.environment === "development"
        ? "https://api.sandbox.push.apple.com"
        : "https://api.push.apple.com";
    this.key = key;
  }

  static async create(config: ApnsClientConfig) {
    return new ApnsClient(
      config,
      await importPKCS8(config.privateKey, "ES256"),
    );
  }

  private async authorization(now = new Date()) {
    if (
      this.providerToken &&
      now.getTime() - this.providerToken.createdAt < providerTokenLifetimeMs
    ) {
      return this.providerToken.value;
    }
    const value = await createApnsProviderTokenWithKey({
      key: this.key,
      keyId: this.config.keyId,
      teamId: this.config.teamId,
      now,
    });
    this.providerToken = { createdAt: now.getTime(), value };
    return value;
  }

  async send(
    deviceToken: string,
    payload: ExpenseNotificationPayload,
  ): Promise<ApnsResponse> {
    const authorization = await this.authorization();
    const notificationData =
      payload.eventType === "expense.summary"
        ? {
            eventType: payload.eventType,
            groupId: payload.groupId,
          }
        : {
            eventType: payload.eventType,
            expenseId: payload.expenseId,
            expenseVersion: String(payload.expenseVersion),
            groupId: payload.groupId,
          };
    const body = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
        "thread-id": payload.groupId,
      },
      ...notificationData,
    });

    return new Promise((resolve, reject) => {
      const client = connect(this.endpoint);
      let settled = false;
      let status = 0;
      let apnsId: string | undefined;
      const chunks: Buffer[] = [];
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        client.close();
        callback();
      };

      client.once("error", (cause) => finish(() => reject(cause)));
      const request = client.request({
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${authorization}`,
        "apns-priority": "10",
        "apns-push-type": "alert",
        "apns-topic": this.config.topic,
        "content-type": "application/json",
      });
      request.setTimeout(15_000, () => {
        request.close();
        finish(() => reject(new Error("APNs request timed out")));
      });
      request.on("response", (headers) => {
        status = Number(headers[":status"] ?? 0);
        const responseApnsId = headers["apns-id"];
        apnsId =
          typeof responseApnsId === "string" ? responseApnsId : undefined;
      });
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.once("error", (cause) => finish(() => reject(cause)));
      request.once("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf8");
        let details: { reason?: string; timestamp?: number } = {};
        if (responseBody) {
          try {
            details = JSON.parse(responseBody) as typeof details;
          } catch {
            details = { reason: responseBody };
          }
        }
        finish(() =>
          resolve({
            status,
            ...(apnsId ? { apnsId } : {}),
            ...(details.reason ? { reason: details.reason } : {}),
            ...(details.timestamp ? { timestamp: details.timestamp } : {}),
          }),
        );
      });
      request.end(body);
    });
  }
}

export async function createApnsClientFromFile(
  input: Omit<ApnsClientConfig, "privateKey"> & { privateKeyPath: string },
) {
  let privateKey: string;
  try {
    privateKey = await readFile(input.privateKeyPath, "utf8");
  } catch (cause) {
    throw new Error(
      `Unable to read the APNs private key at ${input.privateKeyPath}`,
      { cause },
    );
  }
  return ApnsClient.create({ ...input, privateKey });
}
