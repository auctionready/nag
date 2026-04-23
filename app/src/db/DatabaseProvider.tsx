import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Text, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { File, Paths } from "expo-file-system";
import { db } from "./index";
import { runMigrations } from "./runMigrations";
import { exportSnapshot, importSnapshot, setAfterCommitHook } from "@nag/core";
import * as ICloudBackup from "@nag/icloud-backup";

const SPLASH_BACKGROUND = "#8b6545";

const getInitMarker = () => {
  try {
    return new File(Paths.document, ".nag-initialized");
  } catch {
    return null;
  }
};

const tryRestoreFromBackup = async () =>
  Sentry.startSpan(
    { name: "icloud.restore", op: "db.restore" },
    async (span) => {
      const marker = getInitMarker();
      if (marker?.exists) {
        span.setStatus({ code: 0, message: "already_initialized" });
        return;
      }

      try {
        const available = await ICloudBackup.isAvailable();
        console.log("[icloud] restore: isAvailable =", available);
        if (available) {
          const json = await ICloudBackup.readBackup();
          console.log("[icloud] restore: backup found =", json != null);
          if (json) {
            await importSnapshot(db, json);
            span.setStatus({ code: 1, message: "restored" });
          } else {
            span.setStatus({ code: 0, message: "no_backup" });
          }
        } else {
          span.setStatus({ code: 0, message: "icloud_unavailable" });
        }
      } catch (e) {
        console.warn("[icloud] restore failed:", e);
        Sentry.captureException(e);
        span.setStatus({ code: 2, message: "restore_failed" });
      }

      try {
        marker?.write("1");
      } catch {
        // marker write is best-effort
      }
    },
  );

const performBackup = async () =>
  Sentry.startSpan({ name: "icloud.backup", op: "db.backup" }, async (span) => {
    try {
      const available = await ICloudBackup.isAvailable();
      console.log("[icloud] backup: isAvailable =", available);
      if (!available) {
        span.setStatus({ code: 0, message: "icloud_unavailable" });
        return;
      }
      const json = await Sentry.startSpan(
        { name: "icloud.backup.export", op: "db.query" },
        () => exportSnapshot(db),
      );
      console.log("[icloud] backup: exported", json.length, "bytes");
      await Sentry.startSpan(
        { name: "icloud.backup.write", op: "file.write" },
        () => ICloudBackup.writeBackup(json),
      );
      console.log("[icloud] backup: write complete");
    } catch (e) {
      console.warn("[icloud] backup failed:", e);
      Sentry.captureException(e);
      span.setStatus({ code: 2, message: "backup_failed" });
    }
  });

export const DatabaseProvider = ({ children }: PropsWithChildren) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const backupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    runMigrations()
      .then(() => tryRestoreFromBackup())
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    setAfterCommitHook(() => {
      if (backupTimer.current) clearTimeout(backupTimer.current);
      backupTimer.current = setTimeout(() => {
        void performBackup();
      }, 5_000);
    });

    return () => {
      setAfterCommitHook(undefined);
      if (backupTimer.current) clearTimeout(backupTimer.current);
    };
  }, [ready]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: SPLASH_BACKGROUND,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>
          Migration error: {error.message}
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: SPLASH_BACKGROUND,
        }}
      />
    );
  }

  return <>{children}</>;
};
