// Adds a signed version to updates.json, the file Firefox checks for updates (update_url in the manifest).
// Usage: node scripts/add-firefox-update.mjs <version> <xpi url> <sha256:hash>
import { readFileSync, writeFileSync } from "node:fs";

const [version, link, hash] = process.argv.slice(2);
if (!version || !link?.startsWith("https://")) {
  console.error("Usage: node scripts/add-firefox-update.mjs <version> <https xpi url> [sha256:hash]");
  process.exit(1);
}

const file = new URL("../updates.json", import.meta.url);
const manifest = JSON.parse(readFileSync(file, "utf8"));
const [id] = Object.keys(manifest.addons);
const updates = manifest.addons[id].updates.filter((entry) => entry.version !== version);
updates.push({ version, update_link: link, ...(hash ? { update_hash: hash } : {}) });
manifest.addons[id].updates = updates;
writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
console.log(`updates.json: ${id} → ${version}`);
