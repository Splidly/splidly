export type DatedActivity = {
  occurredAt: Date | string;
};

export type ActivityDateGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

function localDateKey(value: Date | string) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatActivityDateHeader(
  value: Date | string,
  locale?: string | undefined,
  now = new Date(),
) {
  const date = new Date(value);
  const todayKey = localDateKey(now);
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const key = localDateKey(date);

  if (key === todayKey) return "Today";
  if (key === localDateKey(yesterday)) return "Yesterday";

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  }).format(date);
}

export function groupActivityByDate<T extends DatedActivity>(
  items: readonly T[],
  locale?: string | undefined,
  now = new Date(),
): ActivityDateGroup<T>[] {
  const groups: ActivityDateGroup<T>[] = [];

  for (const item of [...items].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() -
      new Date(left.occurredAt).getTime(),
  )) {
    const key = localDateKey(item.occurredAt);
    const current = groups.at(-1);
    if (current?.key === key) {
      current.items.push(item);
      continue;
    }
    groups.push({
      key,
      label: formatActivityDateHeader(item.occurredAt, locale, now),
      items: [item],
    });
  }

  return groups;
}
