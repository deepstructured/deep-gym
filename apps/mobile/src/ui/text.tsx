import type { ReactNode } from "react";
import {
  Text as NativeText,
  type StyleProp,
  type TextProps as NativeTextProps,
  type TextStyle,
} from "react-native";
import { colors, fonts } from "../theme";

export type TextVariant =
  | "display"
  | "heading"
  | "title"
  | "body"
  | "caption"
  | "micro";
export type TextTone = "primary" | "muted" | "faint" | "lime" | "pink" | "white";
export type TextWeight = "regular" | "medium" | "semibold" | "bold";

const variantStyles: Record<TextVariant, TextStyle> = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: fonts.bold },
  heading: { fontSize: 24, lineHeight: 30, fontFamily: fonts.semibold },
  title: { fontSize: 18, lineHeight: 24, fontFamily: fonts.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
  caption: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular },
  micro: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.semibold,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
};

const toneColors: Record<TextTone, string> = {
  primary: colors.text,
  muted: colors.muted,
  faint: colors.faint,
  lime: colors.lime,
  pink: colors.pink,
  white: colors.white,
};

export interface TextProps extends NativeTextProps {
  children?: ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: TextWeight;
  style?: StyleProp<TextStyle>;
}

export function Text({
  variant = "body",
  tone = "primary",
  weight,
  style,
  children,
  ...props
}: TextProps) {
  return (
    <NativeText
      {...props}
      style={[
        variantStyles[variant],
        { color: toneColors[tone] },
        weight && { fontFamily: fonts[weight] },
        style,
      ]}
    >
      {children}
    </NativeText>
  );
}
