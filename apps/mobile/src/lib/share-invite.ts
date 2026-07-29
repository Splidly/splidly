import { Share, type ShareContent } from "react-native";

export function getInviteShareContent(url: string): ShareContent {
  return { message: url };
}

export function shareInvite(url: string) {
  return Share.share(getInviteShareContent(url));
}
