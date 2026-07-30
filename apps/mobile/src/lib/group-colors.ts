import {
  groupColorPresets,
  groupColorSchema,
  type GroupColor,
} from "@splidly/shared";
import {
  avatarColorOptions,
  semanticIconColorsFor,
  type AvatarColorScheme,
} from "./avatar-colors";

type Rgb = { red: number; green: number; blue: number };

export function normalizeGroupColor(
  value: unknown,
  colorKey: string,
): GroupColor {
  const parsed = groupColorSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return semanticIconColorsFor(`group:${colorKey}`, "light")
    .background as GroupColor;
}

export function randomGroupColor(): GroupColor {
  return groupColorPresets[
    Math.floor(Math.random() * groupColorPresets.length)
  ] as GroupColor;
}

export function hexToRgb(color: string): Rgb {
  const normalized = normalizeGroupColor(color, color);
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex({ red, green, blue }: Rgb): GroupColor {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${channel(red)}${channel(green)}${channel(blue)}` as GroupColor;
}

function mixHex(color: string, target: "#000000" | "#FFFFFF", amount: number) {
  const source = hexToRgb(color);
  const destination = hexToRgb(target);
  return rgbToHex({
    red: source.red + (destination.red - source.red) * amount,
    green: source.green + (destination.green - source.green) * amount,
    blue: source.blue + (destination.blue - source.blue) * amount,
  });
}

function relativeLuminance(color: string) {
  const channels = Object.values(hexToRgb(color)).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

export function groupIconColorsFor(
  color: unknown,
  colorKey: string,
  scheme: AvatarColorScheme,
) {
  const accent = normalizeGroupColor(color, colorKey);
  const preset = avatarColorOptions.find(
    (option) => option.light.foreground === accent,
  );
  if (preset) {
    return scheme === "dark"
      ? preset.dark
      : { background: accent, foreground: preset.light.background };
  }

  if (scheme === "dark") {
    return {
      background: mixHex(accent, "#000000", 0.58),
      foreground: mixHex(accent, "#FFFFFF", 0.66),
    };
  }

  return {
    background: accent,
    foreground:
      relativeLuminance(accent) > 0.55
        ? mixHex(accent, "#000000", 0.72)
        : mixHex(accent, "#FFFFFF", 0.84),
  };
}

export function groupActionColorsFor(
  color: unknown,
  colorKey: string,
  scheme: AvatarColorScheme,
) {
  const accent = normalizeGroupColor(color, colorKey);
  const isLightAccent = relativeLuminance(accent) > 0.48;
  return {
    primaryBackground: accent,
    primaryForeground: isLightAccent ? "#161616" : "#FFFFFF",
    secondaryBackground:
      scheme === "dark"
        ? mixHex(accent, "#000000", 0.66)
        : mixHex(accent, "#FFFFFF", 0.82),
    secondaryForeground:
      scheme === "dark" ? mixHex(accent, "#FFFFFF", 0.52) : accent,
  };
}
