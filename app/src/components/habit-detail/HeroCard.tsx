import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../components/theme";
import { HabitGlyph } from "../../components/glyphs";

interface HeroCardProps {
  icon?: string | null;
  title: string;
  /** Goal cadence summary line (lower-cased mono caption). */
  cadenceSummary: string | null;
  /** Optional habit description — quietly inkSoft, with a faint left rule. */
  note: string | null;
}

/**
 * Header for the habit detail screen: ink-filled icon swatch, lowercase
 * title and a single mono cadence line, plus the optional "why" note
 * pulled from the habit's description.
 */
export const HeroCard = ({
  icon,
  title,
  cadenceSummary,
  note,
}: HeroCardProps) => {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.iconSwatch}>
          <HabitGlyph kind={icon} size={24} style="line" color={tokens.cream} />
        </View>
        <View style={styles.titleColumn}>
          <Text style={styles.title} numberOfLines={2}>
            {title.toLowerCase()}
          </Text>
          {cadenceSummary && (
            <Text style={styles.cadence} numberOfLines={1}>
              {cadenceSummary}
            </Text>
          )}
        </View>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconSwatch: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  titleColumn: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: tokens.ink,
    lineHeight: 25,
  },
  cadence: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
    letterSpacing: 0.4,
  },
  note: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: tokens.faint,
    fontSize: 13.5,
    lineHeight: 20,
    color: tokens.inkSoft,
  },
});
