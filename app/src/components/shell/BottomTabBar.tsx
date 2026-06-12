import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { tokens } from "../theme";

const GridIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill={color}>
    <Rect x={4} y={4} width={7} height={7} rx={1.5} />
    <Rect x={13} y={4} width={7} height={7} rx={1.5} />
    <Rect x={4} y={13} width={7} height={7} rx={1.5} />
    <Rect x={13} y={13} width={7} height={7} rx={1.5} />
  </Svg>
);

const CalendarIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Rect
      x={3}
      y={5}
      width={18}
      height={16}
      rx={2}
      stroke={color}
      strokeWidth={1.7}
    />
    <Path
      d="M3 10h18M8 3v4M16 3v4"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
    />
  </Svg>
);

const PersonIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={9} r={3.5} stroke={color} strokeWidth={1.7} />
    <Path
      d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const TAB_ICONS: Record<string, (props: { color: string }) => React.ReactNode> =
  {
    index: GridIcon,
    calendar: CalendarIcon,
    account: PersonIcon,
  };

const TAB_LABELS: Record<string, string> = {
  index: "today",
  calendar: "calendar",
  account: "me",
};

/**
 * Custom bottom tab bar for the home shell — cream surface with a top
 * hairline, three items (today / calendar / me) with line icons and
 * mono uppercase labels. The active item is brand orange.
 */
export const BottomTabBar = ({
  state,
  navigation,
  insets,
}: BottomTabBarProps) => (
  <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
    {state.routes.map((route, index) => {
      const active = state.index === index;
      const Icon = TAB_ICONS[route.name];
      const label = TAB_LABELS[route.name] ?? route.name;
      const color = active ? tokens.orange : tokens.mute;

      const onPress = () => {
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (!active && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };

      return (
        <Pressable
          key={route.key}
          onPress={onPress}
          hitSlop={8}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          accessibilityLabel={label}
          style={styles.item}
        >
          {Icon && <Icon color={color} />}
          <Text style={[styles.label, { color }, active && styles.labelActive]}>
            {label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: tokens.cream,
    borderTopWidth: 1,
    borderTopColor: tokens.veryFaint,
  },
  item: {
    alignItems: "center",
    gap: 3,
  },
  label: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  labelActive: {
    fontWeight: "600",
  },
});
