#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const globalJson = JSON.parse(
  readFileSync(join(repoRoot, "backend/global.json"), "utf8"),
);
const pinned = globalJson.sdk.version;
const [major, minor] = pinned.split(".");
const channel = `${major}.${minor}`;

const url = `https://builds.dotnet.microsoft.com/dotnet/release-metadata/${channel}/releases.json`;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 3000);

try {
  const res = await fetch(url, { signal: controller.signal });
  if (!res.ok) process.exit(0);
  const data = await res.json();
  const latest = data["latest-sdk"];
  if (latest && latest !== pinned) {
    console.warn(
      `\n\x1b[33m[dotnet]\x1b[0m pinned SDK is ${pinned}, latest ${channel} is ${latest}.`,
    );
    console.warn(
      `         Update backend/global.json and re-run CI. See backend/README.md.\n`,
    );
  }
} catch {
  // network/timeout — silent
} finally {
  clearTimeout(timer);
}
