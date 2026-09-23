import type { StyleProp, TextStyle } from "react-native";
import { Text as NativeText } from "react-native";
import { colors, fonts } from "../theme";

export interface DotValueProps {
  value: string | number;
  suffix?: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  suffixStyle?: StyleProp<TextStyle>;
}

/** The actual Matricha display face used by the web dashboard. */
export function DotValue({
  value,
  suffix,
  size = 30,
  color = colors.text,
  style,
  suffixStyle,
}: DotValueProps) {
  return (
    <NativeText
      style={[
        {
          color,
          fontFamily: fonts.dot,
          fontSize: size,
          lineHeight: size * 1.08,
          letterSpacing: -size * 0.025,
        },
        style,
      ]}
    >
      {value}
      {suffix ? (
        <NativeText
          style={[
            {
              color,
              fontFamily: fonts.regular,
              fontSize: 14,
              lineHeight: 20,
              opacity: 0.6,
            },
            suffixStyle,
          ]}
        >
          {`  ${suffix}`}
        </NativeText>
      ) : null}
    </NativeText>
  );
}
