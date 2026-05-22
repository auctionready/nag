import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import type { Tagline } from "./taglines";

type TaglineViewProps = {
  tagline: Tagline;
  containerStyle?: StyleProp<ViewStyle>;
  quoteStyle?: StyleProp<TextStyle>;
  attributionStyle?: StyleProp<TextStyle>;
};

/**
 * Dumb display: renders a quote and its attribution.
 *
 * Visual treatment is left to the caller via the *Style props so the same
 * component can be reused on the splash, in the About card, etc.
 */
export const TaglineView = ({
  tagline,
  containerStyle,
  quoteStyle,
  attributionStyle,
}: TaglineViewProps) => (
  <View style={containerStyle}>
    <Text style={[styles.quote, quoteStyle]}>“{tagline.quote}”</Text>
    <Text style={[styles.attribution, attributionStyle]}>
      — {tagline.attribution}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  quote: {
    fontFamily: "JetBrainsMono-Regular",
  },
  attribution: {
    fontFamily: "JetBrainsMono-Regular",
  },
});
