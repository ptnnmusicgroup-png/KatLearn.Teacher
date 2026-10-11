import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const publishDir = path.join(projectRoot, "dist");

const excludedTopLevel = new Set([
  ".git",
  ".github",
  ".netlify",
  ".vercel",
  "api",
  "dist",
  "netlify",
  "node_modules",
  "scripts",
]);

const excludedFiles = new Set([
  ".gitignore",
  "netlify.toml",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "README.md",
  "vercel.json",
]);

function shouldCopy(source) {
  const relative = path.relative(projectRoot, source).replaceAll("\\", "/");
  if (!relative) return true;

  const segments = relative.split("/");
  if (excludedTopLevel.has(segments[0])) return false;
  if (segments.some((segment) => segment.startsWith(".") && segment !== ".well-known")) return false;
  if (excludedFiles.has(relative)) return false;
  if (/(^|\/)(?:service-account[^/]*\.json|[^/]*-service-account\.json)$/i.test(relative)) return false;
  if (/\.(?:pem|key|p12|pfx|crt)$/i.test(relative)) return false;
  if (/(^|\/)\.env(?:\.|$)/i.test(relative)) return false;
  return true;
}

await rm(publishDir, { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });

for (const entry of await readdir(projectRoot, { withFileTypes: true })) {
  const source = path.join(projectRoot, entry.name);
  if (!shouldCopy(source)) continue;
  await cp(source, path.join(publishDir, entry.name), {
    recursive: true,
    force: true,
    filter: shouldCopy,
  });
}

console.log("Netlify Teacher static output prepared at dist/ (server code and secret files excluded).");
