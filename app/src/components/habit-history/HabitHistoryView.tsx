import { ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "../../components/theme";
import { HabitGlyph } from "../../components/glyphs";
import { HowAmIDoingCard } from "./HowAmIDoingCard";

interface HabitHistoryViewProps {
  habitExternalId: string;
  title: string;
  icon?: string | null;
  cadenceSummary: string | null;
}

/**
 * Body for the "history" sub-view: a slim habit identifier strip so
 * context is clear without scrolling, plus the longer-lens
 * `HowAmIDoingCard`. The header chrome is owned by `HabitDetail`, which
 * renders this component as a slot — keeping API/DB imports off the
 * default detail-view code path.
 */
export const HabitHistoryView = ({
  habitExternalId,
  title,
  icon,
  cadenceSummary,
}: HabitHistoryViewProps) => {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.idStrip}>
        <View style={styles.idSwatch}>
          <HabitGlyph kind={icon} size={17} style="line" color={tokens.cream} />
        </View>
        <View style={styles.idText}>
          <Text style={styles.idTitle} numberOfLines={1}>
            {title.toLowerCase()}
          </Text>
          {cadenceSummary && (
            <Text style={styles.idCadence} numberOfLines={1}>
              {cadenceSummary}
            </Text>
          )}
        </View>
      </View>
      <HowAmIDoingCard habitExternalId={habitExternalId} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  idStrip: {
    marginHorizontal: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  idSwatch: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  idText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  idTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.15,
  },
  idCadence: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.4,
  },
});
