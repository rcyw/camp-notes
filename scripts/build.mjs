/**
 * Build script: produce a self-contained dist/ directory with the static site,
 * resolving all asset URLs for the /camp-notes/ subpath.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function build() {
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });

  // Static assets (src is copied whole, matching the source layout used by index.html).
  await fs.copyFile(path.join(root, "index.html"), path.join(dist, "index.html"));
  await fs.copyFile(path.join(root, "styles.css"), path.join(dist, "styles.css"));
  await copyDir(path.join(root, "src"), path.join(dist, "src"));

  console.log(`Built Camp Notes to ${path.relative(root, dist)}/`);
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
