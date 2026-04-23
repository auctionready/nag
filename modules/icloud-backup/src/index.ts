import { requireNativeModule } from "expo-modules-core";

let ICloudBackupNative: any;
try {
  ICloudBackupNative = requireNativeModule("ICloudBackup");
} catch {
  ICloudBackupNative = null;
}

export const isAvailable = (): Promise<boolean> =>
  ICloudBackupNative
    ? ICloudBackupNative.isAvailable()
    : Promise.resolve(false);

export const writeBackup = (content: string): Promise<void> =>
  ICloudBackupNative
    ? ICloudBackupNative.writeBackup(content)
    : Promise.resolve();

export const readBackup = (): Promise<string | null> =>
  ICloudBackupNative ? ICloudBackupNative.readBackup() : Promise.resolve(null);
