import { Image } from "expo-image";
import type { ColorValue } from "react-native";

export function AndroidPaymentArrow({ color, size }: { color: ColorValue; size: number }) {
  return (
    <Image
      source={require("../../assets/icons/payment-arrow.svg")}
      style={{ width: size, height: size }}
      contentFit="contain"
      tintColor={typeof color === "string" ? color : null}
      pointerEvents="none"
      accessible={false}
    />
  );
}
