/**
 * Patches the 0G Compute SDK bundle for browser compatibility.
 *
 * The SDK contains lazy dynamic imports of Node.js-only modules:
 *   - fs/promises  (used to write attestation report files to disk)
 *   - stream/promises  (used to pipeline streams)
 *
 * These code paths are never reached in a browser. Vite 8 (rolldown) resolves
 * ALL dynamic imports statically even in excluded-from-optimizeDeps packages,
 * which causes a build error. We replace them with Promise.resolve({}) so Vite
 * never has to find a browser module for them.
 *
 * Run automatically via `npm run prepare` after every install.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const sdkBundle = resolve(
  root,
  "node_modules/@0gfoundation/0g-compute-ts-sdk/lib.esm/index-e381c802.js"
);

let content;
try {
  content = readFileSync(sdkBundle, "utf-8");
} catch {
  console.log("0G SDK bundle not found — skipping patch.");
  process.exit(0);
}

const patched = content
  .replace(/import\(["']fs\/promises["']\)/g, "Promise.resolve({})")
  .replace(/import\(["']stream\/promises["']\)/g, "Promise.resolve({})");

if (patched === content) {
  console.log("0G SDK already patched — nothing to do.");
  process.exit(0);
}

writeFileSync(sdkBundle, patched);
console.log("Patched 0G SDK for browser compatibility (fs/promises, stream/promises).");
