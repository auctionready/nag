import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ProviderButton } from "./AccountUI";
import { ProviderGlyph } from "../glyphs";
import { tokens } from "../theme";

export const SignInSheet = ({
  visible,
  onClose,
  onApple,
  onGoogle,
  onEmail,
  onPhone,
}: {
  visible: boolean;
  onClose: () => void;
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
  onPhone: () => void;
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <View style={styles.sheetRoot}>
      <Pressable
        style={styles.sheetBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close sign-in sheet"
      />
      <View style={styles.sheet}>
        <View style={styles.sheetGrabber} />
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderText}>
            <Text style={styles.sheetEyebrow}>sign in</Text>
            <Text style={styles.sheetTitle}>back up &amp; sync</Text>
            <Text style={styles.sheetBody}>
              Your habits stay on this device until you sign in.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.sheetClose,
              pressed && styles.sheetClosePressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Svg
              width={12}
              height={12}
              viewBox="0 0 12 12"
              fill="none"
              stroke={tokens.ink}
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <Path d="M2 2l8 8M10 2l-8 8" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.providerStack}>
          <ProviderButton
            primary
            label="Continue with Apple"
            icon={
              <ProviderGlyph provider="apple" size={16} color={tokens.cream} />
            }
            onPress={onApple}
          />
          <ProviderButton
            label="Continue with Google"
            icon={<ProviderGlyph provider="google" size={16} />}
            onPress={onGoogle}
          />
          <ProviderButton
            label="Continue with Email"
            icon={
              <ProviderGlyph provider="email" size={16} color={tokens.ink} />
            }
            onPress={onEmail}
          />
          <ProviderButton
            label="Continue with Phone"
            icon={
              <ProviderGlyph provider="phone" size={16} color={tokens.ink} />
            }
            onPress={onPhone}
          />
        </View>

        <Text style={styles.disclaimer}>
          we never post or read your contacts.
        </Text>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,7,4,0.42)",
  },
  sheet: {
    backgroundColor: tokens.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  sheetGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(26,20,16,0.14)",
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 14,
  },
  sheetHeaderText: {
    flex: 1,
    gap: 4,
  },
  sheetEyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.4,
    lineHeight: 25,
  },
  sheetBody: {
    fontSize: 12.5,
    lineHeight: 17.5,
    color: tokens.mute,
    marginTop: 2,
    maxWidth: 260,
  },
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(26,20,16,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetClosePressed: {
    opacity: 0.7,
  },
  providerStack: {
    gap: 8,
  },
  disclaimer: {
    paddingHorizontal: 8,
    paddingTop: 14,
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1,
    textAlign: "center",
  },
});
