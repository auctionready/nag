import { useEffect, useState, type PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { runMigrations } from "./runMigrations";

const SPLASH_BACKGROUND = "#8b6545";

export const DatabaseProvider = ({ children }: PropsWithChildren) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    runMigrations()
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
