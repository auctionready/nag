import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../../components/theme";

const FONT = "SpaceGrotesk-Bold";
const MONO = "JetBrainsMono";

interface GroupProps {
  title?: string;
  children: React.ReactNode;
}

/**
 * Settings group: small uppercase mono caption above a white card with
 * 1px ink border. Mirrors the design's grouped iOS-style settings.
 */
export const Group = ({ title, children }: GroupProps) => (
  <View style={groupStyles.wrap}>
    {title && <Text style={groupStyles.title}>{title}</Text>}
    <View style={groupStyles.card}>{children}</View>
  </View>
);

interface RowProps {
  icon?: React.ReactNode;
  label: string;
  detail?: string;
  /** Render the chevron on the right. Default true. */
  chevron?: boolean;
  /** Style the row in the orange "danger" colour (sign out, unlink). */
  danger?: boolean;
  /** Greyed-out + non-interactive — used for not-yet-implemented rows. */
  disabled?: boolean;
  /** Render an on/off pill on the right instead of a chevron. */
  toggle?: boolean;
  /** When `toggle` is true, whether the pill shows the "on" state. */
  toggleOn?: boolean;
  onPress?: () => void;
  /** Hide the bottom hairline — used on the last row in a group. */
  last?: boolean;
}

export const Row = ({
  icon,
  label,
  detail,
  chevron = true,
  danger = false,
  disabled = false,
  toggle = false,
  toggleOn = false,
  onPress,
  last = false,
}: RowProps) => {
  const color = danger ? tokens.orange : tokens.ink;
  const body = (
    <View
      style={[
        rowStyles.row,
        !last && rowStyles.divider,
        disabled && rowStyles.disabled,
      ]}
    >
      {icon && (
        <View
          style={[
            rowStyles.icon,
            danger && {
              backgroundColor: "rgba(255,90,54,0.1)",
            },
          ]}
        >
          <View style={{ width: 14, height: 14 }}>{icon}</View>
        </View>
      )}
      <Text style={[rowStyles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {detail && (
        <Text style={rowStyles.detail} numberOfLines={1}>
          {detail}
        </Text>
      )}
      {toggle ? (
        <View
          style={[rowStyles.toggleTrack, toggleOn && rowStyles.toggleTrackOn]}
        >
          <View
            style={[rowStyles.toggleKnob, toggleOn && rowStyles.toggleKnobOn]}
          />
        </View>
      ) : (
        chevron &&
        !danger && (
          <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
            <Path
              d="M1 1l4 4.5L1 10"
              stroke={tokens.mute}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )
      )}
    </View>
  );
  if (!onPress || disabled) return body;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && rowStyles.pressed}
    >
      {body}
    </Pressable>
  );
};

interface ProviderButtonProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  /** First button of the chooser is the primary filled-ink style. */
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
}

export const ProviderButton = ({
  label,
  icon,
  onPress,
  primary = false,
  busy = false,
  disabled = false,
}: ProviderButtonProps) => {
  const isPrimary = primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        providerStyles.btn,
        isPrimary ? providerStyles.btnPrimary : providerStyles.btnSecondary,
        (busy || disabled) && providerStyles.btnDisabled,
        pressed && providerStyles.btnPressed,
      ]}
    >
      <View style={providerStyles.icon}>{icon}</View>
      <Text
        style={[
          providerStyles.label,
          { color: isPrimary ? tokens.cream : tokens.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const groupStyles = StyleSheet.create({
  wrap: {
    marginTop: 18,
  },
  title: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontFamily: MONO,
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    overflow: "hidden",
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "500",
  },
  detail: {
    fontFamily: MONO,
    fontSize: 11,
    color: tokens.mute,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
  toggleTrack: {
    width: 34,
    height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(26,20,16,0.18)",
    padding: 2,
  },
  toggleTrackOn: {
    backgroundColor: tokens.orange,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.cream,
  },
  toggleKnobOn: {
    marginLeft: 14,
  },
});

const providerStyles = StyleSheet.create({
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: tokens.ink,
    borderWidth: 1,
    borderColor: tokens.ink,
  },
  btnSecondary: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnPressed: {
    opacity: 0.7,
  },
  icon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.14,
  },
});
