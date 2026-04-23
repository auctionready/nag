// iCloud container visibility
// ──────────────────────────
// The snapshot file (nag-backup.json) is written to the app's iCloud
// Documents container, which is USER-VISIBLE in the Files app under:
//   iCloud Drive → nag → nag-backup.json
//
// To make the container PRIVATE (hidden from Files.app, app-only):
//   1. In app.plugin.js, set NSUbiquitousContainerIsDocumentScopePublic
//      to false, OR remove the NSUbiquitousContainers key entirely.
//   2. Run `pnpm expo prebuild --clean` and rebuild.
// The container (and the snapshot inside it) persists across
// reinstalls either way; only user-browsable visibility changes.

import ExpoModulesCore

public class ICloudBackupModule: Module {
  private let containerId = "iCloud.com.auctionready.nag.app"
  private let fileName = "nag-backup.json"

  public func definition() -> ModuleDefinition {
    Name("ICloudBackup")

    AsyncFunction("isAvailable") { () -> Bool in
      FileManager.default.ubiquityIdentityToken != nil
    }

    AsyncFunction("writeBackup") { (content: String) in
      guard let containerUrl = FileManager.default.url(
        forUbiquityContainerIdentifier: self.containerId
      ) else {
        throw ICloudUnavailableError()
      }

      let documentsUrl = containerUrl.appendingPathComponent("Documents")
      try FileManager.default.createDirectory(
        at: documentsUrl,
        withIntermediateDirectories: true
      )

      let fileUrl = documentsUrl.appendingPathComponent(self.fileName)

      var coordinatorError: NSError?
      var writeError: Error?
      let coordinator = NSFileCoordinator()

      coordinator.coordinate(
        writingItemAt: fileUrl,
        options: .forReplacing,
        error: &coordinatorError
      ) { url in
        do {
          try content.write(to: url, atomically: true, encoding: .utf8)
        } catch {
          writeError = error
        }
      }

      if let error = coordinatorError ?? writeError {
        throw error
      }
    }

    AsyncFunction("readBackup") { () -> String? in
      guard let containerUrl = FileManager.default.url(
        forUbiquityContainerIdentifier: self.containerId
      ) else {
        return nil
      }

      let fileUrl = containerUrl
        .appendingPathComponent("Documents")
        .appendingPathComponent(self.fileName)

      guard FileManager.default.fileExists(atPath: fileUrl.path) else {
        return nil
      }

      // Wait for the file to finish downloading from iCloud (up to 15s).
      // After a reinstall the file is a placeholder until downloaded.
      try FileManager.default.startDownloadingUbiquitousItem(at: fileUrl)
      let deadline = Date().addingTimeInterval(15)
      while Date() < deadline {
        if let values = try? fileUrl.resourceValues(
          forKeys: [.ubiquitousItemDownloadingStatusKey]
        ),
          let status = values.ubiquitousItemDownloadingStatus,
          status == .current
        {
          break
        }
        Thread.sleep(forTimeInterval: 0.1)
      }

      var coordinatorError: NSError?
      var result: String?
      var readError: Error?
      let coordinator = NSFileCoordinator()

      coordinator.coordinate(
        readingItemAt: fileUrl,
        options: [],
        error: &coordinatorError
      ) { url in
        do {
          result = try String(contentsOf: url, encoding: .utf8)
        } catch {
          readError = error
        }
      }

      if let error = coordinatorError ?? readError {
        throw error
      }

      return result
    }
  }
}

private final class ICloudUnavailableError: Exception {
  override var reason: String {
    "iCloud container is not available. Ensure the user is signed into iCloud and the container entitlement is configured."
  }
}
