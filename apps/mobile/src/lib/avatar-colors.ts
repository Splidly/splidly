export type AvatarColorScheme = "light" | "dark";

type AvatarColorPair = {
  background: string;
  foreground: string;
};

type AvatarColorOption = {
  name: string;
  light: AvatarColorPair;
  dark: AvatarColorPair;
};

export const avatarColorOptions = [
  {
    name: "indigo",
    light: { background: "#E8E7FF", foreground: "#4745B8" },
    dark: { background: "#302E63", foreground: "#A7A5FF" },
  },
  {
    name: "blue",
    light: { background: "#E2EEFF", foreground: "#1764B0" },
    dark: { background: "#173653", foreground: "#73B7FF" },
  },
  {
    name: "sky",
    light: { background: "#DCF4FF", foreground: "#00749A" },
    dark: { background: "#153C4B", foreground: "#6DD5F7" },
  },
  {
    name: "teal",
    light: { background: "#DDF5F0", foreground: "#087867" },
    dark: { background: "#143E38", foreground: "#63D8C4" },
  },
  {
    name: "green",
    light: { background: "#E2F4E8", foreground: "#237A43" },
    dark: { background: "#193B28", foreground: "#75D995" },
  },
  {
    name: "lime",
    light: { background: "#EEF5D8", foreground: "#5D761E" },
    dark: { background: "#303B1B", foreground: "#B8D96A" },
  },
  {
    name: "yellow",
    light: { background: "#FFF3CC", foreground: "#8A6500" },
    dark: { background: "#463B16", foreground: "#FFD76A" },
  },
  {
    name: "orange",
    light: { background: "#FFE9D4", foreground: "#A65300" },
    dark: { background: "#492D16", foreground: "#FFB469" },
  },
  {
    name: "coral",
    light: { background: "#FFE3DC", foreground: "#B0442D" },
    dark: { background: "#4B2923", foreground: "#FF9A84" },
  },
  {
    name: "red",
    light: { background: "#FFE2E3", foreground: "#B7373C" },
    dark: { background: "#4A2427", foreground: "#FF8A8E" },
  },
  {
    name: "pink",
    light: { background: "#FFE2EE", foreground: "#A93668" },
    dark: { background: "#492434", foreground: "#FF8FBA" },
  },
  {
    name: "magenta",
    light: { background: "#F8E2F4", foreground: "#923F83" },
    dark: { background: "#44263F", foreground: "#E99AD8" },
  },
  {
    name: "purple",
    light: { background: "#F0E5FF", foreground: "#7142AE" },
    dark: { background: "#37264A", foreground: "#C69BFF" },
  },
  {
    name: "violet",
    light: { background: "#EAE4FF", foreground: "#5E4DB3" },
    dark: { background: "#30294D", foreground: "#B3A5FF" },
  },
  {
    name: "brown",
    light: { background: "#F3E8DD", foreground: "#7A5634" },
    dark: { background: "#3C2E22", foreground: "#D8AD83" },
  },
  {
    name: "slate",
    light: { background: "#E7EDF2", foreground: "#526675" },
    dark: { background: "#2B343B", foreground: "#AABAC6" },
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
