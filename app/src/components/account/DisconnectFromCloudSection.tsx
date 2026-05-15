import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";
import { Group } from "./AccountUI";
import { confirmAndDisconnectFromCloud } from "./disconnectFromCloudAction";

/**
 * Companion to `DeleteAccountSection`: tears down the server-side
 * account and Clerk session but leaves the local SQLite database
 * intact, so the user can keep using the app offline (and sync to a
 * fresh account on the next sign-in). Rendered above the delete-row
 * with neutral ink styling — destructive of server data but not of
 * local data, so it deliberately doesn't shout in orange the way
 * `DeleteAccountSection` does.
 */
export const DisconnectFromCloudSection = () => (
  <Group title="Cloud sync">
    <Pressable
      onPress={confirmAndDisconnectFromCloud}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Svg
          width={14}
          height={14}
          viewBox="0 0 14 14"
          fill="none"
          stroke={tokens.ink}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Cloud outline with a slash through it. */}
          <Path d="M3.5 9.5h6.5a2 2 0 0 0 0-4 3 3 0 0 0-5.7-1 2 2 0 0 0-.8 5z" />
          <Path d="M2 2l10 10" />
        </Svg>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Disconnect from cloud</Text>
        <Text style={styles.subtitle}>
          keep local data · sign in later to resync
        </Text>
      </View>
      <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
        <Path
          d="M1 1l4 4.5L1 10"
          stroke={tokens.mute}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  </Group>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pressed: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.07,
  },
  subtitle: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.4,
  },
});
