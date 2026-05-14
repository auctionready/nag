import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ProviderButton } from "./AccountUI";
import { tokens } from "../theme";
import type { CredentialFlow } from "./types";

export const CredentialIdentifierForm = ({
  flow,
  onChange,
  onSubmit,
  onBack,
}: {
  flow: Extract<CredentialFlow, { stage: "identifier" }>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) => (
  <ScrollView
    style={styles.scroll}
    contentContainerStyle={styles.scrollContent}
  >
    <View style={styles.formHeader}>
      <Text style={styles.formTitle}>
        {flow.channel === "email" ? "sign in with email" : "sign in with phone"}
      </Text>
      <Text style={styles.formBody}>
        {flow.channel === "email"
          ? "Enter your email address. We'll send a one-time code."
          : "Enter your phone number in international format (e.g. +14155550123). We'll send a code by SMS."}
      </Text>
    </View>
    <View style={styles.formCard}>
      <TextInput
        style={styles.input}
        value={flow.value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={flow.channel === "email" ? "email-address" : "phone-pad"}
        textContentType={
          flow.channel === "email" ? "emailAddress" : "telephoneNumber"
        }
        placeholder={
          flow.channel === "email" ? "you@example.com" : "+14155550123"
        }
        placeholderTextColor={tokens.mute}
        editable={!flow.busy}
        accessibilityLabel={
          flow.channel === "email" ? "Email address" : "Phone number"
        }
      />
      {flow.error && <Text style={styles.formError}>{flow.error}</Text>}
    </View>
    <View style={styles.formActions}>
      <ProviderButton
        primary
        label={flow.busy ? "Sending…" : "Send code"}
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
});
