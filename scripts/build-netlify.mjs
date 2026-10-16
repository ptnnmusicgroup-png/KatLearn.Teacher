import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const skippedDirectories = new Set([
  ".git", ".github", ".netlify", "node_modules", "dist",
  "api", "netlify", "scripts",
  ".wrangler", "functions", "cloudflare-api"
]);
const skippedRootFiles = new Set([
  ".gitignore", "README.md", "package.json",
  "firestore.rules", "netlify.toml",
  "wrangler.toml", "wrangler-api.toml", "cloudflare-worker.js",
  "Dockerfile.cloudflare-api", "CLOUDFLARE_WORKERS_MIGRATION.md",
  "NETLIFY_MIGRATION.md", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"
]);

function shouldCopy(source) {
  const relative = path.relative(root, source);
  if (!relative || relative === ".") return false;
  const parts = relative.split(path.sep);
  if (parts.some((part) => skippedDirectories.has(part))) return false;
  if (parts.some((part) => part.startsWith(".env"))) return false;
  if (parts.length === 1 && skippedRootFiles.has(parts[0])) return false;
  return true;
}

function cleanUrl(value, fallback) {
  return String(value || fallback).trim().replace(/\/+$/, "");
}

function injectConfigIntoHtml(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      injectConfigIntoHtml(absolute);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) continue;
    let html = fs.readFileSync(absolute, "utf8");
    if (!/src=["']\/?deployment-config\.js["']/i.test(html)) {
      html = html.replace(/<head(\b[^>]*)>/i, '$&\n  <script src="/deployment-config.js"></script>');
    }
    if (!/class=["']netlify-attribution["']/i.test(html)) {
      const attribution = '<div class="netlify-attribution" style="margin:18px auto 10px;padding:0 12px;text-align:center;font:500 10px/1.5 system-ui,sans-serif;color:#777"><a href="https://www.netlify.com/" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">This site is powered by Netlify</a></div>';
      if (/<\/body\s*>/i.test(html)) html = html.replace(/<\/body\s*>/i, attribution + '\n</body>');
      else html += '\n' + attribution + '\n';
    }
    fs.writeFileSync(absolute, html, "utf8");
  }
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of fs.readdirSync(root)) {
  const source = path.join(root, name);
  if (!shouldCopy(source)) continue;
  fs.cpSync(source, path.join(output, name), {
    recursive: true,
    force: true,
    filter: shouldCopy
  });
}

const productionUrl = process.env.CONTEXT === "production"
  ? process.env.URL
  : (process.env.DEPLOY_PRIME_URL || process.env.URL);
const lmsUrl = cleanUrl(
  process.env.KATLEARN_LMS_SITE_URL,
  "https://lms-katlearn.netlify.app"
);
const configuredTeacherUrl = cleanUrl(
  process.env.KATLEARN_TEACHER_SITE_URL || productionUrl,
  "https://teacher-katlearn1.netlify.app"
);
const teacherUrl = configuredTeacherUrl === "https://teacher-katlearn.netlify.app"
  ? "https://teacher-katlearn1.netlify.app"
  : configuredTeacherUrl;
fs.writeFileSync(
  path.join(output, "deployment-config.js"),
  "window.KATLEARN_DEPLOYMENT_CONFIG = Object.freeze(" +
    JSON.stringify({ lmsUrl, teacherUrl }) +
    ");\n",
  "utf8"
);
injectConfigIntoHtml(output);
console.log("Netlify static output created at dist/");
