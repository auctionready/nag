import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ProviderButton } from "./AccountUI";
import { tokens } from "../theme";
import type { CredentialFlow } from "./types";

export const CredentialCodeForm = ({
  flow,
  onChange,
  onSubmit,
  onBack,
}: {
  flow: Extract<CredentialFlow, { stage: "code" }>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) => (
  <ScrollView
    style={styles.scroll}
    contentContainerStyle={styles.scrollContent}
  >
    <View style={styles.formHeader}>
      <Text style={styles.formTitle}>enter verification code</Text>
      <Text style={styles.formBody}>
        We sent a code to <Text style={styles.bold}>{flow.identifier}</Text>.
        Enter it below to finish signing in.
      </Text>
    </View>
    <View style={styles.formCard}>
      <TextInput
        style={styles.input}
        value={flow.code}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        placeholder="123456"
        placeholderTextColor={tokens.mute}
        editable={!flow.busy}
        accessibilityLabel="Verification code"
      />
      {flow.error && <Text style={styles.formError}>{flow.error}</Text>}
    </View>
    <View style={styles.formActions}>
      <ProviderButton
        primary
        label={flow.busy ? "Verifying…" : "Verify"}
        icon={<View />}
        onPress={onSubmit}
        busy={flow.busy}
      />
      <ProviderButton
        label="Back"
        icon={<View />}
        onPress={onBack}
        disabled={flow.busy}
      />
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  formHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  formBody: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.mute,
  },
  formCard: {
    marginHorizontal: 16,
    backgroundColor: tokens.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  input: {
    fontSize: 16,
    color: tokens.ink,
    paddingVertical: 12,
  },
  formError: {
    fontSize: 13,
    color: tokens.orange,
    paddingVertical: 6,
  },
  formActions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  bold: {
    fontWeight: "600",
    color: tokens.ink,
  },
});
