export type AvatarColorScheme = "light" | "dark";

type AvatarColorPair = {
  background: string;
  foreground: string;
};

type AvatarColorOption = {
  name: string;
  light: AvatarColorPair;
  dark: AvatarColorPair;
  chart: Record<AvatarColorScheme, string>;
};

export const avatarColorOptions = [
  {
    name: "indigo",
    light: { background: "#E8E7FF", foreground: "#4745B8" },
    dark: { background: "#302E63", foreground: "#A7A5FF" },
    chart: { light: "#4F46C8", dark: "#5856D6" },
  },
  {
    name: "blue",
    light: { background: "#E2EEFF", foreground: "#1764B0" },
    dark: { background: "#173653", foreground: "#73B7FF" },
    chart: { light: "#0878D1", dark: "#0A84FF" },
  },
  {
    name: "sky",
    light: { background: "#DCF4FF", foreground: "#00749A" },
    dark: { background: "#153C4B", foreground: "#6DD5F7" },
    chart: { light: "#008FB8", dark: "#00B8D9" },
  },
  {
    name: "teal",
    light: { background: "#DDF5F0", foreground: "#087867" },
    dark: { background: "#143E38", foreground: "#63D8C4" },
    chart: { light: "#008F83", dark: "#00C7BE" },
  },
  {
    name: "green",
    light: { background: "#E2F4E8", foreground: "#237A43" },
    dark: { background: "#193B28", foreground: "#75D995" },
    chart: { light: "#239B45", dark: "#30D158" },
  },
  {
    name: "lime",
    light: { background: "#EEF5D8", foreground: "#5D761E" },
    dark: { background: "#303B1B", foreground: "#B8D96A" },
    chart: { light: "#6F9800", dark: "#9ACD00" },
  },
  {
    name: "yellow",
    light: { background: "#FFF3CC", foreground: "#8A6500" },
    dark: { background: "#463B16", foreground: "#FFD76A" },
    chart: { light: "#C58E00", dark: "#FFD60A" },
  },
  {
    name: "orange",
    light: { background: "#FFE9D4", foreground: "#A65300" },
    dark: { background: "#492D16", foreground: "#FFB469" },
    chart: { light: "#D96B00", dark: "#FF9F0A" },
  },
  {
    name: "coral",
    light: { background: "#FFE3DC", foreground: "#B0442D" },
    dark: { background: "#4B2923", foreground: "#FF9A84" },
    chart: { light: "#D94F35", dark: "#FF6B4A" },
  },
  {
    name: "red",
    light: { background: "#FFE2E3", foreground: "#B7373C" },
    dark: { background: "#4A2427", foreground: "#FF8A8E" },
    chart: { light: "#D9363E", dark: "#FF453A" },
  },
  {
    name: "pink",
    light: { background: "#FFE2EE", foreground: "#A93668" },
    dark: { background: "#492434", foreground: "#FF8FBA" },
    chart: { light: "#D62970", dark: "#FF2D87" },
  },
  {
    name: "magenta",
    light: { background: "#F8E2F4", foreground: "#923F83" },
    dark: { background: "#44263F", foreground: "#E99AD8" },
    chart: { light: "#BC2E9E", dark: "#E83EBD" },
  },
  {
    name: "purple",
    light: { background: "#F0E5FF", foreground: "#7142AE" },
    dark: { background: "#37264A", foreground: "#C69BFF" },
    chart: { light: "#8B42CE", dark: "#BF5AF2" },
  },
  {
    name: "violet",
    light: { background: "#EAE4FF", foreground: "#5E4DB3" },
    dark: { background: "#30294D", foreground: "#B3A5FF" },
    chart: { light: "#6848D0", dark: "#7D5CFF" },
  },
  {
    name: "brown",
    light: { background: "#F3E8DD", foreground: "#7A5634" },
    dark: { background: "#3C2E22", foreground: "#D8AD83" },
    chart: { light: "#93602F", dark: "#B8783E" },
  },
  {
    name: "slate",
    light: { background: "#E7EDF2", foreground: "#526675" },
    dark: { background: "#2B343B", foreground: "#AABAC6" },
    chart: { light: "#4F7088", dark: "#5E7D94" },
  },
] as const satisfies readonly AvatarColorOption[];

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function avatarColorsFor(
  key: string,
  scheme: AvatarColorScheme,
) {
  const index = stableHash(key) % avatarColorOptions.length;
  const option = avatarColorOptions[index] ?? avatarColorOptions[0];
  return {
    name: option.name,
    ...option[scheme],
  };
}

export function semanticIconColorsFor(
  key: string,
  scheme: AvatarColorScheme,
) {
  const colors = avatarColorsFor(key, scheme);
  if (scheme === "dark") return colors;

  return {
    name: colors.name,
    background: colors.foreground,
    foreground: colors.background,
  };
}

export function semanticChartColorFor(
  key: string,
  scheme: AvatarColorScheme,
) {
  const option = avatarColorOptions[stableHash(key) % avatarColorOptions.length];
  return (option ?? avatarColorOptions[0]).chart[scheme];
}
