import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";

type ScheduledNotification = Notifications.NotificationRequest;

export const DebugNotificationsScreen = () => {
  const [notifications, setNotifications] = useState<ScheduledNotification[]>(
    [],
  );

  const load = async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    setNotifications(all);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.identifier}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.id}>{item.identifier}</Text>
            <Text style={styles.title}>{item.content.title}</Text>
            <Text style={styles.body}>{item.content.body}</Text>
            <Text style={styles.trigger}>
              {JSON.stringify(item.trigger, null, 2)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No scheduled notifications.</Text>
        }
        contentContainerStyle={styles.list}
      />
      <Pressable style={styles.refreshButton} onPress={load}>
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
    gap: 2,
  },
  id: {
    fontSize: 11,
    color: "#999",
    fontFamily: "Courier",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  body: {
    fontSize: 14,
    color: "#444",
  },
  trigger: {
    fontSize: 11,
    color: "#666",
    fontFamily: "Courier",
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    color: "#999",
    marginTop: 32,
    fontSize: 16,
  },
  refreshButton: {
    backgroundColor: "#007AFF",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  refreshButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
export default DebugNotificationsScreen;
