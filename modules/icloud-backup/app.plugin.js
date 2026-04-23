const { withEntitlementsPlist, withInfoPlist } = require("expo/config-plugins");

const CONTAINER_ID = "iCloud.com.auctionready.nag.app";

const withICloudBackup = (config) => {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults["com.apple.developer.icloud-container-identifiers"] = [
      CONTAINER_ID,
    ];
    mod.modResults["com.apple.developer.icloud-services"] = ["CloudDocuments"];
    mod.modResults["com.apple.developer.ubiquity-container-identifiers"] = [
      CONTAINER_ID,
    ];
    return mod;
  });

  // NSUbiquitousContainerIsDocumentScopePublic = true makes the container
  // visible in the Files app. Set to false to hide it from the user.
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSUbiquitousContainers = {
      [CONTAINER_ID]: {
        NSUbiquitousContainerIsDocumentScopePublic: true,
        NSUbiquitousContainerSupportedFolderLevels: "None",
        NSUbiquitousContainerName: "nag",
      },
    };
    return mod;
  });

  return config;
};

module.exports = withICloudBackup;
