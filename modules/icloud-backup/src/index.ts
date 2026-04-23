import { requireNativeModule } from "expo-modules-core";

const ICloudBackupNative = requireNativeModule("ICloudBackup");

export const isAvailable = (): Promise<boolean> =>
  ICloudBackupNative.isAvailable();

export const writeBackup = (content: string): Promise<void> =>
  ICloudBackupNative.writeBackup(content);

export const readBackup = (): Promise<string | null> =>
  ICloudBackupNative.readBackup();
