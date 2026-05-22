import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useUser } from "@clerk/clerk-expo";
import { tokens } from "../theme";
import {
  PROVIDER_LABELS,
  ProviderGlyph,
  type ProviderKey,
  providerFromClerk,
} from "../glyphs";
import { SyncPausedBanner } from "../sync";
import { Group, Row } from "./AccountUI";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { SettingsGroups } from "./SettingsGroups";
import { UpgradeStatusLine } from "./UpgradeStatusLine";
import type { UpgradeStatus } from "./types";

const computeInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const SignedInView = ({
  user,
  status,
  signOut,
}: {
  user: ReturnType<typeof useUser>["user"];
  status: UpgradeStatus;
  signOut: () => Promise<void>;
}) => {
  // Display info derived from Clerk's UserResource.
  const provider: ProviderKey =
    providerFromClerk(user?.externalAccounts?.[0]?.provider) ??
    (user?.primaryEmailAddress ? "email" : "phone");
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.primaryPhoneNumber?.phoneNumber ??
    "";
  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    email ||
    "Signed in";
  const initials = computeInitials(name);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Surfaces a "Sync paused" banner with a Resume button when the
          user has paused sync via the sign-out dialog. Renders nothing
          when sync is in any other state, so the normal Account-screen
          layout is unaffected. */}
      <SyncPausedBanner />

      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.providerBadge}>
            <View style={styles.providerBadgeInner}>
              <ProviderGlyph
                provider={provider}
                size={12}
                color={tokens.cream}
              />
            </View>
          </View>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {email ? (
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>

      <UpgradeStatusLine status={status} />

      <Group title="Linked account">
        <Row
          icon={
            <ProviderGlyph provider={provider} size={14} color={tokens.ink} />
          }
          label={`Signed in with ${PROVIDER_LABELS[provider]}`}
          detail={email || undefined}
          chevron={false}
        />
        <Row
          icon={
            <Svg
              width={14}
              height={14}
              viewBox="0 0 14 14"
              fill="none"
              stroke={tokens.orange}
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M5 2L2 2L2 12L5 12" />
              <Path d="M9 4L12 7L9 10" />
              <Path d="M12 7L6 7" />
            </Svg>
          }
          label="Sign out"
          chevron={false}
          danger
          last
          onPress={() => void signOut()}
        />
      </Group>

      <SettingsGroups />

      <DeleteAccountSection />

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(26,20,16,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: 0.4,
  },
  providerBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  providerBadgeInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 20,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  email: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
  },
});
