import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { tokens } from "./theme";
import { SyncDot } from "./SyncDot";

// Subset of `NativeStackHeaderProps` from `@react-navigation/native-stack`,
// inlined so this app workspace doesn't need a direct dep on the package
// (it's transitively present via expo-router).
interface AppHeaderProps {
  back?: { title: string | undefined };
  options: { title?: string };
}

/**
 * Shared header for non-home screens. Matches the home board's visual
 * language: cream background, ink title, back button styled like the
 * top bar's icon buttons, sync indicator on the right.
 */
export const AppHeader = ({ options, back }: AppHeaderProps) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const title = options.title ?? "";
  const showBack = !!back;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {showBack && (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 5l-7 7 7 7"
                  stroke={tokens.ink}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          )}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title.toLowerCase()}
        </Text>
        <View style={[styles.side, styles.sideRight]}>
          <SyncDot />
        </View>
      </View>
    </View>
  );
};

const SIDE = 36;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.cream,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 52,
  },
  side: {
    width: SIDE + 16,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideRight: {
    alignItems: "flex-end",
  },
  iconBtn: {
    width: SIDE,
    height: SIDE,
    borderRadius: SIDE / 2,
    backgroundColor: "rgba(26,20,16,0.045)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.34,
  },
});
