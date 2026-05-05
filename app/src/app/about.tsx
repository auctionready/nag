import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { loadIdentity, countPending, countFailed } from "@nag/core";
import { db } from "../db";
import { tokens } from "../components/theme";

type AboutData = {
  accountId: string | null;
  deviceId: string | null;
  registeredAt: Date | null;
  apiBaseUrl: string;
  pendingEvents: number;
  failedEvents: number;
};

const AboutScreen = () => {
  const [data, setData] = useState<AboutData | null>(null);

  useEffect(() => {
    const load = async () => {
      const [identity, pending, failed] = await Promise.all([
        loadIdentity(db),
        countPending(db),
        countFailed(db),
      ]);
      const apiBaseUrl =
        (Constants.expoConfig?.extra as { apiBaseUrl?: string })?.apiBaseUrl ??
        "<missing>";
      setData({
        accountId: identity?.accountId ?? null,
        deviceId: identity?.deviceId ?? null,
        registeredAt: identity?.registeredAt ?? null,
        apiBaseUrl,
        pendingEvents: pending,
        failedEvents: failed,
      });
    };
    void load();
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <InfoGroup title="Identity">
        <InfoRow label="Account ID" value={data?.accountId ?? null} />
        <InfoRow label="Device ID" value={data?.deviceId ?? null} />
        <InfoRow
          label="Registered"
          value={data?.registeredAt?.toISOString() ?? null}
          last
        />
      </InfoGroup>

      <InfoGroup title="Server">
        <InfoRow label="API URL" value={data?.apiBaseUrl ?? null} last />
      </InfoGroup>

      <InfoGroup title="Sync">
        <InfoRow
          label="Pending events"
          value={data != null ? String(data.pendingEvents) : null}
        />
        <InfoRow
          label="Failed events"
          value={data != null ? String(data.failedEvents) : null}
          last
        />
      </InfoGroup>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

export default AboutScreen;

const InfoGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.group}>
    <Text style={styles.groupTitle}>{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>
);

const InfoRow = ({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string | null;
  last?: boolean;
}) => (
  <View style={[styles.row, !last && styles.divider]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={1} selectable>
      {value ?? "—"}
    </Text>
  </View>
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
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  rowLabel: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 12,
    color: tokens.mute,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  rowValue: {
    fontFamily: "JetBrainsMono",
    fontSize: 12,
    color: tokens.ink,
  },
});
