import { StyleSheet, Text, View } from "react-native";

import { tokens } from "../theme";
import { TaglineView } from "./TaglineView";
import { getLastTagline } from "./taglines";

/**
 * Renders the tagline that was picked by {@link SplashTagline} on the
 * current splash, surfaced again in About so the user can read it without
 * the splash time pressure.
 *
 * Selection lives in module-level state so this is in-memory only — if the
 * splash never mounted (e.g. About opened via deep link after a hot
 * reload), nothing is rendered.
 */
export const AboutTagline = () => {
  const tagline = getLastTagline();
  if (tagline == null) {
    return null;
  }
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>Today’s nag</Text>
      <View style={styles.card}>
        <TaglineView
          tagline={tagline}
          containerStyle={styles.body}
          quoteStyle={styles.quote}
          attributionStyle={styles.attribution}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  group: {
    marginTop: 18,
  },
  groupTitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontFamily: "JetBrainsMono",
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
  body: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  quote: {
    fontSize: 13,
    color: tokens.ink,
    lineHeight: 20,
  },
  attribution: {
    fontSize: 11,
    color: tokens.mute,
    letterSpacing: 0.4,
  },
});
