import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";
import { SyncDot } from "../sync";

interface AppHeaderShellProps {
  title: string;
  onBack?: () => void;
  /** Right-side content. Defaults to the `SyncDot` when not provided. */
  right?: ReactNode;
}

/**
 * Pure presentational header — title, optional back button, and a
 * right-side slot (the SyncDot by default, or a screen-supplied action
 * such as the edit-habit hamburger menu). Use directly when a screen
 * needs to render its own header (e.g. tab routes whose parent navigator
 * doesn't provide a Stack header). For Stack screens use `AppHeader`.
 */
const AppHeaderShell = ({ title, onBack, right }: AppHeaderShellProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack && (
            <Pressable
              onPress={onBack}
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
          {right ?? <SyncDot />}
        </View>
      </View>
    </View>
  );
};

// Subset of `NativeStackHeaderProps` from `@react-navigation/native-stack`,
// inlined so this app workspace doesn't need a direct dep on the package
// (it's transitively present via expo-router).
interface StackHeaderShape {
  back?: { title: string | undefined };
  options: {
    title?: string;
    // Method syntax (not a property) so the param is checked bivariantly —
    // that keeps `unknown` here assignable from React Navigation's real
    // `headerRight?: (props: NativeStackHeaderItemProps) => ReactNode`.
    headerRight?(props: unknown): ReactNode;
  };
}

/**
 * Adapter that lets `AppHeaderShell` time-slot into a Stack's `header`
 * option. A screen can set `headerRight` (via `navigation.setOptions`)
 * to replace the default SyncDot with its own action — e.g. the
 * edit-habit hamburger menu.
 */
export const AppHeader = ({ options, back }: StackHeaderShape) => {
  const navigation = useNavigation();
  return (
    <AppHeaderShell
      title={options.title ?? ""}
      onBack={back ? () => navigation.goBack() : undefined}
      right={options.headerRight?.(undefined)}
    />
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
