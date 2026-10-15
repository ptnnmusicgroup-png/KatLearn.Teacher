import { cp, mkdir, readdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const publishDir = path.join(projectRoot, "dist");

const excludedTopLevel = new Set([
  ".git", ".github", ".netlify", ".wrangler", "api", "dist", "functions",
  "netlify", "node_modules", "scripts",
]);
const excludedFiles = new Set([
  ".gitignore", "README.md", "CLOUDFLARE_PAGES_MIGRATION.md", "netlify.toml",
  "wrangler.toml", "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
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

function requiredUrl(name) {
  const value = String(process.env[name] || "").trim().replace(/\/+$/, "");
  if (!value) throw new Error("Missing required Cloudflare Pages build variable: " + name);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(name + " must be an HTTPS URL.");
  return value;
}

const siteConfig = {
  teacherUrl: requiredUrl("KATLEARN_TEACHER_URL"),
  lmsUrl: requiredUrl("KATLEARN_LMS_URL"),
};

await rm(publishDir, { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });
for (const entry of await readdir(projectRoot, { withFileTypes: true })) {
  const source = path.join(projectRoot, entry.name);
  if (!shouldCopy(source)) continue;
  await cp(source, path.join(publishDir, entry.name), {
    recursive: true, force: true, filter: shouldCopy,
  });
}
await writeFile(
  path.join(publishDir, "site-config.js"),
  "window.KATLEARN_CONFIG = Object.freeze(" + JSON.stringify(siteConfig) + ");\n",
  "utf8",
);

async function injectSiteConfig(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await injectSiteConfig(target);
      continue;
    }
    if (!entry.isFile() || !/\.html?$/i.test(entry.name)) continue;
    let html = await readFile(target, "utf8");
    const tags = [];
    if (!html.includes('href="/katlearn-polish.css')) tags.push('<link rel="stylesheet" href="/katlearn-polish.css?v=20261013-1">');
    if (!html.includes('src="/site-config.js"')) tags.push('<script src="/site-config.js"></script>');
    if (!html.includes('src="/katlearn-transition.js"')) tags.push('<script src="/katlearn-transition.js" defer></script>');
    if (!tags.length) continue;
    const tag = tags.join("");
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, tag + "</head>");
    else if (/<body\b/i.test(html)) html = html.replace(/<body\b/i, tag + "<body");
    else html = tag + html;
    await writeFile(target, html, "utf8");
  }
}
await injectSiteConfig(publishDir);
console.log("Cloudflare Pages Teacher static output prepared at dist/. API routes are handled by Pages Functions.");
