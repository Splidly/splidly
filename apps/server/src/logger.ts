import { AsyncLocalStorage } from "node:async_hooks";
import { hostname } from "node:os";

export const logLevels = ["debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof logLevels)[number];
export type LogFormat = "json" | "pretty";
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

const invitePathPattern = /^(\/invite\/)[^/]+/;

export function sanitizeHttpPath(path: string): string {
  return path.replace(invitePathPattern, "$1[REDACTED]");
}

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
  colors?: boolean;
  destination?: { write(chunk: string): unknown };
  format?: LogFormat;
  level?: LogLevel;
  service?: string;
}

const ansi = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  debug: "\u001b[90m",
  info: "\u001b[36m",
  warn: "\u001b[33m",
  error: "\u001b[31m",
  fatal: "\u001b[1;31m",
} as const;

function indent(value: string, spaces = 4) {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function detailValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  return JSON.stringify(value, null, 2);
}

export function formatPrettyLog(entry: LogFields, colors = false) {
  const level = logLevels.includes(entry.level as LogLevel)
    ? (entry.level as LogLevel)
    : "info";
  const paint = (text: string, color: string) =>
    colors ? `${color}${text}${ansi.reset}` : text;
  const timestamp = typeof entry.timestamp === "string" ? entry.timestamp : "";
  const environment =
    typeof entry.environment === "string" ? ` [${entry.environment}]` : "";
  const message = typeof entry.message === "string" ? entry.message : "log";
  const lines = [
    `${paint(timestamp, ansi.dim)} ${paint(level.toUpperCase().padEnd(5), ansi[level])}${environment} ${message}`,
  ];

  const method = typeof entry.httpMethod === "string" ? entry.httpMethod : undefined;
  const path = typeof entry.httpPath === "string" ? entry.httpPath : undefined;
  if (method || path) {
    const status = typeof entry.status === "number" ? ` → ${entry.status}` : "";
    const duration =
      typeof entry.durationMs === "number" ? ` (${entry.durationMs} ms)` : "";
    lines.push(`  http:      ${method ?? ""} ${path ?? ""}${status}${duration}`);
  }
  if (typeof entry.procedure === "string") {
    const type =
      typeof entry.procedureType === "string" ? `${entry.procedureType} ` : "";
    lines.push(`  procedure: ${type}${entry.procedure}`);
  }
  if (typeof entry.requestId === "string") {
    lines.push(`  request:   ${entry.requestId}`);
  }
  if (typeof entry.userId === "string") {
    lines.push(`  user:      ${entry.userId}`);
  }

  const error = entry.error;
  if (error && typeof error === "object") {
    const details = error as Record<string, unknown>;
    const name = typeof details.name === "string" ? details.name : "Error";
    const errorMessage =
      typeof details.message === "string" ? details.message : "Unknown error";
    lines.push(`  error:     ${paint(`${name}: ${errorMessage}`, ansi.error)}`);
    if (typeof details.stack === "string") {
      lines.push("  stack:", indent(details.stack));
    }
    if (details.cause !== undefined) {
      lines.push("  cause:", indent(detailValue(details.cause)));
    }
  }

  const displayedKeys = new Set([
    "durationMs",
    "environment",
    "error",
    "hostname",
    "httpMethod",
    "httpPath",
    "level",
    "message",
    "procedure",
    "procedureType",
    "processId",
    "requestId",
    "responseBytes",
    "service",
    "status",
    "timestamp",
    "userId",
  ]);
  for (const [key, value] of Object.entries(entry)) {
    if (displayedKeys.has(key) || value === undefined) continue;
    const formatted = detailValue(value);
    if (formatted.includes("\n")) {
      lines.push(`  ${key}:`, indent(formatted));
    } else {
      lines.push(`  ${key}: ${formatted}`);
    }
  }
  return `${lines.join("\n")}\n\n`;
}

export class Logger {
  private readonly bindings: LogFields;
  private readonly colors: boolean;
  private readonly destination: { write(chunk: string): unknown };
  private readonly format: LogFormat;
  private readonly minimumPriority: number;
  private readonly service: string;

  constructor(options: LoggerOptions = {}, bindings: LogFields = {}) {
    this.destination = options.destination ?? process.stdout;
    this.colors =
      options.colors ??
      (this.destination === process.stdout &&
        Boolean(process.stdout.isTTY) &&
        process.env.NO_COLOR === undefined);
    this.format = options.format ?? "json";
    this.minimumPriority = levelPriority[options.level ?? "info"];
    this.service = options.service ?? "splidly-server";
    this.bindings = bindings;
  }

  child(bindings: LogFields) {
    return new Logger(
      {
        colors: this.colors,
        destination: this.destination,
        format: this.format,
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
    this.destination.write(
      this.format === "pretty"
        ? formatPrettyLog(entry, this.colors)
        : `${JSON.stringify(entry)}\n`,
    );
  }
}

export function durationMs(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
