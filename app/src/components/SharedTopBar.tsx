import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useUser } from "@clerk/clerk-expo";
import { tokens } from "./theme";
import { SyncDot } from "./SyncDot";
import { isClerkConfigured } from "../infrastructure/clerk";

// Subset of `MaterialTopTabBarProps` from `@react-navigation/material-top-tabs`,
// inlined so this file doesn't need a direct dep on the package
// (it's transitively present via expo-router). `jumpTo` lives on the
// SceneRendererProps part of the props, not on `navigation`.
interface TabBarProps {
  state: { index: number; routes: { name: string; key: string }[] };
  jumpTo: (key: string) => void;
}

const ACTIVE_HALO = "rgba(255,90,54,0.18)";

/**
 * Avatar content: initials when signed in, person silhouette otherwise.
 * Splits into a separate component so we can call `useUser` conditionally
 * — `isClerkConfigured()` is stable across the app's lifetime (driven by
 * env at startup) so a per-render branch on it doesn't violate hook
 * rules.
 */
const AvatarContent = ({ active }: { active: boolean }) =>
  isClerkConfigured() ? (
    <ClerkAvatar active={active} />
  ) : (
    <PersonSilhouette active={active} />
  );

const ClerkAvatar = ({ active }: { active: boolean }) => {
  const { user } = useUser();
  const initials = computeInitials(user);
  if (!initials) return <PersonSilhouette active={active} />;
  return (
    <Text style={[styles.avatarText, active && styles.avatarTextActive]}>
      {initials}
    </Text>
  );
};

const PersonSilhouette = ({ active }: { active: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Circle
      cx={12}
      cy={9}
      r={3.5}
      stroke={active ? tokens.cream : tokens.ink}
      strokeWidth={1.7}
    />
    <Path
      d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5"
      stroke={active ? tokens.cream : tokens.ink}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const computeInitials = (
  user: ReturnType<typeof useUser>["user"],
): string | null => {
  if (!user) return null;
  const source =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    user.primaryPhoneNumber?.phoneNumber ||
    "";
  const cleaned = source.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // Single-word source (e.g. an email): use first 2 letters.
  return cleaned.slice(0, 2).toUpperCase();
};

/**
 * Top bar shared across the (tabs) navigator — Today / Calendar / Account.
 * Avatar (left) and calendar icon (right) act as tab toggles. The active
 * destination's button fills with brand orange and a soft halo. The
 * centre title swaps from the `nag.` wordmark to the page name with a
 * back chevron when not on Today.
 */
export const SharedTopBar = ({ state, jumpTo }: TabBarProps) => {
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index]?.name ?? "index";
  const onAccount = active === "account";
  const onCalendar = active === "calendar";
  const onToday = active === "index";

  // material-top-tabs' jumpTo (from SceneRendererProps) takes a route
  // KEY, not a name. Look up the key by name so the swipe animation
  // still plays.
  const goTo = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (route) jumpTo(route.key);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => goTo("account")}
          hitSlop={8}
          style={({ pressed }) => [
            styles.avatar,
            onAccount && styles.avatarActive,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Account"
          accessibilityRole="button"
        >
          <AvatarContent active={onAccount} />
        </Pressable>

        <View style={styles.center}>
          <View style={styles.titleRow}>
            {!onToday && (
              <Pressable
                onPress={() => goTo("index")}
                hitSlop={10}
                accessibilityLabel="Back to today"
                accessibilityRole="button"
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                  <Path
                    d="M7 1L2.5 5.5 7 10"
                    stroke={tokens.mute}
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            )}
            {onToday ? (
              <View style={styles.wordmarkRow}>
                <Text style={styles.wordmark}>nag</Text>
                <Text style={styles.wordmarkDot}>.</Text>
              </View>
            ) : (
              <Text style={styles.pageName}>{active}</Text>
            )}
          </View>
          <SyncDot showLabel />
        </View>

        <Pressable
          onPress={() => goTo("calendar")}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            onCalendar && styles.iconBtnActive,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Calendar"
          accessibilityRole="button"
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Rect
              x={3}
              y={5}
              width={18}
              height={16}
              rx={2}
              stroke={onCalendar ? tokens.cream : tokens.ink}
              strokeWidth={1.7}
            />
            <Path
              d="M3 10h18M8 3v4M16 3v4"
              stroke={onCalendar ? tokens.cream : tokens.ink}
              strokeWidth={1.7}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.cream,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(26,20,16,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActive: {
    backgroundColor: tokens.orange,
    shadowColor: tokens.orange,
    shadowOpacity: 0.18,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    borderWidth: 3,
    borderColor: ACTIVE_HALO,
  },
  avatarText: {
    color: tokens.ink,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  avatarTextActive: {
    color: tokens.cream,
  },
  center: {
    alignItems: "center",
    gap: 2,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  wordmark: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.36,
  },
  wordmarkDot: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.orange,
    letterSpacing: -0.36,
  },
  pageName: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.36,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(26,20,16,0.045)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: {
    backgroundColor: tokens.orange,
    borderWidth: 3,
    borderColor: ACTIVE_HALO,
  },
  pressed: {
    opacity: 0.7,
  },
});
