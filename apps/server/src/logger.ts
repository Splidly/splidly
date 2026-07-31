import { AsyncLocalStorage } from "node:async_hooks";
import { hostname } from "node:os";

export const logLevels = ["debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof logLevels)[number];
export type LogFields = Record<string, unknown>;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const logContext = new AsyncLocalStorage<LogFields>();
const hostName = hostname();

export function withLogContext<T>(fields: LogFields, callback: () => T): T {
  return logContext.run({ ...logContext.getStore(), ...fields }, callback);
}

const sensitiveKeys = new Set([
  "authorization",
  "cookie",
  "databaseurl",
  "password",
  "privatekey",
  "setcookie",
  "token",
]);

function isSensitiveKey(key: string) {
  const normalized = key.replaceAll(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return (
    sensitiveKeys.has(normalized) ||
    normalized.endsWith("password") ||
    normalized.endsWith("privatekey") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token")
  );
}

function serializeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth = 0,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (typeof value === "symbol") return value.toString();
  if (depth >= 8) return "[Max depth reached]";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
      ...(value.cause !== undefined
        ? { cause: serializeValue(value.cause, seen, depth + 1) }
        : {}),
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, seen, depth + 1));
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = isSensitiveKey(key)
        ? "[REDACTED]"
        : serializeValue(item, seen, depth + 1);
    }
    return result;
  }
  return String(value);
}

function serializeFields(fields: LogFields) {
  return serializeValue(fields, new WeakSet()) as LogFields;
}

export interface LoggerOptions {
  destination?: { write(chunk: string): unknown };
  level?: LogLevel;
  service?: string;
}

export class Logger {
  private readonly bindings: LogFields;
  private readonly destination: { write(chunk: string): unknown };
  private readonly minimumPriority: number;
  private readonly service: string;

  constructor(options: LoggerOptions = {}, bindings: LogFields = {}) {
    this.destination = options.destination ?? process.stdout;
    this.minimumPriority = levelPriority[options.level ?? "info"];
    this.service = options.service ?? "splidly-server";
    this.bindings = bindings;
  }

  child(bindings: LogFields) {
    return new Logger(
      {
        destination: this.destination,
        level: this.minimumLevel,
        service: this.service,
      },
      { ...this.bindings, ...bindings },
    );
  }

  debug(message: string, fields: LogFields = {}) {
    this.write("debug", message, fields);
  }

  info(message: string, fields: LogFields = {}) {
    this.write("info", message, fields);
  }

  warn(message: string, fields: LogFields = {}) {
    this.write("warn", message, fields);
  }

  error(message: string, fields: LogFields = {}) {
    this.write("error", message, fields);
  }

  fatal(message: string, fields: LogFields = {}) {
    this.write("fatal", message, fields);
  }

  private get minimumLevel(): LogLevel {
    return (
      logLevels.find(
        (level) => levelPriority[level] === this.minimumPriority,
      ) ?? "info"
    );
  }

  private write(level: LogLevel, message: string, fields: LogFields) {
    if (levelPriority[level] < this.minimumPriority) return;
    const entry = serializeFields({
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      hostname: hostName,
      processId: process.pid,
      message,
      ...logContext.getStore(),
      ...this.bindings,
      ...fields,
    });
    this.destination.write(`${JSON.stringify(entry)}\n`);
  }
}

export function durationMs(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
