import type { PropsWithChildren } from "react";
import { Screen } from "./ui";

export function ProfileSettingsScreen({ children }: PropsWithChildren) {
  return <Screen>{children}</Screen>;
}
